import { pickLanguageText, type AppLanguage } from "../language-utils.ts";

export const review15Translations = {
  "title": {
    "th": "ตรวจสอบรีวิว 15 คำ",
    "en": "15-word review checker",
    "zh": "15词评论检查"
  },
  "home": {
    "th": "หน้าแรก OPPO Brand Shop",
    "en": "OPPO Brand Shop home",
    "zh": "OPPO Brand Shop 首页"
  },
  "stores": {
    "th": "ค้นหาสาขา & ช่องทางติดต่อ",
    "en": "Find stores and contact details",
    "zh": "查找门店及联系方式"
  },
  "subtitle": {
    "th": "พิมพ์ข้อความ หรือสแกน Screenshot จาก Google Reviews",
    "en": "Type a review or scan a Google Reviews screenshot",
    "zh": "输入评论或扫描 Google Reviews 截图"
  },
  "reviewText": {
    "th": "ข้อความรีวิวลูกค้า",
    "en": "Customer review text",
    "zh": "客户评论内容"
  },
  "placeholder": {
    "th": "วางข้อความรีวิวที่นี่...",
    "en": "Paste a review here...",
    "zh": "在此粘贴评论…"
  },
  "clear": {
    "th": "ล้างข้อความ",
    "en": "Clear text",
    "zh": "清空内容"
  },
  "random": {
    "th": "สุ่มข้อความตัวอย่าง",
    "en": "Random example",
    "zh": "随机示例"
  },
  "exampleCount": {
    "th": "มีตัวอย่าง {count} รูปแบบ · กดซ้ำเพื่อสุ่มข้อความใหม่",
    "en": "{count} examples · Tap again for another example",
    "zh": "共{count}种示例 · 再次点击随机选择"
  },
  "wordTarget": {
    "th": "/ {count} คำ",
    "en": "/ {count} words",
    "zh": "/ {count}词"
  },
  "start": {
    "th": "วางข้อความเพื่อเริ่มตรวจ",
    "en": "Paste text to start checking",
    "zh": "粘贴内容开始检查"
  },
  "passed": {
    "th": "ครบ 15 คำแล้ว",
    "en": "15-word minimum met",
    "zh": "已达到15词要求"
  },
  "passDescription": {
    "th": "ข้อความนี้ผ่านเกณฑ์จำนวนคำ",
    "en": "This review meets the word-count requirement",
    "zh": "此评论符合词数要求"
  },
  "notPassed": {
    "th": "ยังไม่ครบ 15 คำ",
    "en": "Fewer than 15 words",
    "zh": "尚未达到15词"
  },
  "remaining": {
    "th": "ขาดอีก {count} คำ",
    "en": "{count} more words needed",
    "zh": "还需{count}词"
  },
  "countedWords": {
    "th": "คำที่ระบบนับ",
    "en": "Counted words",
    "zh": "已计入的词"
  },
  "wordCount": {
    "th": " ({count} คำ)",
    "en": " ({count} words)",
    "zh": "（{count}词）"
  },
  "accordingToRules": {
    "th": "ตามกฎ Review KPI",
    "en": "Under Review KPI rules",
    "zh": "按 Review KPI 规则"
  },
  "tokensEmpty": {
    "th": "คำที่ผ่านกฎการนับจะแสดงที่นี่",
    "en": "Words that meet the counting rules appear here",
    "zh": "符合计数规则的词将显示在此处"
  },
  "invalidImage": {
    "th": "กรุณาเลือกไฟล์ภาพ JPG / PNG ขนาดไม่เกิน 12 MB",
    "en": "Choose a JPG / PNG image up to 12 MB",
    "zh": "请选择不超过12 MB的 JPG / PNG 图片"
  },
  "imageLimit": {
    "th": "สแกนได้ครั้งละไม่เกิน 3 ภาพ ระบบเลือก 3 ภาพแรกให้แล้ว",
    "en": "Up to 3 images per scan. The first 3 were selected.",
    "zh": "每次最多扫描3张图片，已选取前3张。"
  },
  "imagesSkipped": {
    "th": "มีบางไฟล์ที่ไม่ใช่ภาพหรือมีขนาดเกิน 12 MB จึงไม่ได้ถูกเลือก",
    "en": "Some files were skipped because they are not images or exceed 12 MB",
    "zh": "部分文件不是图片或超过12 MB，已跳过"
  },
  "preparing": {
    "th": "กำลังเตรียมภาพ...",
    "en": "Preparing images...",
    "zh": "正在准备图片…"
  },
  "preparingImage": {
    "th": "กำลังเตรียมภาพ {index} จาก {total}",
    "en": "Preparing image {index} of {total}",
    "zh": "正在准备第{index}张图片，共{total}张"
  },
  "sending": {
    "th": "กำลังส่งภาพไปวิเคราะห์...",
    "en": "Sending images for analysis...",
    "zh": "正在发送图片进行分析…"
  },
  "rateLimit": {
    "th": "สแกนถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
    "en": "Too many scans. Wait a moment and try again.",
    "zh": "扫描过于频繁，请稍后重试。"
  },
  "unavailable": {
    "th": "ระบบ Google Vision ยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง",
    "en": "Google Vision is unavailable. Try again later.",
    "zh": "Google Vision 暂不可用，请稍后重试。"
  },
  "imageReadError": {
    "th": "อ่านภาพไม่สำเร็จ",
    "en": "Unable to read image",
    "zh": "无法读取图片"
  },
  "extracting": {
    "th": "กำลังแยกเฉพาะข้อความรีวิว...",
    "en": "Extracting review text...",
    "zh": "正在提取评论内容…"
  },
  "imageName": {
    "th": "ภาพ {index}",
    "en": "Image {index}",
    "zh": "图片{index}"
  },
  "extracted": {
    "th": "แยกข้อความได้ {count} จากประมาณ {total} รีวิว",
    "en": "Extracted {count} of approximately {total} reviews",
    "zh": "已提取{count}条评论，预计共{total}条"
  },
  "detected": {
    "th": "ตรวจพบ {count} รีวิว",
    "en": "{count} reviews detected",
    "zh": "检测到{count}条评论"
  },
  "noneDetected": {
    "th": "ยังไม่พบข้อความรีวิวที่ชัดเจน",
    "en": "No clear review text found",
    "zh": "未找到清晰的评论内容"
  },
  "noneHelp": {
    "th": "ระบบอ่านภาพแล้ว แต่ยังแยกข้อความรีวิวไม่ได้ ลองใช้ Screenshot ที่เห็นชื่อผู้รีวิว ดาว วันที่ และข้อความรีวิวครบในจอ",
    "en": "The image was read, but review text could not be extracted. Try a screenshot showing the reviewer, stars, date and full review.",
    "zh": "图片已读取，但无法提取评论。请使用包含评论者、星级、日期及完整评论内容的截图。"
  },
  "scanError": {
    "th": "สแกนภาพไม่สำเร็จ กรุณาลองใหม่",
    "en": "Unable to scan images. Try again.",
    "zh": "图片扫描失败，请重试。"
  },
  "visitorPrivacy": {
    "th": "นับแบบ anonymous ต่อ browser ไม่เก็บ IP และ refresh ไม่เพิ่มยอดซ้ำ",
    "en": "Anonymous count per browser. No IP addresses stored; refreshing does not add visits.",
    "zh": "按浏览器匿名统计，不存储 IP 地址，刷新不会重复计数。"
  },
  "visitors": {
    "th": "ผู้เข้าชมรวมโดยประมาณ",
    "en": "Approximate total visitors",
    "zh": "访客总数（估计）"
  },
  "people": {
    "th": "คน",
    "en": "visitors",
    "zh": "人"
  },
  "anonymous": {
    "th": "· ไม่ระบุตัวตน",
    "en": "· Anonymous",
    "zh": "· 匿名"
  },
  "manualMode": {
    "th": "พิมพ์ข้อความ",
    "en": "Type text",
    "zh": "输入内容"
  },
  "imageMode": {
    "th": "สแกนจากภาพ",
    "en": "Scan image",
    "zh": "扫描图片"
  },
  "scanTitle": {
    "th": "สแกนข้อความจากภาพรีวิว",
    "en": "Scan text from review images",
    "zh": "扫描评论图片中的文字"
  },
  "scanHelp": {
    "th": "รองรับ Screenshot ที่มีหลายรีวิวในภาพเดียว และเลือกได้สูงสุด 3 ภาพต่อครั้ง",
    "en": "Screenshots can contain multiple reviews. Select up to 3 images per scan.",
    "zh": "支持一张截图包含多条评论，每次最多选择3张图片。"
  },
  "chooseImage": {
    "th": "เลือกรูป / ถ่ายภาพ",
    "en": "Choose image / Take photo",
    "zh": "选择图片 / 拍照"
  },
  "imageFormats": {
    "th": "JPG, PNG • ไม่เกิน 12 MB ต่อภาพ",
    "en": "JPG, PNG • Up to 12 MB per image",
    "zh": "JPG、PNG • 每张不超过12 MB"
  },
  "scanning": {
    "th": "กำลังสแกน...",
    "en": "Scanning...",
    "zh": "正在扫描…"
  },
  "scan": {
    "th": "สแกนข้อความรีวิว",
    "en": "Scan review text",
    "zh": "扫描评论内容"
  },
  "preparingShort": {
    "th": "กำลังเตรียม...",
    "en": "Preparing...",
    "zh": "正在准备…"
  },
  "ocrPrivacy": {
    "th": "ภาพจะถูกส่งแบบชั่วคราวผ่าน server ของ lineoppo.click ไปยัง Google Cloud Vision เพื่ออ่านข้อความและตำแหน่งของข้อความ ระบบหน้านี้ไม่บันทึกไฟล์ภาพลงฐานข้อมูล",
    "en": "Images are sent temporarily through lineoppo.click to Google Cloud Vision to read text and its position. This page does not save image files to the database.",
    "zh": "图片会通过 lineoppo.click 临时发送至 Google Cloud Vision，以识别文字及其位置。本页面不会将图片文件保存到数据库。"
  },
  "found": {
    "th": "พบ {count} รีวิว",
    "en": "{count} reviews found",
    "zh": "找到{count}条评论"
  },
  "checkOcr": {
    "th": "ตรวจข้อความที่ OCR อ่านได้ก่อนใช้ผลนับคำ",
    "en": "Check the OCR text before using the word count",
    "zh": "使用词数结果前请核对 OCR 内容"
  },
  "missingWarning": {
    "th": "ระบบเห็นโครงสร้างรีวิวประมาณ {total} รีวิว แต่แยกข้อความได้ {count} รีวิว อาจมีรีวิวตกหล่น กรุณาตรวจภาพต้นฉบับก่อนใช้ผล",
    "en": "Approximately {total} reviews were detected, but only {count} were extracted. Some may be missing. Check the original images before using the results.",
    "zh": "预计检测到{total}条评论，但仅提取了{count}条，可能存在遗漏。使用结果前请核对原图。"
  },
  "reviewNumber": {
    "th": "รีวิว {index}",
    "en": "Review {index}",
    "zh": "评论{index}"
  },
  "reviewLabel": {
    "th": "ข้อความรีวิว {index}",
    "en": "Review text {index}",
    "zh": "评论内容{index}"
  },
  "confidence": {
    "th": "ความมั่นใจ OCR {percent}%",
    "en": "OCR confidence {percent}%",
    "zh": "OCR 置信度{percent}%"
  },
  "confirmedCount": {
    "th": "{count} / {minimum} คำ",
    "en": "{count} / {minimum} words",
    "zh": "{count} / {minimum}词"
  },
  "awaitingCheck": {
    "th": "รอตรวจข้อความ",
    "en": "Text awaiting review",
    "zh": "内容待核对"
  },
  "confirm": {
    "th": "ยืนยันข้อความนี้และนับคำ",
    "en": "Confirm text and count words",
    "zh": "确认内容并计数"
  },
  "openManual": {
    "th": "เปิดในโหมดพิมพ์",
    "en": "Open in text mode",
    "zh": "在输入模式中打开"
  },
  "confirmHelp": {
    "th": "ระบบใช้ตำแหน่งข้อความจาก Google Vision เพื่อแยกรีวิวออกจากรูปสินค้า แต่ยังต้องตรวจ/แก้ข้อความก่อนยืนยัน ระบบจะยังไม่ตัดสินผ่าน 15 คำ",
    "en": "Google Vision text positions help separate reviews from product images. Check or edit the text before confirming; the 15-word result is not final yet.",
    "zh": "系统利用 Google Vision 的文字位置区分评论和商品图片。确认前请核对或修改内容，15词检查结果尚未最终确认。"
  },
  "rules": {
    "th": "กฎการนับคำ",
    "en": "Word-count rules",
    "zh": "词数统计规则"
  },
  "sameCounter": {
    "th": "หน้าเช็กนี้ใช้ตัวนับคำชุดเดียวกับ Google Review KPI · {version}",
    "en": "Uses the same word counter as Google Review KPI · {version}",
    "zh": "使用与 Google Review KPI 相同的词数统计器 · {version}"
  },
  "minimumRule": {
    "th": "15 คำขึ้นไป = ผ่าน",
    "en": "15 or more words = Pass",
    "zh": "15词及以上 = 通过"
  },
  "repeatRule": {
    "th": "14 คำยังไม่ผ่าน และคำที่ซ้ำกันยังนับทุกครั้ง",
    "en": "14 words do not pass. Repeated words count each time.",
    "zh": "14词仍不通过，重复的词每次都计数。"
  },
  "thaiSegmentation": {
    "th": "ตัดคำภาษาไทยอัตโนมัติ",
    "en": "Automatic Thai word segmentation",
    "zh": "自动泰语分词"
  },
  "notSpaces": {
    "th": "ไม่ได้นับจากจำนวนช่องว่างในประโยค",
    "en": "Words are not counted by spaces in the sentence",
    "zh": "词数并非按句子中的空格统计"
  },
  "allRules": {
    "th": "ดูรายละเอียดกฎทั้งหมด",
    "en": "View all counting rules",
    "zh": "查看全部计数规则"
  },
  "ignoreRule": {
    "th": "ไม่นับช่องว่าง เครื่องหมายวรรคตอน Emoji สัญลักษณ์ และตัวเลขล้วน",
    "en": "Spaces, punctuation, emoji, symbols and standalone numbers do not count",
    "zh": "空格、标点、表情、符号及纯数字不计数"
  },
  "brandRule": {
    "th": "คำอังกฤษหรือชื่อแบรนด์ที่มีตัวอักษร เช่น OPPO, Reno และ 5G สามารถนับเป็นคำได้",
    "en": "English words and brand names containing letters, such as OPPO, Reno and 5G, can count as words",
    "zh": "包含字母的英语词或品牌名称（如 OPPO、Reno 和 5G）可计为词"
  },
  "lockedRule": {
    "th": "คำศัพท์ที่ล็อกตามกฎ เช่น โปรโมชั่น, คำแนะนำ, ของแถม, ใช้บริการ, สมาร์ทโฟน, ใช้งาน และ วันนี้ จะไม่ถูกตัวตัดคำของ browser แยกเป็นเศษคำ",
    "en": "Fixed Thai terms such as โปรโมชั่น, คำแนะนำ, ของแถม, ใช้บริการ, สมาร์ทโฟน, ใช้งาน and วันนี้ are kept whole by the browser word segmenter",
    "zh": "规则中固定的泰语词（如 โปรโมชั่น、คำแนะนำ、ของแถม、ใช้บริการ、สมาร์ทโฟน、ใช้งาน、วันนี้）不会被浏览器拆分"
  },
  "modelRule": {
    "th": "ข้อความไทยที่ติดกับชื่อรุ่น เช่น ซื้อOPPOReno14Pro5Gวันนี้ จะแยกขอบเขตเป็น ซื้อ / OPPO / Reno14Pro / 5G / วันนี้ ก่อนนับ",
    "en": "Thai text attached to model names, such as ซื้อOPPOReno14Pro5Gวันนี้, is split into ซื้อ / OPPO / Reno14Pro / 5G / วันนี้ before counting",
    "zh": "泰语与型号相连（如 ซื้อOPPOReno14Pro5Gวันนี้）时，计数前会拆分为 ซื้อ / OPPO / Reno14Pro / 5G / วันนี้"
  },
  "prefixRule": {
    "th": "คำนำหน้า การ, ความ, น่า, ผู้, นัก, ชาว, ช่าง จะรวมกับคำถัดไปเป็น 1 คำ",
    "en": "Thai prefixes การ, ความ, น่า, ผู้, นัก, ชาว and ช่าง are joined with the next word and counted as one",
    "zh": "泰语前缀 การ、ความ、น่า、ผู้、นัก、ชาว、ช่าง 与后一个词合并，计为1词"
  },
  "compoundRule": {
    "th": "คำประสมที่กำหนดไว้ เช่น โรงพยาบาล, เครื่องใช้, แม่บ้าน, ท่องเที่ยว และต่างชาติ นับเป็น 1 คำ",
    "en": "Defined Thai compounds such as โรงพยาบาล, เครื่องใช้, แม่บ้าน, ท่องเที่ยว and ต่างชาติ count as one word",
    "zh": "指定的泰语复合词（如 โรงพยาบาล、เครื่องใช้、แม่บ้าน、ท่องเที่ยว、ต่างชาติ）计为1词"
  },
  "googleUiRule": {
    "th": "ข้อความ UI ของ Google เช่น See translation, Like, Share, More, อ่านเพิ่มเติม และดูคำแปล ไม่นับ",
    "en": "Google interface text such as See translation, Like, Share, More, อ่านเพิ่มเติม and ดูคำแปล does not count",
    "zh": "Google 界面文字（如 See translation、Like、Share、More、อ่านเพิ่มเติม、ดูคำแปล）不计数"
  },
  "ocrRule": {
    "th": "เมื่อสแกนจากภาพ ระบบพยายามตัดชื่อผู้รีวิว จำนวนรีวิว ดาว และวันที่ออกก่อน แล้วให้ BM ตรวจแก้ข้อความ OCR ได้ก่อนนับ",
    "en": "Image scans try to remove reviewer names, review totals, stars and dates. BM can check and edit the OCR text before counting.",
    "zh": "图片扫描会尽量去除评论者姓名、评论数量、星级和日期，BM 可在计数前核对和修改 OCR 内容。"
  },
  "equalsWords": {
    "th": "= {count} คำ",
    "en": "= {count} words",
    "zh": "= {count}词"
  },
  "compoundExample": {
    "th": "= ความสะอาด 1 คำ",
    "en": "= ความสะอาด (1 word)",
    "zh": "= ความสะอาด（1词）"
  },
  "kpiNote": {
    "th": "หมายเหตุ KPI",
    "en": "KPI notes",
    "zh": "KPI 说明"
  },
  "onlyWords": {
    "th": "เครื่องมือนี้ตรวจเฉพาะจำนวนคำในข้อความรีวิว",
    "en": "This tool checks only the review word count",
    "zh": "此工具仅检查评论词数"
  },
  "otherRequirements": {
    "th": "การผ่าน KPI จริงยังต้องผ่านเงื่อนไขภาพ เดือนของภาพ และกฎ Review KPI อื่น ๆ",
    "en": "Passing the KPI also requires valid images, the correct image month and other Review KPI rules",
    "zh": "通过 KPI 还需符合图片、图片月份及其他 Review KPI 规则"
  },
  "ocrAccuracy": {
    "th": "ผลจาก Google Vision ควรตรวจข้อความก่อนยืนยัน เพราะภาพเบลอ ข้อความถูกบัง หรือ layout ผิดปกติยังทำให้อ่านคลาดเคลื่อนได้",
    "en": "Check Google Vision text before confirming. Blur, obscured text or unusual layouts can cause reading errors.",
    "zh": "确认前请核对 Google Vision 识别内容。模糊、遮挡或异常布局可能导致识别错误。"
  },
  "temporaryImages": {
    "th": "ภาพถูกส่งเพื่อ OCR แบบชั่วคราวและไม่ถูกบันทึกลงฐานข้อมูลของหน้านี้",
    "en": "Images are sent temporarily for OCR and are not saved to this page’s database",
    "zh": "图片仅临时发送用于 OCR，不会保存到本页面的数据库"
  },
  "fileReadError": {
    "th": "อ่านไฟล์ภาพไม่สำเร็จ",
    "en": "Unable to read image file",
    "zh": "无法读取图片文件"
  }
} as const;

export type Review15Key = keyof typeof review15Translations;

export function review15Text(language: AppLanguage) {
  return (key: keyof typeof review15Translations, values: Record<string, string | number> = {}) => {
    const template: string = pickLanguageText(language, review15Translations[key]);
    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      values[name] === undefined ? placeholder : String(values[name]));
  };
}
