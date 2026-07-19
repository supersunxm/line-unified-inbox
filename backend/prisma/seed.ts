import { ActivityActionType, FollowUpStatus, MessageDirection, PrismaClient, Priority, ProductRelationship, PurchaseIntent, TopicCategory } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const conversationSeeds = [
  { customer: "Somchai Fictional", store: 0, model: "OPPO Reno16 Pro 5G", topics: ["Stock Inquiry", "Installment"], status: FollowUpStatus.FOLLOW_UP, priority: Priority.HIGH, language: "th", original: "Reno16 Pro สีขาวมีของไหมครับ แล้วสามารถผ่อนได้กี่เดือน", en: "Is the white Reno16 Pro in stock? How many months can I pay in installments?", zh: "白色的 Reno16 Pro 有现货吗？可以分期多少个月？" },
  { customer: "Nattaya Fictional", store: 1, model: "OPPO A6 Pro 5G", topics: ["Charging Problem", "After-sales"], status: FollowUpStatus.REMINDED, priority: Priority.CRITICAL, language: "th", original: "A6 Pro ชาร์จไม่เข้า ต้องทำอย่างไร", en: "My A6 Pro is not charging. What should I do?", zh: "我的 A6 Pro 无法充电，请问应该怎么办？" },
  { customer: "Li Wei Fictional", store: 2, model: "OPPO Find X9", topics: ["Installment"], status: FollowUpStatus.ACKNOWLEDGED, priority: Priority.NORMAL, language: "zh", original: "请问 Find X9 可以分期付款吗？", en: "Can the Find X9 be purchased with an installment plan?", zh: "请问 Find X9 可以分期付款吗？" },
  { customer: "Arisa Fictional", store: 3, model: "OPPO Reno16 Pro 5G", topics: ["Camera Feature", "Stock Inquiry"], status: FollowUpStatus.COMPLETED, priority: Priority.NORMAL, language: "th", original: "กล้องซูมได้กี่เท่าและมีสินค้าหรือยัง", en: "How far can the camera zoom, and is it available?", zh: "相机支持多少倍变焦？现在有货吗？" },
  { customer: "Chen Yu Fictional", store: 0, model: "OPPO Find X9", topics: ["Complaint", "After-sales"], status: FollowUpStatus.ESCALATED, priority: Priority.CRITICAL, language: "zh", original: "手机维修后问题还没有解决", en: "The issue remains after my phone was repaired.", zh: "手机维修后问题还没有解决。" },
  { customer: "Ploy Fictional", store: 1, model: "OPPO Pad 3", topics: ["Product Feature"], status: FollowUpStatus.FOLLOW_UP, priority: Priority.LOW, language: "th", original: "OPPO Pad ใช้ปากการุ่นไหนได้บ้าง", en: "Which stylus works with the OPPO Pad?", zh: "OPPO Pad 支持哪些手写笔？" },
  { customer: "Somchai Fictional", store: 2, model: "OPPO Watch X2", topics: ["Product Feature", "Price Inquiry"], status: FollowUpStatus.REMINDED, priority: Priority.HIGH, language: "th", original: "Watch X2 ราคาเท่าไร วัดสุขภาพอะไรได้บ้าง", en: "How much is Watch X2 and what health metrics can it track?", zh: "Watch X2 多少钱？支持哪些健康监测？" },
  { customer: "Nattaya Fictional", store: 3, model: "OPPO Enco Air4", topics: ["Stock Inquiry"], status: FollowUpStatus.COMPLETED, priority: Priority.NORMAL, language: "th", original: "Enco Air4 สีขาวมีของไหมคะ", en: "Is the white Enco Air4 available?", zh: "白色 Enco Air4 有货吗？" },
] as const;

async function main() {
  await prisma.webhookEvent.deleteMany();
  await prisma.activityHistory.deleteMany(); await prisma.internalNote.deleteMany(); await prisma.message.deleteMany();
  await prisma.conversationProduct.deleteMany(); await prisma.conversationTopic.deleteMany(); await prisma.conversation.deleteMany();
  await prisma.customer.deleteMany(); await prisma.lineOfficialAccount.deleteMany(); await prisma.store.deleteMany();
  await prisma.productModel.deleteMany(); await prisma.productSeries.deleteMany(); await prisma.topic.deleteMany();

  const storeNames = ["OPPO Central Pinklao", "OPPO One Bangkok", "OPPO Siam Paragon", "OPPO CentralWorld"];
  const stores = await Promise.all(storeNames.map((name, index) => prisma.store.create({ data: { name, code: `BKK-${String(index + 1).padStart(3, "0")}`, region: "Bangkok", area: index < 2 ? "West/Central" : "Central" } })));
  const accounts = await Promise.all(stores.map((store, index) => prisma.lineOfficialAccount.create({ data: { name: `${store.name} LINE OA`, webhookKey: randomBytes(24).toString("base64url"), basicId: `@oppo-demo-${index + 1}`, storeId: store.id, connectionStatus: "NOT_CONFIGURED" } })));
  const customerNames = ["Somchai Fictional", "Nattaya Fictional", "Li Wei Fictional", "Arisa Fictional", "Chen Yu Fictional", "Ploy Fictional"];
  const customers = await Promise.all(customerNames.map((displayName, index) => prisma.customer.create({ data: { displayName, lineUserId: `fictional-line-user-${index + 1}`, preferredLanguage: index === 2 || index === 4 ? "zh" : "th" } })));

  const seriesNames = ["Find N Series", "Find X Series", "Reno Series", "A Series", "OPPO Pad", "OPPO Watch", "OPPO Enco", "Accessories"];
  const series = new Map<string, string>();
  for (const name of seriesNames) { const item = await prisma.productSeries.create({ data: { name } }); series.set(name, item.id); }
  const modelDefinitions = [["OPPO Reno16 Pro 5G", "Reno Series"], ["OPPO A6 Pro 5G", "A Series"], ["OPPO Find X9", "Find X Series"], ["OPPO Pad 3", "OPPO Pad"], ["OPPO Watch X2", "OPPO Watch"], ["OPPO Enco Air4", "OPPO Enco"]] as const;
  const models = new Map<string, string>();
  for (const [name, seriesName] of modelDefinitions) { const item = await prisma.productModel.create({ data: { name, productSeriesId: series.get(seriesName)! } }); models.set(name, item.id); }
  const aliases = [["OPPO Reno16 Pro 5G", ["Reno 16", "Reno16", "Reno 16 Pro", "Reno16 Pro"]], ["OPPO A6 Pro 5G", ["A6 Pro", "A6Pro"]], ["OPPO Find X9", ["Find X9", "FindX9"]], ["OPPO Pad 3", ["OPPO Pad", "Pad 3"]]] as const;
  for (const [modelName, values] of aliases) for (const alias of values) await prisma.productAlias.create({ data: { productModelId: models.get(modelName)!, alias, normalizedAlias: alias.toLocaleLowerCase().replace(/[\s_-]+/g, "").replace(/oppo/g, "") } });
  const topicDefinitions = [["Stock Inquiry", TopicCategory.SALES], ["Installment", TopicCategory.PURCHASE_JOURNEY], ["Charging Problem", TopicCategory.AFTER_SALES], ["After-sales", TopicCategory.AFTER_SALES], ["Camera Feature", TopicCategory.PRODUCT_FEATURE], ["Complaint", TopicCategory.COMPLAINT], ["Product Feature", TopicCategory.PRODUCT_FEATURE], ["Price Inquiry", TopicCategory.SALES]] as const;
  const topics = new Map<string, string>();
  for (const [name, category] of topicDefinitions) { const item = await prisma.topic.create({ data: { name, category } }); topics.set(name, item.id); }

  for (const [index, seed] of conversationSeeds.entries()) {
    const customer = customers.find((item) => item.displayName === seed.customer)!;
    const latestMessageAt = new Date(Date.now() - (index + 1) * 12 * 60_000);
    const conversation = await prisma.conversation.create({ data: { customerId: customer.id, storeId: stores[seed.store].id, lineOfficialAccountId: accounts[seed.store].id, latestMessageAt, priority: seed.priority, followUpStatus: seed.status, productRelationship: index % 3 === 1 ? ProductRelationship.CURRENT_OWNER : ProductRelationship.INTERESTED, purchaseIntent: index % 3 === 1 ? PurchaseIntent.AFTER_SALES : index % 2 === 0 ? PurchaseIntent.HIGH : PurchaseIntent.MEDIUM } });
    await prisma.message.create({ data: { conversationId: conversation.id, externalMessageId: `fictional-message-${index + 1}`, direction: MessageDirection.INBOUND, originalText: seed.original, originalLanguage: seed.language, translatedThai: seed.language === "th" ? seed.original : `คำแปลตัวอย่าง: ${seed.en}`, translatedEnglish: seed.en, translatedChinese: seed.zh, sentAt: latestMessageAt } });
    await prisma.conversationProduct.create({ data: { conversationId: conversation.id, productModelId: models.get(seed.model)!, confidence: 0.95, source: "SEED" } });
    for (const topic of seed.topics) await prisma.conversationTopic.create({ data: { conversationId: conversation.id, topicId: topics.get(topic)!, confidence: 0.9, source: "SEED" } });
    if (index % 3 === 0) await prisma.internalNote.create({ data: { conversationId: conversation.id, content: "Fictional seed note for store follow-up", createdByName: "Demo Specialist" } });
    if (seed.status !== FollowUpStatus.FOLLOW_UP) await prisma.activityHistory.create({ data: { conversationId: conversation.id, actionType: ActivityActionType.STATUS_CHANGED, previousStatus: FollowUpStatus.FOLLOW_UP, newStatus: seed.status, createdByName: "Demo Specialist", createdAt: new Date(latestMessageAt.getTime() + 60_000) } });
  }
}

void main().finally(async () => prisma.$disconnect());
