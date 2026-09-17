import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { AuthUser } from "../auth/auth.guard";
import { AuditLogService } from "../auth/audit-log.service";
import { createMediaPublicUrl } from "../media/media-public-url";
import { MediaStorageService } from "../media/media-storage";
import { PrismaService } from "../prisma.service";
import type {
  CreateRichMessageDto,
  RichMessageAction,
  RichMessageRecord,
  RichMessageResponseDto,
  UpdateRichMessageDto,
} from "./rich-message.types";

const sharp = require("sharp") as typeof import("sharp").default;
const IMAGEMAP_WIDTH = 1040;
const ALLOWED_IMAGE_WIDTHS = new Set([240, 300, 460, 700, 1040]);
const PUBLIC_IMAGE_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class RichMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(params?: { search?: string; includeInactive?: boolean }) {
    const search = params?.search?.trim();
    const includeInactive = params?.includeInactive === true;
    const rows = search
      ? await this.prisma.$queryRaw<RichMessageRecord[]>(Prisma.sql`
          SELECT * FROM "RichMessage"
          WHERE (${includeInactive} OR "isActive" = true)
            AND ("name" ILIKE ${`%${search}%`} OR COALESCE("description", '') ILIKE ${`%${search}%`})
          ORDER BY "updatedAt" DESC, "createdAt" DESC
        `)
      : await this.prisma.$queryRaw<RichMessageRecord[]>(Prisma.sql`
          SELECT * FROM "RichMessage"
          WHERE (${includeInactive} OR "isActive" = true)
          ORDER BY "updatedAt" DESC, "createdAt" DESC
        `);
    return rows.map((row) => this.serialize(row));
  }

  async get(id: string) {
    return this.serialize(await this.requireRecord(id));
  }

  async create(dto: CreateRichMessageDto, user?: AuthUser) {
    const normalized = this.validateAndNormalize(dto);
    const id = randomUUID();
    const now = new Date();
    const actionsJson = JSON.stringify(normalized.actions);

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "RichMessage" (
        "id", "name", "description", "altText", "mediaObjectKey", "previewObjectKey",
        "baseWidth", "baseHeight", "actionsJson", "isActive", "createdByUserId", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${normalized.name}, ${normalized.description}, ${normalized.altText},
        ${normalized.mediaObjectKey}, ${normalized.previewObjectKey}, ${normalized.baseWidth},
        ${normalized.baseHeight}, CAST(${actionsJson} AS JSONB), ${normalized.isActive},
        ${user?.id ?? null}, ${now}, ${now}
      )
    `);

    if (user) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "RICH_MESSAGE_CREATED",
        metadata: { richMessageId: id, name: normalized.name },
      }).catch(() => null);
    }

    return this.get(id);
  }

  async update(id: string, dto: UpdateRichMessageDto, user?: AuthUser) {
    const current = await this.requireRecord(id);
    const currentActions = this.parseActions(current.actionsJson);
    const normalized = this.validateAndNormalize({
      name: dto.name ?? current.name,
      description: dto.description !== undefined ? dto.description : current.description,
      altText: dto.altText ?? current.altText,
      mediaObjectKey: dto.mediaObjectKey ?? current.mediaObjectKey,
      previewObjectKey: dto.previewObjectKey !== undefined ? dto.previewObjectKey : current.previewObjectKey,
      baseWidth: dto.baseWidth ?? current.baseWidth,
      baseHeight: dto.baseHeight ?? current.baseHeight,
      actions: dto.actions ?? currentActions,
      isActive: dto.isActive ?? current.isActive,
    });
    const actionsJson = JSON.stringify(normalized.actions);
    const now = new Date();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "RichMessage" SET
        "name" = ${normalized.name},
        "description" = ${normalized.description},
        "altText" = ${normalized.altText},
        "mediaObjectKey" = ${normalized.mediaObjectKey},
        "previewObjectKey" = ${normalized.previewObjectKey},
        "baseWidth" = ${normalized.baseWidth},
        "baseHeight" = ${normalized.baseHeight},
        "actionsJson" = CAST(${actionsJson} AS JSONB),
        "isActive" = ${normalized.isActive},
        "updatedAt" = ${now}
      WHERE "id" = ${id}
    `);

    if (user) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "RICH_MESSAGE_UPDATED",
        metadata: { richMessageId: id, name: normalized.name },
      }).catch(() => null);
    }

    return this.get(id);
  }

  async setActive(id: string, isActive: boolean, user?: AuthUser) {
    await this.requireRecord(id);
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "RichMessage"
      SET "isActive" = ${isActive}, "updatedAt" = ${new Date()}
      WHERE "id" = ${id}
    `);
    if (user) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: isActive ? "RICH_MESSAGE_ACTIVATED" : "RICH_MESSAGE_DEACTIVATED",
        metadata: { richMessageId: id },
      }).catch(() => null);
    }
    return this.get(id);
  }

  async buildLineImagemap(id: string) {
    const record = await this.requireRecord(id);
    if (!record.isActive) {
      throw new BadRequestException("Selected Rich Message is inactive");
    }
    const actions = this.parseActions(record.actionsJson);
    return {
      type: "imagemap",
      baseUrl: this.createImagemapBaseUrl(record.id),
      altText: record.altText,
      baseSize: { width: record.baseWidth, height: record.baseHeight },
      actions: actions.map((action) => {
        if (action.type === "URI") {
          return {
            type: "uri",
            linkUri: action.value,
            area: action.area,
          };
        }
        return {
          type: "message",
          text: action.value,
          area: action.area,
        };
      }),
    };
  }

  async renderImagemapImage(id: string, expires: string, signature: string, size: number) {
    if (!ALLOWED_IMAGE_WIDTHS.has(size)) {
      throw new NotFoundException("Rich Message image is unavailable");
    }
    if (!this.verifyImageSignature(id, expires, signature)) {
      throw new NotFoundException("Rich Message image is unavailable");
    }
    const record = await this.requireRecord(id);
    const stored = await this.storage.get(record.mediaObjectKey).catch(() => null);
    if (!stored) throw new NotFoundException("Rich Message image is unavailable");

    const targetHeight = Math.max(1, Math.round((record.baseHeight / record.baseWidth) * size));
    const body = await sharp(stored.body)
      .resize({ width: size, height: targetHeight, fit: "fill" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return { body, contentType: "image/jpeg" };
  }

  private async requireRecord(id: string) {
    const rows = await this.prisma.$queryRaw<RichMessageRecord[]>(Prisma.sql`
      SELECT * FROM "RichMessage" WHERE "id" = ${id} LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException(`Rich Message with ID '${id}' not found`);
    return rows[0];
  }

  private serialize(record: RichMessageRecord): RichMessageResponseDto {
    const actions = this.parseActions(record.actionsJson);
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      altText: record.altText,
      mediaObjectKey: record.mediaObjectKey,
      previewObjectKey: record.previewObjectKey,
      imageUrl: createMediaPublicUrl(record.mediaObjectKey),
      previewUrl: createMediaPublicUrl(record.previewObjectKey || record.mediaObjectKey),
      baseWidth: record.baseWidth,
      baseHeight: record.baseHeight,
      actions,
      isActive: record.isActive,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private parseActions(value: unknown): RichMessageAction[] {
    if (Array.isArray(value)) return value as RichMessageAction[];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed as RichMessageAction[] : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private validateAndNormalize(dto: CreateRichMessageDto) {
    const name = dto.name?.trim();
    const altText = dto.altText?.trim();
    const mediaObjectKey = dto.mediaObjectKey?.trim();
    const baseWidth = dto.baseWidth ?? IMAGEMAP_WIDTH;
    const baseHeight = dto.baseHeight ?? IMAGEMAP_WIDTH;
    const actions = Array.isArray(dto.actions) ? dto.actions : [];

    if (!name) throw new BadRequestException("Rich Message name is required");
    if (!altText) throw new BadRequestException("Rich Message alt text is required");
    if (altText.length > 400) throw new BadRequestException("Rich Message alt text cannot exceed 400 characters");
    if (!mediaObjectKey || !mediaObjectKey.startsWith("line-media/greeting/")) {
      throw new BadRequestException("A valid uploaded Rich Message image is required");
    }
    if (baseWidth !== IMAGEMAP_WIDTH) {
      throw new BadRequestException("Rich Message base width must be 1040 pixels");
    }
    if (!Number.isInteger(baseHeight) || baseHeight < 1 || baseHeight > 1040) {
      throw new BadRequestException("Rich Message base height must be between 1 and 1040 pixels");
    }
    if (actions.length < 1 || actions.length > 50) {
      throw new BadRequestException("Rich Message must contain between 1 and 50 tappable areas");
    }

    const normalizedActions = actions.map((action, index) => {
      const value = action?.value?.trim();
      if (!action || (action.type !== "URI" && action.type !== "MESSAGE") || !value) {
        throw new BadRequestException(`Rich Message action #${index + 1} is invalid`);
      }
      const area = action.area;
      if (!area || ![area.x, area.y, area.width, area.height].every(Number.isInteger)) {
        throw new BadRequestException(`Rich Message action #${index + 1} has an invalid area`);
      }
      if (area.x < 0 || area.y < 0 || area.width < 1 || area.height < 1 || area.x + area.width > baseWidth || area.y + area.height > baseHeight) {
        throw new BadRequestException(`Rich Message action #${index + 1} exceeds the image bounds`);
      }
      if (action.type === "MESSAGE" && value.length > 400) {
        throw new BadRequestException(`Rich Message action #${index + 1} message cannot exceed 400 characters`);
      }
      return {
        id: action.id?.trim() || randomUUID(),
        type: action.type,
        label: action.label?.trim() || undefined,
        value,
        area: { ...area },
      } satisfies RichMessageAction;
    });

    return {
      name,
      description: dto.description?.trim() || null,
      altText,
      mediaObjectKey,
      previewObjectKey: dto.previewObjectKey?.trim() || null,
      baseWidth,
      baseHeight,
      actions: normalizedActions,
      isActive: dto.isActive !== false,
    };
  }

  private imageSecret() {
    return process.env.LINE_CREDENTIAL_ENCRYPTION_KEY?.trim() || "development-rich-message-secret";
  }

  private imageSignature(id: string, expires: string) {
    return createHmac("sha256", this.imageSecret()).update(`${id}.${expires}`).digest("hex");
  }

  private createImagemapBaseUrl(id: string) {
    const rawBase = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
    if (process.env.NODE_ENV === "production" && (!rawBase || !rawBase.startsWith("https://"))) {
      throw new Error("PUBLIC_WEBHOOK_BASE_URL must be a valid public HTTPS URL in production");
    }
    const base = (rawBase || "http://localhost:3001").replace(/\/$/, "");
    const expires = String(Math.floor(Date.now() / 1000) + PUBLIC_IMAGE_TTL_SECONDS);
    const signature = this.imageSignature(id, expires);
    return `${base}/rich-messages/public/${encodeURIComponent(id)}/image/${expires}/${signature}`;
  }

  private verifyImageSignature(id: string, expires: string, provided: string) {
    if (!/^\d+$/.test(expires) || Number(expires) < Math.floor(Date.now() / 1000)) return false;
    if (!provided) return false;
    const expected = Buffer.from(this.imageSignature(id, expires));
    const actual = Buffer.from(provided);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
