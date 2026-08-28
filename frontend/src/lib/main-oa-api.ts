export type MainOaAccount = {
  id: string;
  name: string;
  basicId: string | null;
  channelId: string | null;
  destinationId: string | null;
  connectionStatus: string;
  isActive: boolean;
  lastWebhookReceivedAt: string | null;
  lastConnectionTestAt: string | null;
  lastConnectionError: string | null;
  webhookUrl: string | null;
  credentialMode: "STATELESS";
  tokenManagedAutomatically: boolean;
  _count?: { conversations: number };
};

export type CreateMainOaResult = MainOaAccount & {
  accountType: "HEAD_OFFICE";
  tokenExpiresInSeconds: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api-backend${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch { /* ignore non-JSON error body */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function getMainOaAccounts() {
  return request<MainOaAccount[]>("/main-oa/accounts", { cache: "no-store" });
}

export function createMainOaAccount(input: { name: string; channelId: string; channelSecret: string }) {
  return request<CreateMainOaResult>("/main-oa/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
