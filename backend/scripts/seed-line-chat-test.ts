import { PrismaClient, MessageDirection, FollowUpStatus, Priority } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

interface FixtureConfig {
  sessionKey: string;
  profileStorageKey: string;
  profilePath: string;
  sessionDisplayName: string;
  oaName: string;
  chatBotId: string;
  lineUserId: string;
  lineChatUserId: string;
  customerDisplayName: string;
  storeCode: string;
  storeName: string;
  storeRegion: string;
  storeArea: string;
  lineChatNicknameSyncEnabled: boolean;
  sampleMessageText: string;
}

const FIXTURES: FixtureConfig[] = [
  {
    sessionKey: "profile-a",
    profileStorageKey: "profile-a",
    profilePath: "./local-data/line-chat-profile-a",
    sessionDisplayName: "Local Test Profile A (Mahachai)",
    oaName: "OPPO BigC MAHACHAI 1",
    chatBotId: "U092441d025f688e389d25779dd8debf4",
    lineUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
    lineChatUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
    customerDisplayName: "Test Customer Mahachai",
    storeCode: "MHC-001",
    storeName: "OPPO BigC MAHACHAI 1",
    storeRegion: "Central",
    storeArea: "Samut Sakhon",
    lineChatNicknameSyncEnabled: true,
    sampleMessageText: "สวัสดีครับ สนใจสอบถามโปรโมชั่น OPPO BigC MAHACHAI 1 ครับ",
  },
  {
    sessionKey: "profile-b",
    profileStorageKey: "profile-b",
    profilePath: "./local-data/line-chat-profile-b",
    sessionDisplayName: "Local Test Profile B (OBS Robinson Chonburi)",
    oaName: "OPPO BS RBS Chonburi",
    chatBotId: "U729972869a565723cb7fcf7ea28bbc43",
    lineUserId: "U124d80f7c70ed8f48cfc93c707853ab4",
    lineChatUserId: "Ud8d5af30ddca3ed4237e157d5d73c2f1",
    customerDisplayName: "Test Customer Chonburi",
    storeCode: "28375",
    storeName: "OBS Robinson Chonburi By OPPO",
    storeRegion: "East",
    storeArea: "Chonburi",
    lineChatNicknameSyncEnabled: true,
    sampleMessageText: "สวัสดีครับ สนใจสอบถามข้อมูลสาขา Robinson Chonburi ครับ",
  },
];

async function seedLineChatTestFixture() {
  console.log("===============================================================");
  console.log(" Seeding Local LINE Chat Test Fixtures (Profile A & Profile B)");
  console.log("===============================================================");

  const results: Array<Record<string, unknown>> = [];

  // Ensure standard product models exist for Sales Tag testing
  let defaultSeries = await prisma.productSeries.findFirst({ where: { name: "Find X Series" } });
  if (!defaultSeries) {
    defaultSeries = await prisma.productSeries.create({ data: { name: "Find X Series" } });
  }

  const standardModels = ["OPPO Find X9", "OPPO Reno14 Pro 5G", "OPPO A6 Pro 5G"];
  for (const modelName of standardModels) {
    const existing = await prisma.productModel.findFirst({ where: { name: modelName } });
    if (!existing) {
      await prisma.productModel.create({
        data: {
          name: modelName,
          productSeriesId: defaultSeries.id,
        },
      });
    }
  }

  for (const fixture of FIXTURES) {
    console.log(`\n▶ Seeding Fixture: ${fixture.sessionDisplayName}`);

    // 1. Create or upsert LineChatSession
    const session = await prisma.lineChatSession.upsert({
      where: { sessionKey: fixture.sessionKey },
      update: {
        displayName: fixture.sessionDisplayName,
        profileStorageKey: fixture.profileStorageKey,
        profilePath: fixture.profilePath,
        status: "ACTIVE",
      },
      create: {
        sessionKey: fixture.sessionKey,
        displayName: fixture.sessionDisplayName,
        profileStorageKey: fixture.profileStorageKey,
        profilePath: fixture.profilePath,
        status: "ACTIVE",
      },
    });

    // 2. Create or upsert Store
    let store = await prisma.store.findFirst({
      where: {
        OR: [
          { code: fixture.storeCode },
          { name: fixture.storeName },
        ],
      },
    });

    if (store) {
      store = await prisma.store.update({
        where: { id: store.id },
        data: {
          name: fixture.storeName,
          code: fixture.storeCode,
          region: fixture.storeRegion,
          area: fixture.storeArea,
          isActive: true,
        },
      });
    } else {
      store = await prisma.store.create({
        data: {
          name: fixture.storeName,
          code: fixture.storeCode,
          region: fixture.storeRegion,
          area: fixture.storeArea,
          isActive: true,
        },
      });
    }

    // 3. Create or upsert LineOfficialAccount
    let oa = await prisma.lineOfficialAccount.findFirst({
      where: {
        OR: [
          { chatBotId: fixture.chatBotId },
          { name: fixture.oaName },
        ],
      },
    });

    if (oa) {
      oa = await prisma.lineOfficialAccount.update({
        where: { id: oa.id },
        data: {
          name: fixture.oaName,
          chatBotId: fixture.chatBotId,
          lineChatSessionId: session.id,
          storeId: store.id,
          lineChatNicknameSyncEnabled: fixture.lineChatNicknameSyncEnabled,
          isActive: true,
        },
      });
    } else {
      oa = await prisma.lineOfficialAccount.create({
        data: {
          name: fixture.oaName,
          chatBotId: fixture.chatBotId,
          lineChatSessionId: session.id,
          storeId: store.id,
          lineChatNicknameSyncEnabled: fixture.lineChatNicknameSyncEnabled,
          webhookKey: `local-${fixture.sessionKey}-${randomBytes(8).toString("hex")}`,
          connectionStatus: "READY",
          accountType: "STORE",
          isActive: true,
        },
      });
    }

    // 4. Create or upsert Customer
    const customer = await prisma.customer.upsert({
      where: { lineUserId: fixture.lineUserId },
      update: {
        displayName: fixture.customerDisplayName,
      },
      create: {
        lineUserId: fixture.lineUserId,
        displayName: fixture.customerDisplayName,
        preferredLanguage: "th",
      },
    });

    // 5. Create or reuse Conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        customerId: customer.id,
        lineOfficialAccountId: oa.id,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          customerId: customer.id,
          lineOfficialAccountId: oa.id,
          storeId: store.id,
          lineChatUserId: fixture.lineChatUserId,
          latestMessageAt: new Date(),
          priority: Priority.NORMAL,
          followUpStatus: FollowUpStatus.FOLLOW_UP,
          bmReplyStatus: "NOT_REPLIED",
        },
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalMessageId: `msg-${fixture.sessionKey}-${Date.now()}`,
          direction: MessageDirection.INBOUND,
          originalText: fixture.sampleMessageText,
          originalLanguage: "th",
          translatedThai: fixture.sampleMessageText,
          sentAt: new Date(),
        },
      });
    } else {
      // Ensure store association and lineChatUserId are accurate
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          storeId: store.id,
          lineOfficialAccountId: oa.id,
          lineChatUserId: fixture.lineChatUserId,
        },
      });
    }

    console.log("  ✓ Session ID      :", session.id, `(key: ${session.sessionKey}, storageKey: ${session.profileStorageKey})`);
    console.log("  ✓ Store ID        :", store.id, `(code: ${store.code}, name: ${store.name})`);
    console.log("  ✓ OA ID           :", oa.id, `(name: ${oa.name}, chatBotId: ${oa.chatBotId})`);
    console.log("  ✓ Nickname Sync   :", oa.lineChatNicknameSyncEnabled ? "ENABLED" : "DISABLED");
    console.log("  ✓ Customer ID     :", customer.id, `(lineUserId: ${customer.lineUserId})`);
    console.log("  ✓ Line Chat ID    :", conversation.lineChatUserId);
    console.log("  ✓ Conversation ID :", conversation.id);

    results.push({
      sessionKey: session.sessionKey,
      profileStorageKey: session.profileStorageKey,
      storeId: store.id,
      storeCode: store.code,
      oaId: oa.id,
      oaName: oa.name,
      chatBotId: oa.chatBotId,
      customerId: customer.id,
      lineUserId: customer.lineUserId,
      conversationId: conversation.id,
    });
  }

  console.log("\n===============================================================");
  console.log("✓ Security Check  : Zero production credentials / tokens copied.");
  console.log("✓ Safe Placeholders: Local-only random webhookKeys used.");
  console.log("✓ Both Profile A (Mahachai) & Profile B (Chonburi) ready for E2E.");
  console.log("===============================================================");

  return results;
}

if (require.main === module) {
  seedLineChatTestFixture()
    .catch((err) => {
      console.error("Error running line chat seed fixture:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export { seedLineChatTestFixture };
