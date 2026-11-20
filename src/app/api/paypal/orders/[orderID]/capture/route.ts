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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderID: string }> },
) {
  try {
    const { orderID } = await params;
    if (!orderID) return NextResponse.json({ error: "Orden requerida." }, { status: 400 });

    const accessToken = await getAccessToken();
    const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("PayPal capture error:", result);
      return NextResponse.json({ error: "No se pudo confirmar el pago." }, { status: 502 });
    }
    if (result.status !== "COMPLETED") {
      return NextResponse.json({ error: "El pago aún no fue completado." }, { status: 409 });
    }

    return NextResponse.json({
      status: result.status,
      captureId: result.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al confirmar el pago.";
    console.error("PayPal capture:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
