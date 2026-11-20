import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function paypalBaseUrl() {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Faltan las credenciales privadas de PayPal.");

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description ?? "No se pudo autenticar con PayPal.");
  return result.access_token as string;
}

export async function POST(request: Request) {
  try {
    const { productId } = await request.json();
    if (!productId) return NextResponse.json({ error: "Producto requerido." }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const exchangeRate = Number(process.env.PAYPAL_BOB_TO_USD_RATE ?? 0);
    if (!supabaseUrl || !supabaseKey) throw new Error("Falta la configuración de Supabase.");
    if (exchangeRate <= 0) throw new Error("Falta configurar la tasa de cambio a USD.");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, price, stock, published")
      .eq("id", productId)
      .eq("published", true)
      .maybeSingle();

    if (error) throw new Error("No se pudo validar el producto.");
    if (!product) return NextResponse.json({ error: "Producto no disponible." }, { status: 404 });
    if (product.stock <= 0) return NextResponse.json({ error: "Producto sin stock." }, { status: 409 });

    const usdAmount = (Number(product.price) * exchangeRate).toFixed(2);
    if (Number(usdAmount) <= 0) return NextResponse.json({ error: "Monto de pago inválido." }, { status: 400 });

    const accessToken = await getAccessToken();
    const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: product.id,
          description: product.name,
          custom_id: product.id,
          amount: { currency_code: "USD", value: usdAmount },
        }],
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("PayPal order error:", result);
      return NextResponse.json({ error: "No se pudo crear la orden de PayPal." }, { status: 502 });
    }

    return NextResponse.json({ orderId: result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al iniciar el pago.";
    console.error("PayPal create order:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
