export type RichMessageAction = {
  id: string;
  type: "URI" | "MESSAGE";
  label?: string;
  value: string;
  area: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type CreateRichMessageDto = {
  name: string;
  description?: string | null;
  altText: string;
  mediaObjectKey: string;
  previewObjectKey?: string | null;
  baseWidth?: number;
  baseHeight?: number;
  actions: RichMessageAction[];
  isActive?: boolean;
};

export type UpdateRichMessageDto = Partial<CreateRichMessageDto>;

export type RichMessageRecord = {
  id: string;
  name: string;
  description: string | null;
  altText: string;
  mediaObjectKey: string;
  previewObjectKey: string | null;
  baseWidth: number;
  baseHeight: number;
  actionsJson: unknown;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RichMessageResponseDto = {
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
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
