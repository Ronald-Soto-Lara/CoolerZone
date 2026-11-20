"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        style?: {
          layout?: string;
          color?: string;
          shape?: string;
          label?: string;
          height?: number;
        };
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError?: (error: unknown) => void;
      }) => { render: (container: HTMLElement) => Promise<void> };
      // The SDK is typed minimally because it is loaded dynamically.
    };
  }
}

export function PayPalButton({ product }: { product: Product }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const exchangeRate = Number(process.env.NEXT_PUBLIC_PAYPAL_BOB_TO_USD_RATE ?? 0);

  useEffect(() => {
    if (!clientId || exchangeRate <= 0 || !containerRef.current) return;
    if (document.querySelector('script[data-coolerzone-paypal]')) {
      if (window.paypal) renderButtons();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.async = true;
    script.setAttribute("data-coolerzone-paypal", "true");
    script.onload = renderButtons;
    document.head.appendChild(script);

    function renderButtons() {
      if (!window.paypal || !containerRef.current) return;

      window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 46 },
        createOrder: async () => {
          setMessage("");
          requestIdRef.current ??= crypto.randomUUID();
          const response = await fetch("/api/paypal/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: product.id, requestId: requestIdRef.current }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar el pago.");
          return result.orderId;
        },
        onApprove: async ({ orderID }) => {
          setMessage("Confirmando el pago...");
          let result: { status?: string; message?: string; error?: string } = {};
          for (let attempt = 0; attempt < 3; attempt += 1) {
            let response: Response;
            try {
              response = await fetch(`/api/paypal/orders/${encodeURIComponent(orderID)}/capture`, {
                method: "POST",
              });
            } catch {
              if (attempt === 2) {
                throw new Error("No se pudo conectar para confirmar el pago. No inicies otra compra; vuelve a intentarlo.");
              }
              await new Promise((resolve) => window.setTimeout(resolve, 750 * (attempt + 1)));
              continue;
            }

            try {
              result = await response.json();
            } catch {
              if (attempt === 2) {
                throw new Error("El servidor no pudo confirmar el resultado del pago. Vuelve a intentarlo.");
              }
              await new Promise((resolve) => window.setTimeout(resolve, 750 * (attempt + 1)));
              continue;
            }

            if (response.ok) break;
            if (response.status < 500 || attempt === 2) {
              throw new Error(result.error ?? "No se pudo confirmar el pago.");
            }
            await new Promise((resolve) => window.setTimeout(resolve, 750 * (attempt + 1)));
          }
          if (!result.status) {
            throw new Error(result.error ?? "No se pudo confirmar el pago.");
          }
          requestIdRef.current = null;
          setMessage(
            result.status === "REFUNDED"
              ? result.message ?? "El pago fue reembolsado."
              : "Pago completado y pedido registrado. En breve te contactaremos.",
          );
        },
        onError: (error) => {
          console.error("PayPal:", error);
          setMessage(
            error instanceof Error
              ? error.message
              : "El pago no pudo completarse. Inténtalo nuevamente.",
          );
        },
      }).render(containerRef.current);
    }
  }, [clientId, exchangeRate, product.id]);

  if (!clientId || exchangeRate <= 0) {
    return <p className="config-note">PayPal estará disponible cuando se complete la configuración de pagos.</p>;
  }

  return (
    <div className="paypal-checkout">
      <div ref={containerRef} />
      {message && <p className="payment-status" role="status">{message}</p>}
    </div>
  );
}
