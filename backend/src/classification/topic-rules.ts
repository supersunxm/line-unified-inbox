import { TopicCategory } from "@prisma/client";

export const topicRules = [
  { name: "Stock Inquiry", category: TopicCategory.SALES, keywords: ["มีของ", "ของเข้า", "สต็อก", "ของหมด", "in stock", "available today", "有货", "现货"] },
  { name: "Price Inquiry", category: TopicCategory.SALES, keywords: ["ราคา", "เท่าไหร่", "กี่บาท", "price", "how much", "多少钱", "价格"] },
  { name: "Installment", category: TopicCategory.PURCHASE_JOURNEY, keywords: ["ผ่อน", "กี่เดือน", "บัตรเครดิต", "installment", "monthly payment", "分期"] },
  { name: "Color Availability", category: TopicCategory.SALES, keywords: ["สีอะไร", "มีสี", "สีขาว", "สีดำ", "color", "colour", "white", "black", "颜色", "白色", "黑色"] },
  { name: "Charging Problem", category: TopicCategory.AFTER_SALES, keywords: ["ชาร์จไม่เข้า", "ชาร์จไม่ได้", "not charging", "won't charge", "无法充电", "充不了电"] },
  { name: "Repair", category: TopicCategory.AFTER_SALES, keywords: ["ซ่อม", "จอแตก", "เสีย", "พัง", "เปิดไม่ติด", "repair", "broken", "维修"] },
  { name: "Service Center", category: TopicCategory.AFTER_SALES, keywords: ["ศูนย์บริการ", "service center", "服务中心"] },
  { name: "Warranty", category: TopicCategory.AFTER_SALES, keywords: ["รับประกัน", "ประกัน", "warranty", "保修"] },
  { name: "Claim", category: TopicCategory.AFTER_SALES, keywords: ["เคลม", "claim"] },
  { name: "Spare Parts", category: TopicCategory.AFTER_SALES, keywords: ["อะไหล่", "spare part"] },
  { name: "Software Support", category: TopicCategory.AFTER_SALES, keywords: ["coloros", "อัปเดต", "software update"] },
  { name: "Data Transfer", category: TopicCategory.AFTER_SALES, keywords: ["ย้ายข้อมูล", "โอนข้อมูล", "clone phone", "transfer data"] },
  { name: "Trade-in", category: TopicCategory.PURCHASE_JOURNEY, keywords: ["เทิร์นเครื่อง", "trade-in", "trade in"] },
  { name: "Promotion", category: TopicCategory.SALES, keywords: ["โปรโมชั่น", "โปร", "promotion", "discount", "促销", "优惠"] },
  { name: "Model Comparison", category: TopicCategory.SALES, keywords: ["เทียบ", "ต่างกัน", "compare", "difference", "对比", "区别"] },
  { name: "Recommendation", category: TopicCategory.SALES, keywords: ["แนะนำ", "รุ่นไหนดี", "recommend", "which model", "推荐", "哪款"] },
  { name: "Complaint", category: TopicCategory.COMPLAINT, keywords: ["ร้องเรียน", "แย่มาก", "refund", "complaint", "投诉", "退款"] },
  { name: "Greeting", category: TopicCategory.GENERAL, keywords: ["สวัสดี", "hello", "hi ", "你好", "您好"] },
  { name: "Test Message", category: TopicCategory.GENERAL, keywords: ["ทดสอบ", "test message", "测试"] },
] as const;

export const criticalKeywords = ["แบตบวม", "ไฟไหม้", "ควัน", "ฟ้อง", "battery swelling", "fire", "smoke", "legal action", "电池膨胀", "起火", "冒烟", "起诉"];
