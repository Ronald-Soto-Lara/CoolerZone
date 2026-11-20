"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        style?: Record<string, string>;
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
        style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: "46" },
        createOrder: async () => {
          setMessage("");
          const response = await fetch("/api/paypal/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: product.id }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar el pago.");
          return result.orderId;
        },
        onApprove: async ({ orderID }) => {
          setMessage("Confirmando el pago...");
          const response = await fetch(`/api/paypal/orders/${encodeURIComponent(orderID)}/capture`, {
            method: "POST",
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "No se pudo confirmar el pago.");
          setMessage("Pago completado. En breve te contactaremos.");
        },
        onError: (error) => {
          console.error("PayPal:", error);
          setMessage("El pago no pudo completarse. Puedes volver a intentarlo.");
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
