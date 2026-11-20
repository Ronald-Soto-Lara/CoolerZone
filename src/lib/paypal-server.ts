type PayPalOAuthResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type PayPalErrorResponse = {
  name?: string;
  message?: string;
  debug_id?: string;
};

export type PayPalAmount = {
  currency_code?: string;
  value?: string;
};

export type PayPalCapture = {
  id?: string;
  status?: string;
  amount?: PayPalAmount;
};

export type PayPalPurchaseUnit = {
  custom_id?: string;
  reference_id?: string;
  amount?: PayPalAmount;
  payments?: {
    captures?: PayPalCapture[];
  };
};

export type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: PayPalPurchaseUnit[];
  payer?: {
    email_address?: string;
    name?: {
      given_name?: string;
      surname?: string;
    };
  };
};

export type PayPalRefund = {
  id?: string;
  status?: string;
};

export class PayPalConfigurationError extends Error {}

export class PayPalAuthenticationError extends Error {}

export class PayPalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly paypalName?: string,
    readonly debugId?: string,
  ) {
    super(message);
  }
}

function getPayPalMode(): "live" | "sandbox" {
  const mode = process.env.PAYPAL_MODE?.toLowerCase();
  if (mode === "live" || mode === "sandbox") return mode;
  throw new PayPalConfigurationError("PAYPAL_MODE debe ser 'sandbox' o 'live'.");
}

export function getPayPalBaseUrl() {
  return getPayPalMode() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const publicClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const mode = getPayPalMode();

  if (!clientId || !clientSecret || !publicClientId) {
    throw new PayPalConfigurationError(
      "Faltan credenciales de PayPal. Configura el Client ID público, el Client ID privado y el Secret.",
    );
  }
  if (clientId !== publicClientId) {
    throw new PayPalConfigurationError(
      "NEXT_PUBLIC_PAYPAL_CLIENT_ID y PAYPAL_CLIENT_ID deben ser el mismo Client ID de PayPal.",
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  let result: PayPalOAuthResponse;
  try {
    result = (await response.json()) as PayPalOAuthResponse;
  } catch {
    throw new PayPalAuthenticationError("PayPal devolvió una respuesta de autenticación inválida.");
  }

  if (!result || typeof result !== "object" || !response.ok || !result.access_token) {
    console.error("PayPal OAuth rechazó las credenciales.", {
      mode,
      status: response.status,
      error: result && typeof result === "object" ? result.error : undefined,
    });
    throw new PayPalAuthenticationError(
      "PayPal rechazó las credenciales. Comprueba que el Client ID, el Secret y PAYPAL_MODE sean de la misma aplicación y entorno.",
    );
  }

  return result.access_token;
}

export async function paypalRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new PayPalApiError(
      "PayPal devolvió una respuesta inválida.",
      response.status,
    );
  }

  if (!response.ok) {
    const error = result && typeof result === "object"
      ? result as PayPalErrorResponse
      : {};
    throw new PayPalApiError(
      error.message ?? "La solicitud a PayPal falló.",
      response.status,
      error.name,
      error.debug_id,
    );
  }

  return result as T;
}
