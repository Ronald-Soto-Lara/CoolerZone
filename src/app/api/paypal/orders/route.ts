import { NextResponse } from "next/server";
import {
  createSupabaseAdmin,
  SupabaseAdminConfigurationError,
} from "@/lib/supabase-admin";
import {
  getPayPalAccessToken,
  PayPalApiError,
  PayPalAuthenticationError,
  PayPalConfigurationError,
  paypalRequest,
  type PayPalOrder,
} from "@/lib/paypal-server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrderRecord = {
  request_id: string;
  paypal_order_id: string;
  product_id: string;
  status: string;
};

function orderErrorResponse(error: unknown) {
  if (error instanceof SupabaseAdminConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof PayPalConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof PayPalAuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  if (error instanceof PayPalApiError) {
    console.error("PayPal API no pudo crear la orden.", {
      status: error.status,
      name: error.paypalName,
      debugId: error.debugId,
    });
    return NextResponse.json(
      { error: "No se pudo crear la orden de PayPal. Inténtalo nuevamente." },
      { status: 502 },
    );
  }

  console.error("PayPal create order:", error);
  return NextResponse.json(
    { error: "No se pudo iniciar el pago. Comprueba la configuración e inténtalo nuevamente." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const { productId, requestId } = body as {
    productId?: unknown;
    requestId?: unknown;
  };
  if (
    typeof productId !== "string" ||
    !uuidPattern.test(productId) ||
    typeof requestId !== "string" ||
    !uuidPattern.test(requestId)
  ) {
    return NextResponse.json({ error: "Producto o referencia de compra inválidos." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("orders")
      .select("request_id, paypal_order_id, product_id, status")
      .eq("request_id", requestId)
      .maybeSingle<OrderRecord>();

    if (existingOrderError) {
      console.error("No se pudo consultar la orden existente:", existingOrderError.message);
      return NextResponse.json(
        { error: "No se encontró la tabla privada de pedidos. Aplica la migración de Supabase antes de cobrar." },
        { status: 503 },
      );
    }
    if (existingOrder) {
      if (existingOrder.product_id !== productId || existingOrder.status !== "pending") {
        return NextResponse.json(
          { error: "Esta referencia ya fue utilizada. Actualiza la página para iniciar otra compra." },
          { status: 409 },
        );
      }
      return NextResponse.json({ orderId: existingOrder.paypal_order_id });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price, stock, published")
      .eq("id", productId)
      .eq("published", true)
      .maybeSingle();

    if (productError) {
      console.error("No se pudo validar el producto:", productError.message);
      throw new Error("No se pudo validar el producto en Supabase.");
    }
    if (!product) {
      return NextResponse.json({ error: "Producto no disponible." }, { status: 404 });
    }
    if (product.stock <= 0) {
      return NextResponse.json({ error: "Producto sin stock." }, { status: 409 });
    }

    const exchangeRate = Number(process.env.PAYPAL_BOB_TO_USD_RATE);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new PayPalConfigurationError("Configura una tasa de cambio PAYPAL_BOB_TO_USD_RATE válida.");
    }

    const amountUsd = (Number(product.price) * exchangeRate).toFixed(2);
    if (!Number.isFinite(Number(amountUsd)) || Number(amountUsd) <= 0) {
      return NextResponse.json({ error: "El monto de pago calculado no es válido." }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();
    const paypalOrder = await paypalRequest<PayPalOrder>("/v2/checkout/orders", accessToken, {
      method: "POST",
      headers: { "PayPal-Request-Id": requestId },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: product.id,
          description: product.name,
          custom_id: product.id,
          amount: { currency_code: "USD", value: amountUsd },
        }],
      }),
    });

    if (!paypalOrder.id) {
      throw new Error("PayPal no devolvió un identificador de orden.");
    }

    const { error: insertError } = await supabase.from("orders").insert({
      request_id: requestId,
      paypal_order_id: paypalOrder.id,
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price_bob: product.price,
      exchange_rate: exchangeRate,
      amount_usd: amountUsd,
      currency_code: "USD",
      status: "pending",
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: concurrentOrder, error: lookupError } = await supabase
          .from("orders")
          .select("paypal_order_id, product_id, status")
          .eq("request_id", requestId)
          .maybeSingle();

        if (
          !lookupError &&
          concurrentOrder?.paypal_order_id === paypalOrder.id &&
          concurrentOrder.product_id === productId &&
          concurrentOrder.status === "pending"
        ) {
          return NextResponse.json({ orderId: concurrentOrder.paypal_order_id });
        }
      }

      console.error("No se pudo guardar la orden pendiente:", insertError.message);
      return NextResponse.json(
        { error: "PayPal creó la orden, pero no se pudo registrar en la tienda. No se ha cobrado; vuelve a intentarlo." },
        { status: 503 },
      );
    }

    return NextResponse.json({ orderId: paypalOrder.id });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
