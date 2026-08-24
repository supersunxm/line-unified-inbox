export type RegistrationStore = {
  id: string;
  name: string;
  code: string | null;
};

export type StoreRegistrationRole = "STAFF" | "STORE_MANAGER";

export type StoreRegistrationInput = {
  name: string;
  employeeId: string;
  email: string;
  storeId: string;
  role: StoreRegistrationRole;
  password: string;
};

type RegistrationResponse = {
  registrationId: string;
  userId: string;
  status: "PENDING_APPROVAL" | string;
};

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api-backend${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {
      // Public registration errors are not guaranteed to be JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const registrationApi = {
  stores: async () => {
    const result = await publicRequest<{ stores: RegistrationStore[] }>("/registration/stores", { cache: "no-store" });
    return result.stores;
  },
  register: (input: StoreRegistrationInput) => publicRequest<RegistrationResponse>("/registration/request", {
    method: "POST",
    body: JSON.stringify(input),
  }),
};
