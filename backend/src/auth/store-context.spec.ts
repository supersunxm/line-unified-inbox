import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import type { AuthUser } from "./auth.guard";
import { StoreAccessService } from "./store-access.service";

describe("StoreAccessService HQ store context", () => {
  let storeFindFirst: jest.Mock;
  let storeFindMany: jest.Mock;
  let service: StoreAccessService;

  const hqUser = (): AuthUser => ({
    id: "hq-1",
    email: "hq@example.com",
    displayName: "HQ User",
    role: UserRole.ADMIN,
    isActive: true,
  });

  beforeEach(() => {
    storeFindFirst = jest.fn();
    storeFindMany = jest.fn();
    const prisma = {
      store: {
        findFirst: storeFindFirst,
        findMany: storeFindMany,
      },
    } as unknown as PrismaService;
    service = new StoreAccessService(prisma);
  });

  it("narrows an HQ user to the selected active store", async () => {
    storeFindFirst.mockResolvedValue({
      id: "store-1",
      name: "RBS Chonburi",
      code: "RBS-CBI",
    });
    const user = hqUser();

    const context = await service.applyStoreContext(user, "store-1");

    expect(context).toEqual({
      mode: "STORE",
      storeId: "store-1",
      storeName: "RBS Chonburi",
      storeCode: "RBS-CBI",
    });
    await expect(service.accessibleStoreIds(user)).resolves.toEqual(["store-1"]);
    await expect(service.assertStoreAccess(user, "store-1")).resolves.toBeUndefined();
    await expect(service.assertStoreAccess(user, "store-2")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a missing or inactive target store", async () => {
    storeFindFirst.mockResolvedValue(null);
    await expect(service.applyStoreContext(hqUser(), "missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects store switching for a normal store user", async () => {
    const user: AuthUser = {
      id: "store-user",
      email: "store@example.com",
      displayName: "Store User",
      role: UserRole.VIEWER,
      isActive: true,
      authorization: {
        version: 2,
        identity: { platformRole: UserRole.VIEWER, membershipRoles: ["BM"] },
        platforms: { web: false, mobile: true },
        workspaces: { hq: false, store: true, mainOa: false },
        scope: { allStores: false, storeIds: ["store-1"] },
        capabilities: { manageAccounts: false, reply: true, accessMainOa: false, manageMainOa: false },
      },
    };

    await expect(service.applyStoreContext(user, "store-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(storeFindFirst).not.toHaveBeenCalled();
  });

  it("lists only active non-archived stores for HQ", async () => {
    storeFindMany.mockResolvedValue([
      { id: "store-1", name: "RBS Chonburi", code: "RBS-CBI" },
      { id: "store-2", name: "OBS Central World", code: "OBS-CW" },
    ]);

    await expect(service.listActAsStoreOptions(hqUser())).resolves.toHaveLength(2);
    expect(storeFindMany).toHaveBeenCalledWith({
      where: { isActive: true, archivedAt: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true },
    });
  });
});
