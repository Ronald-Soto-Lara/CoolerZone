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
  type PayPalCapture,
  type PayPalOrder,
  type PayPalRefund,
} from "@/lib/paypal-server";

export const runtime = "nodejs";

type OrderRecord = {
  id: string;
  request_id: string;
  paypal_order_id: string;
  paypal_capture_id: string | null;
  paypal_capture_request_id: string;
  paypal_refund_request_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  amount_usd: number;
  currency_code: string;
  status: string;
};

type FinalizeResult = {
  order_status: string;
  order_id: string;
};

function extractCapture(paypalOrder: PayPalOrder): PayPalCapture | null {
  return paypalOrder.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
}

function amountMatches(amount: { currency_code?: string; value?: string } | undefined, order: OrderRecord) {
  return (
    amount?.currency_code === order.currency_code &&
    typeof amount.value === "string" &&
    Number.isFinite(Number(amount.value)) &&
    Number(amount.value).toFixed(2) === Number(order.amount_usd).toFixed(2)
  );
}

function validatePayPalOrder(paypalOrder: PayPalOrder, order: OrderRecord) {
  const unit = paypalOrder.purchase_units?.find(
    (purchaseUnit) =>
      purchaseUnit.custom_id === order.product_id &&
      purchaseUnit.reference_id === order.product_id,
  );

  return Boolean(unit && amountMatches(unit.amount, order));
}

async function finalizeOrder(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  order: OrderRecord,
  capture: PayPalCapture,
  payer: PayPalOrder["payer"],
) {
  if (!capture.id || capture.status !== "COMPLETED" || !amountMatches(capture.amount, order)) {
    throw new Error("PayPal no confirmó una captura completa con el monto esperado.");
  }

  const payerName = [payer?.name?.given_name, payer?.name?.surname].filter(Boolean).join(" ") || null;
  const { data, error } = await supabase.rpc("finalize_paypal_order", {
    p_paypal_order_id: order.paypal_order_id,
    p_capture_id: capture.id,
    p_payer_name: payerName,
    p_payer_email: payer?.email_address ?? null,
  });

  if (error) {
    console.error("No se pudo registrar el pago ni actualizar el inventario:", error.message);
    throw new Error("PayPal confirmó el pago, pero la tienda no pudo finalizar la orden. Reintenta la confirmación.");
  }

  const result = (Array.isArray(data) ? data[0] : data) as FinalizeResult | null;
  if (!result?.order_status || !result.order_id) {
    throw new Error("Supabase devolvió un resultado inválido al finalizar la orden.");
  }
  return result.order_status;
}

async function processRefund(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  order: OrderRecord,
  accessToken: string,
) {
  if (!order.paypal_capture_id) {
    throw new Error("La orden requiere reembolso, pero no tiene un identificador de captura.");
  }

  const refund = await paypalRequest<PayPalRefund>(
    `/v2/payments/captures/${encodeURIComponent(order.paypal_capture_id)}/refund`,
    accessToken,
    {
      method: "POST",
      headers: { "PayPal-Request-Id": order.paypal_refund_request_id },
      body: JSON.stringify({}),
    },
  );

  if (refund.status !== "COMPLETED" || !refund.id) {
    return false;
  }

  const { error } = await supabase.rpc("finalize_paypal_refund", {
    p_paypal_order_id: order.paypal_order_id,
    p_refund_id: refund.id,
  });
  if (error) {
    console.error("PayPal reembolsó el pago, pero Supabase no pudo actualizar la orden:", error.message);
    throw new Error("PayPal reembolsó el pago, pero la tienda no pudo actualizar el estado de la orden.");
  }
  return true;
}

async function refundPendingResponse(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  order: OrderRecord,
  accessToken: string,
) {
  try {
    const refunded = await processRefund(supabase, order, accessToken);
    if (refunded) {
      return NextResponse.json({
        status: "REFUNDED",
        orderId: order.id,
        message: "El producto se quedó sin stock; PayPal completó el reembolso.",
      });
    }
  } catch (error) {
    console.error("No se pudo completar el reembolso automático de PayPal:", error);
  }

  return NextResponse.json(
    { error: "El pago se realizó, pero el reembolso sigue pendiente. Contacta a la tienda con tu orden." },
    { status: 503 },
  );
}

function captureErrorResponse(error: unknown) {
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
    console.error("PayPal API no pudo confirmar la orden.", {
      status: error.status,
      name: error.paypalName,
      debugId: error.debugId,
    });
    return NextResponse.json(
      { error: "No se pudo confirmar el pago. Reintenta; no vuelvas a iniciar una compra nueva." },
      { status: 502 },
    );
  }

  console.error("PayPal capture:", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "No se pudo confirmar el pago." },
    { status: 500 },
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderID: string }> },
) {
  const { orderID } = await params;
  if (!orderID || orderID.length > 64) {
    return NextResponse.json({ error: "Orden inválida." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, request_id, paypal_order_id, paypal_capture_id, paypal_capture_request_id, paypal_refund_request_id, product_id, product_name, quantity, amount_usd, currency_code, status")
      .eq("paypal_order_id", orderID)
      .maybeSingle<OrderRecord>();

    if (orderError) {
      console.error("No se pudo consultar la orden:", orderError.message);
      throw new Error("No se pudo buscar la orden en Supabase. Comprueba que la migración de pedidos esté aplicada.");
    }
    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    }
    if (order.status === "completed") {
      return NextResponse.json({ status: "COMPLETED", orderId: order.id });
    }
    if (order.status === "refunded") {
      return NextResponse.json({
        status: "REFUNDED",
        orderId: order.id,
        message: "El pago fue reembolsado porque el producto ya no tenía stock.",
      });
    }

    const accessToken = await getPayPalAccessToken();
    if (order.status === "refund_pending") {
      return refundPendingResponse(supabase, order, accessToken);
    }
    if (order.status !== "pending") {
      return NextResponse.json({ error: "La orden no está disponible para confirmar." }, { status: 409 });
    }

    const currentOrder = await paypalRequest<PayPalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(orderID)}`,
      accessToken,
    );
    if (!validatePayPalOrder(currentOrder, order)) {
      return NextResponse.json(
        { error: "El monto o el producto de la orden no coincide con la compra registrada." },
        { status: 409 },
      );
    }

    let capturedOrder = currentOrder;
    if (currentOrder.status !== "COMPLETED") {
      if (currentOrder.status !== "APPROVED") {
        return NextResponse.json({ error: "PayPal todavía no ha aprobado esta orden." }, { status: 409 });
      }

      try {
        capturedOrder = await paypalRequest<PayPalOrder>(
          `/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
          accessToken,
          {
            method: "POST",
            headers: { "PayPal-Request-Id": order.paypal_capture_request_id },
            body: JSON.stringify({}),
          },
        );
      } catch (captureError) {
        if (!(captureError instanceof PayPalApiError)) throw captureError;
        capturedOrder = await paypalRequest<PayPalOrder>(
          `/v2/checkout/orders/${encodeURIComponent(orderID)}`,
          accessToken,
        );
      }
    }

    if (capturedOrder.status !== "COMPLETED" || !validatePayPalOrder(capturedOrder, order)) {
      return NextResponse.json({ error: "PayPal aún no confirmó el pago completo." }, { status: 409 });
    }

    const capture = extractCapture(capturedOrder);
    if (!capture) {
      throw new Error("PayPal confirmó la orden sin devolver los detalles de captura.");
    }
    const finalStatus = await finalizeOrder(supabase, order, capture, capturedOrder.payer);

    if (finalStatus === "refund_pending") {
      const orderWithCapture = { ...order, paypal_capture_id: capture?.id ?? null };
      return refundPendingResponse(supabase, orderWithCapture, accessToken);
    }

    return NextResponse.json({
      status: "COMPLETED",
      orderId: order.id,
      captureId: capture?.id,
    });
  } catch (error) {
    return captureErrorResponse(error);
  }
}
