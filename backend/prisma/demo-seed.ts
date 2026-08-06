import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REGIONS = ["Central", "North", "South", "East", "Northeast"];
const STORE_PREFIXES = ["Robinson", "Central", "The Mall", "Lotus", "Big C", "OPPO Brand Shop"];
const THAI_CITIES = [
  "Chonburi", "Salaya", "Bangna", "Rama 9", "Chiang Mai", "Phuket",
  "Khon Kaen", "Pattaya", "Hat Yai", "Korat", "Rayong", "Udorn",
];

async function main() {
  console.log("=== STARTING DEMO SEED (142 STORES & 5,000 CONVERSATIONS) ===");

  // 1. Create or upsert 142Stores
  console.log("Generating 142 retail stores...");
  const storesToCreate = Array.from({ length: 142 }).map((_, i) => {
    const prefix = STORE_PREFIXES[i % STORE_PREFIXES.length];
    const city = THAI_CITIES[i % THAI_CITIES.length];
    const region = REGIONS[i % REGIONS.length];
    return {
      id: `demo_store_${i + 1}`,
      name: `${prefix} ${city} #${i + 1}`,
      region,
      isActive: true,
    };
  });

  for (const st of storesToCreate) {
    await prisma.store.upsert({
      where: { id: st.id },
      update: { name: st.name, region: st.region, isActive: true },
      create: st,
    });
  }

  // 2. Create Demo LineOfficialAccount and Customer
  const demoCustomer = await prisma.customer.upsert({
    where: { id: "demo_customer_main" },
    update: { displayName: "Demo Customer" },
    create: {
      id: "demo_customer_main",
      displayName: "Demo Customer",
    },
  });

  const demoOa = await prisma.lineOfficialAccount.upsert({
    where: { id: "demo_oa_main" },
    update: { name: "OPPO Thailand Main OA" },
    create: {
      id: "demo_oa_main",
      webhookKey: "demo_webhook_key_main",
      name: "OPPO Thailand Main OA",
      storeId: storesToCreate[0].id,
    },
  });

  // 3. Generate 5,000 realistic conversations in batch chunks
  console.log("Generating 5,000 demo conversations with realistic SLA & operation efficiency metrics...");

  const chunkSize = 500;
  const totalConvs = 5000;

  for (let chunk = 0; chunk < totalConvs; chunk += chunkSize) {
    const convData = Array.from({ length: chunkSize }).map((_, i) => {
      const idx = chunk + i;
      const storeId = storesToCreate[idx % 142].id;

      // Distribution: 65% REPLIED, 20% NOTIFIED_BM, 15% NOT_REPLIED
      const bmReplyStatus =
        idx % 100 < 65 ? "REPLIED" : idx % 100 < 85 ? "NOTIFIED_BM" : "NOT_REPLIED";

      const followUpStatus = bmReplyStatus === "REPLIED" ? "COMPLETED" : "FOLLOW_UP";
      const priority = idx % 10 === 0 ? "CRITICAL" : idx % 5 === 0 ? "HIGH" : "NORMAL";

      // Time distribution: past 24 hours
      const hoursAgo = idx % 24;
      const createdAt = new Date(Date.now() - hoursAgo * 3600 * 1000);

      return {
        id: `demo_conv_${idx + 1}`,
        storeId,
        customerId: demoCustomer.id,
        lineOfficialAccountId: demoOa.id,
        bmReplyStatus,
        followUpStatus,
        priority,
        createdAt,
        latestMessageAt: createdAt,
      };
    });

    for (const c of convData) {
      await prisma.conversation.upsert({
        where: { id: c.id },
        update: {
          storeId: c.storeId,
          bmReplyStatus: c.bmReplyStatus as any,
          followUpStatus: c.followUpStatus as any,
          priority: c.priority as any,
          createdAt: c.createdAt,
          latestMessageAt: c.latestMessageAt,
        },
        create: c as any,
      });
    }
  }

  console.log("=== DEMO SEED COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
