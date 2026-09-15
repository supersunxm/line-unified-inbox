export type RichMessageAction = {
  id: string;
  type: "URI" | "MESSAGE";
  label?: string;
  value: string;
  area: { x: number; y: number; width: number; height: number };
};

export type RichMessage = {
  id: string;
  name: string;
  description: string | null;
  altText: string;
  mediaObjectKey: string;
  previewObjectKey: string | null;
  imageUrl: string;
  previewUrl: string;
  baseWidth: number;
  baseHeight: number;
  actions: RichMessageAction[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GreetingMediaUpload = {
  mediaObjectKey: string;
  previewObjectKey: string;
  imageUrl: string;
  previewUrl: string;
  width?: number;
  height?: number;
};

async function richRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api-backend${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const richMessageApi = {
  list: (includeInactive = false) =>
    richRequest<RichMessage[]>(`/rich-messages?includeInactive=${includeInactive ? "true" : "false"}`),
  create: (payload: {
    name: string;
    description?: string;
    altText: string;
    mediaObjectKey: string;
    previewObjectKey?: string;
    baseWidth: number;
    baseHeight: number;
    actions: RichMessageAction[];
  }) => richRequest<RichMessage>("/rich-messages", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<{
    name: string;
    description: string | null;
    altText: string;
    mediaObjectKey: string;
    previewObjectKey: string | null;
    baseWidth: number;
    baseHeight: number;
    actions: RichMessageAction[];
    isActive: boolean;
  }>) => richRequest<RichMessage>(`/rich-messages/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  setActive: (id: string, active: boolean) =>
    richRequest<RichMessage>(`/rich-messages/${encodeURIComponent(id)}/${active ? "activate" : "deactivate"}`, { method: "POST" }),
  uploadImage: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return richRequest<GreetingMediaUpload>("/greeting-messages/media", { method: "POST", body: form });
  },
};
