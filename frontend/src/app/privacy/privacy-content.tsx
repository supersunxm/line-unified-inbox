"use client";

import { PolicyDocument, type PolicyContent } from "../components/policy-document";
import type { AppLanguage } from "../language";

const shared = {
  productName: "OPPO Retail TikTok Monitor",
  organization: "OPPO Retail Operations",
};

const content: Record<AppLanguage, PolicyContent> = {
  th: {
    ...shared,
    internalLabel: "ระบบภายในฝ่ายปฏิบัติการค้าปลีก",
    documentLabel: "นโยบายความเป็นส่วนตัว",
    officialPolicyLabel: "นโยบายอย่างเป็นทางการ",
    effectiveLabel: "มีผลตั้งแต่",
    effectiveDate: "14 สิงหาคม 2026",
    productLabel: "ผลิตภัณฑ์",
    overviewTitle: "ภาพรวมและวัตถุประสงค์",
    overviewText: "OPPO Retail TikTok Monitor เป็นแดชบอร์ดภายในสำหรับติดตามบัญชี TikTok ของร้านค้าที่ได้รับอนุญาต นโยบายนี้อธิบายวิธีที่เราเก็บ ใช้ จัดเก็บ และจัดการข้อมูลจากบัญชี TikTok ที่เชื่อมต่อ รวมถึงสิทธิ์ของผู้ดูแลบัญชีในการควบคุมข้อมูลของตน",
    sections: [
      {
        title: "1. ข้อมูลที่เราเก็บรวบรวม",
        paragraphs: ["เมื่อเชื่อมต่อบัญชีร้านค้าที่ได้รับอนุญาตกับบริการ เราจะเก็บเฉพาะข้อมูลที่จำเป็นสำหรับการติดตามร้านค้า การวิเคราะห์ และการทำงานของแดชบอร์ด"],
        bullets: [
          { label: "ตัวระบุบัญชี TikTok", text: "Open ID, Union ID หรือตัวระบุบัญชีภายในแพลตฟอร์ม" },
          { label: "ข้อมูลโปรไฟล์ TikTok", text: "ชื่อผู้ใช้ ชื่อที่แสดง URL รูปโปรไฟล์ และประวัติหรือคำอธิบายบัญชี" },
          { label: "ตัวชี้วัดบัญชี", text: "จำนวนผู้ติดตาม จำนวนบัญชีที่ติดตาม ยอดไลก์รวม และจำนวนวิดีโอ" },
          { label: "ข้อมูลวิดีโอสาธารณะและตัวชี้วัดผลการทำงาน", text: "ชื่อวิดีโอ เวลาที่เผยแพร่ ความยาววิดีโอ จำนวนการรับชม ไลก์ ความคิดเห็น และการแชร์" },
          { label: "ข้อมูลการอนุญาตและข้อมูลทางเทคนิค", text: "Access token, refresh token, scope ที่อนุญาต เวลาหมดอายุ และ metadata จาก API ที่จำเป็นต่อการรักษาการเชื่อมต่อ TikTok OAuth" },
        ],
      },
      {
        title: "2. วิธีที่เราเก็บรวบรวมข้อมูล",
        paragraphs: ["ข้อมูลจะถูกรวบรวมผ่านช่องทางการเชื่อมต่ออย่างเป็นทางการที่ได้รับอนุญาตเท่านั้น"],
        bullets: [
          { label: "TikTok Login Kit และ OAuth Flow", text: "ข้อมูลจะถูกเก็บหลังจากเจ้าของบัญชี TikTok หรือผู้ดำเนินการที่ได้รับอนุญาตให้สิทธิ์อย่างชัดเจนผ่านหน้าต่างการอนุญาต TikTok OAuth มาตรฐานแล้วเท่านั้น" },
          { label: "TikTok API ที่ได้รับอนุญาต", text: "ตัวชี้วัดการดำเนินงานและสถิติวิดีโอจะถูกดึงผ่าน TikTok Developer API อย่างเป็นทางการโดยใช้ OAuth token ที่ได้รับอนุญาต" },
          { text: "เราไม่เก็บข้อมูลโดยไม่ได้รับอนุญาตล่วงหน้าอย่างชัดเจนจากผู้ดูแลบัญชีที่ได้รับสิทธิ์" },
        ],
      },
      {
        title: "3. วิธีที่เราใช้ข้อมูล",
        paragraphs: ["ข้อมูลจากการเชื่อมต่อ TikTok ใช้เฉพาะเพื่อการบริหารงานค้าปลีกภายใน"],
        bullets: [
          { label: "การติดตามการดำเนินงานค้าปลีกภายใน", text: "แสดงสถานะร้านค้า ช่องทางที่เปิดใช้งาน และภาพรวมสุขภาพระบบแบบรวมศูนย์สำหรับทีมปฏิบัติการที่ได้รับอนุญาต" },
          { label: "การวิเคราะห์ผลการดำเนินงานรายร้าน", text: "ติดตามการเติบโตของผู้ติดตาม การเข้าถึง และอัตราการมีส่วนร่วมของแต่ละสาขา" },
          { label: "การติดตามกิจกรรมคอนเทนต์", text: "ประเมินความถี่ในการโพสต์ ระดับการมีส่วนร่วมกับวิดีโอ และคอนเทนต์ยอดนิยมของร้าน" },
          { label: "การวิเคราะห์ย้อนหลังและรายงาน", text: "สร้างรายงานสรุปรวมภายในและสรุปการดำเนินงานสำหรับการทบทวนของฝ่ายบริหารค้าปลีก" },
        ],
      },
      {
        title: "4. การแบ่งปันข้อมูล",
        paragraphs: ["เราไม่สร้างรายได้ ขาย หรือแบ่งปันข้อมูล TikTok ให้บุคคลภายนอก"],
        bullets: [
          { label: "ไม่ขายข้อมูล", text: "เราไม่ขาย ให้เช่า ให้ใช้เช่า หรือเผยแพร่ข้อมูลบัญชีหรือข้อมูลการดำเนินงานแก่บุคคลที่สามเพื่อการค้า" },
          { label: "ไม่แบ่งปันกับผู้โฆษณา", text: "ข้อมูลจะไม่ถูกแบ่งปันกับผู้โฆษณาภายนอก เครือข่ายโฆษณา หรือนายหน้าข้อมูล" },
          { label: "เปิดเผยเฉพาะเมื่อได้รับอนุญาต", text: "ข้อมูลอาจถูกเปิดเผยเฉพาะเมื่อจำเป็นต่อการให้บริการ การปฏิบัติตามกฎหมาย หรือการใช้งานภายในที่ได้รับอนุญาตโดยบุคลากรที่กำหนด" },
        ],
      },
      {
        title: "5. การจัดเก็บและความปลอดภัยของข้อมูล",
        paragraphs: ["เราใช้มาตรการด้านเทคนิคและองค์กรที่เหมาะสมเพื่อปกป้องข้อมูลที่รวบรวม"],
        bullets: [
          { label: "การจัดเก็บ Token อย่างปลอดภัย", text: "TikTok access token และ refresh token ถูกจัดเก็บบนโครงสร้างพื้นฐาน backend อย่างปลอดภัย และเข้าถึงได้เฉพาะบริการ backend ที่ได้รับอนุญาต" },
          { label: "การปกป้อง Token", text: "OAuth token และข้อมูลลับจะไม่ถูกเปิดเผยต่อผู้ใช้ frontend, client-side bundle หรือ public endpoint" },
          { label: "การควบคุมการเข้าถึง", text: "การเข้าถึงแหล่งจัดเก็บข้อมูล backend จำกัดเฉพาะผู้ดูแลระบบที่ยืนยันตัวตนแล้วและกระบวนการ backend ที่ได้รับอนุญาต" },
        ],
      },
      {
        title: "6. ระยะเวลาการเก็บรักษาข้อมูล",
        paragraphs: ["เราเก็บข้อมูลไว้เท่าที่จำเป็นอย่างสมเหตุสมผลต่อวัตถุประสงค์ด้านการดำเนินงานและการรายงาน"],
        bullets: [
          { text: "ตัวชี้วัดการดำเนินงานและ snapshot จะถูกเก็บระหว่างช่วงที่มีการติดตามร้านค้าอยู่" },
          { text: "เมื่อยกเลิกการเชื่อมต่อบัญชี หรือข้อมูลไม่จำเป็นต่อการรายงานทางธุรกิจอีกต่อไป token และข้อมูลที่เกี่ยวข้องจะถูกลบหรือทำให้ไม่สามารถระบุตัวตนได้" },
        ],
      },
      {
        title: "7. การยกเลิกการเชื่อมต่อบัญชีและการลบข้อมูล",
        paragraphs: ["เจ้าของบัญชีและผู้ดำเนินการที่ได้รับอนุญาตยังคงมีอำนาจควบคุมการเชื่อมต่อบัญชีของตน"],
        bullets: [
          { label: "ยกเลิกการเชื่อมต่อบัญชี", text: "บัญชี TikTok ที่ได้รับอนุญาตสามารถยกเลิกการเชื่อมต่อจากบริการได้ทุกเมื่อผ่านหน้าจอจัดการแดชบอร์ด หรือโดยเพิกถอนสิทธิ์ในการตั้งค่าบัญชี TikTok" },
          { label: "คำขอลบข้อมูล", text: "เจ้าของบัญชีหรือผู้ดำเนินการที่ได้รับอนุญาตสามารถขอลบข้อมูลร้านค้า TikTok และตัวชี้วัดที่แคชไว้ได้" },
          { text: "คำขอด้านความเป็นส่วนตัวและการลบข้อมูลสามารถส่งไปที่ obsthailand@gmail.com และจะดำเนินการหลังจากตรวจสอบความเป็นเจ้าของบัญชีแล้ว" },
        ],
      },
      {
        title: "8. บริการของบุคคลภายนอก",
        paragraphs: ["บริการเชื่อมต่อกับ TikTok ผ่าน TikTok API อย่างเป็นทางการ การเก็บ การจัดการ และการประมวลผลข้อมูลส่วนบุคคลโดย TikTok อยู่ภายใต้นโยบายความเป็นส่วนตัวและข้อกำหนดการให้บริการของ TikTok เอง ผู้ใช้ควรทบทวนนโยบายดังกล่าวเพื่อเข้าใจแนวทางการจัดการข้อมูลของแพลตฟอร์มต้นทาง"],
      },
      {
        title: "9. สิทธิ์และคำขอของผู้ใช้",
        paragraphs: ["ผู้ดำเนินการที่ได้รับอนุญาตและตัวแทนร้านค้าสามารถส่งคำขอเกี่ยวกับข้อมูลร้านค้าที่เชื่อมต่อได้ รวมถึง"],
        bullets: [
          { text: "ขอเข้าถึงข้อมูลที่จัดเก็บเกี่ยวกับบัญชีร้านค้าของตน" },
          { text: "ขอแก้ไขหรือปรับปรุงรายละเอียดการ mapping บัญชีที่ไม่ถูกต้อง" },
          { text: "ขอลบตัวชี้วัดและ authorization token ที่จัดเก็บไว้" },
          { text: "คำถามหรือข้อกังวลทั่วไปด้านความเป็นส่วนตัวสามารถส่งไปที่ obsthailand@gmail.com" },
        ],
      },
      {
        title: "10. การเปลี่ยนแปลงนโยบายความเป็นส่วนตัว",
        paragraphs: ["เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราวเพื่อสะท้อนการเปลี่ยนแปลงด้านการดำเนินงาน เทคนิค หรือข้อกำกับดูแล การเปลี่ยนแปลงจะเผยแพร่บนหน้านี้พร้อมวันที่มีผลฉบับใหม่ การใช้บริการต่อหลังจากเผยแพร่การเปลี่ยนแปลงถือเป็นการรับทราบนโยบายฉบับปรับปรุง"],
      },
      {
        title: "11. ข้อมูลติดต่อ",
        paragraphs: ["สำหรับคำถามด้านความเป็นส่วนตัว คำขอเข้าถึงข้อมูล หรือคำขอลบข้อมูล โปรดติดต่อทีม Operations Engineering ตามข้อมูลด้านล่าง"],
      },
    ],
    contact: {
      applicationLabel: "แอปพลิเคชัน",
      departmentLabel: "หน่วยงาน",
      department: "OPPO Retail Operations & Engineering",
      emailLabel: "อีเมล",
      email: "obsthailand@gmail.com",
      domainLabel: "โดเมน",
      domain: "https://lineoppo.click",
    },
    rightsText: "สงวนลิขสิทธิ์",
  },
  en: {
    ...shared,
    internalLabel: "Internal Retail Operations",
    documentLabel: "Privacy Policy",
    officialPolicyLabel: "OFFICIAL POLICY",
    effectiveLabel: "Effective",
    effectiveDate: "August 14, 2026",
    productLabel: "Product",
    overviewTitle: "Overview & Purpose Statement",
    overviewText: "OPPO Retail TikTok Monitor is an internal enterprise retail operations dashboard used to monitor authorized TikTok store accounts. This Privacy Policy describes how we collect, use, store, and manage data obtained from connected TikTok accounts and how account operators can exercise control over their data.",
    sections: [
      {
        title: "1. Information We Collect",
        paragraphs: ["When an authorized retail store account is connected to the Service, we collect only the data necessary to provide store monitoring, analytics, and operational dashboard functionality."],
        bullets: [
          { label: "TikTok account identifiers", text: "Open ID, union ID, or internal platform account identifiers." },
          { label: "TikTok profile information", text: "Account username, display name, profile avatar URL, and account bio/description." },
          { label: "Account metrics", text: "Follower count, following count, total likes, and video count." },
          { label: "Public video metadata & performance metrics", text: "Video title, publish timestamp, video duration, video views, video likes, comments count, and shares count." },
          { label: "Authorization & technical data", text: "Access tokens, refresh tokens, scope grants, expiration timestamps, and API response metadata required to maintain authenticated TikTok OAuth connections." },
        ],
      },
      {
        title: "2. How We Collect Information",
        paragraphs: ["Information is collected strictly through authorized, official integration channels."],
        bullets: [
          { label: "TikTok Login Kit & OAuth Flow", text: "Information is collected only after the TikTok account owner or authorized operator explicitly grants permissions through the standard TikTok OAuth authorization dialogue." },
          { label: "Authorized TikTok APIs", text: "Operational metrics and video statistics are retrieved programmatically via official TikTok Developer APIs using the granted OAuth tokens." },
          { text: "We do not collect information without explicit prior permission from the authorized account operator." },
        ],
      },
      {
        title: "3. How We Use Information",
        paragraphs: ["Data collected through TikTok integrations is used exclusively for internal retail operations management."],
        bullets: [
          { label: "Internal retail operations monitoring", text: "Displaying centralized store status, active channels, and health overviews for authorized retail operations teams." },
          { label: "Store-level performance analysis", text: "Tracking follower growth, reach, and engagement rates across individual retail store branches." },
          { label: "Content activity monitoring", text: "Evaluating store posting frequency, video interaction levels, and popular store content." },
          { label: "Historical analytics & reporting", text: "Generating internal aggregate reports and operational summaries for retail management review." },
        ],
      },
      {
        title: "4. Data Sharing",
        paragraphs: ["We do not monetize, sell, or share TikTok data with outside parties."],
        bullets: [
          { label: "Data is not sold", text: "We never sell, rent, lease, or commercially distribute account or operational data to any third party." },
          { label: "No advertiser sharing", text: "Data is not shared with third-party advertisers, ad networks, or data brokers." },
          { label: "Authorized disclosures only", text: "Data may only be disclosed where strictly required for service operation, legal compliance, or authorized internal use by designated personnel." },
        ],
      },
      {
        title: "5. Data Storage and Security",
        paragraphs: ["We implement reasonable technical and organizational security measures to safeguard all collected data."],
        bullets: [
          { label: "Secure Token Storage", text: "TikTok access tokens and refresh tokens are stored securely on backend server infrastructure and are accessible only by authorized backend services." },
          { label: "Token Protection", text: "OAuth tokens and secret credentials are never exposed to frontend users, client-side web bundles, or public endpoints." },
          { label: "Access Controls", text: "Access to backend data stores is restricted to authenticated system administrators and operational backend routines." },
        ],
      },
      {
        title: "6. Data Retention",
        paragraphs: ["We retain information only for as long as reasonably necessary to fulfill operational and reporting purposes."],
        bullets: [
          { text: "Operational metrics and snapshots are retained during the active period of store monitoring." },
          { text: "When an account is disconnected or the data is no longer required for business reporting, associated tokens and data are deleted or anonymized." },
        ],
      },
      {
        title: "7. Account Disconnection and Data Deletion",
        paragraphs: ["Authorized account owners and operators retain full control over their account connections."],
        bullets: [
          { label: "Account Disconnection", text: "Authorized TikTok accounts can be disconnected from the Service at any time via the dashboard management interface or by revoking access in TikTok account permissions settings." },
          { label: "Data Deletion Requests", text: "Account owners or authorized operators may request the deletion of associated TikTok store data and cached metrics." },
          { text: "Privacy and data deletion requests can be submitted directly by emailing obsthailand@gmail.com. Requests are processed in a timely manner upon verification of account ownership." },
        ],
      },
      {
        title: "8. Third-Party Services",
        paragraphs: ["The Service integrates with TikTok through official TikTok APIs. TikTok’s own collection, handling, and processing of personal information is governed by TikTok’s Privacy Policy and terms of service. Users are encouraged to review TikTok’s privacy policies to understand their data practices on the underlying platform."],
      },
      {
        title: "9. User Rights and Requests",
        paragraphs: ["Authorized operators and store representatives may submit requests concerning their connected store data, including:"],
        bullets: [
          { text: "Requesting access to the data stored in connection with their store account." },
          { text: "Requesting correction or updating of inaccurate account mapping details." },
          { text: "Requesting deletion of stored metrics and authorization tokens." },
          { text: "General privacy questions or concerns regarding the Service can be directed to obsthailand@gmail.com." },
        ],
      },
      {
        title: "10. Changes to This Privacy Policy",
        paragraphs: ["We may update this Privacy Policy from time to time to reflect operational, technical, or regulatory updates. Any changes will be posted directly on this page with an updated effective date. Continued use of the Service after changes are published constitutes acknowledgment of the updated Privacy Policy."],
      },
      {
        title: "11. Contact Information",
        paragraphs: ["For any privacy questions, access requests, or data deletion inquiries, please reach out to the operations engineering team using the information below."],
      },
    ],
    contact: {
      applicationLabel: "Application",
      departmentLabel: "Department",
      department: "OPPO Retail Operations & Engineering",
      emailLabel: "Support Email",
      email: "obsthailand@gmail.com",
      domainLabel: "Domain",
      domain: "https://lineoppo.click",
    },
    rightsText: "All rights reserved.",
  },
  zh: {
    ...shared,
    internalLabel: "内部零售运营",
    documentLabel: "隐私政策",
    officialPolicyLabel: "正式政策",
    effectiveLabel: "生效日期",
    effectiveDate: "2026年8月14日",
    productLabel: "产品",
    overviewTitle: "概述与目的说明",
    overviewText: "OPPO Retail TikTok Monitor 是用于监控经授权 TikTok 门店账户的内部企业零售运营仪表板。本隐私政策说明我们如何收集、使用、存储和管理来自已连接 TikTok 账户的数据，以及账户运营人员如何控制其数据。",
    sections: [
      {
        title: "1. 我们收集的信息",
        paragraphs: ["当经授权的零售门店账户连接到本服务时，我们仅收集提供门店监控、数据分析和运营仪表板功能所必需的数据。"],
        bullets: [
          { label: "TikTok 账户标识符", text: "Open ID、Union ID 或平台内部账户标识符。" },
          { label: "TikTok 资料信息", text: "账户用户名、显示名称、头像 URL 及账户简介/描述。" },
          { label: "账户指标", text: "关注者数量、正在关注数量、总点赞数及视频数量。" },
          { label: "公开视频元数据与绩效指标", text: "视频标题、发布时间、视频时长、播放量、点赞量、评论数及分享数。" },
          { label: "授权与技术数据", text: "Access Token、Refresh Token、授权 Scope、到期时间以及维持 TikTok OAuth 认证连接所需的 API 响应元数据。" },
        ],
      },
      {
        title: "2. 我们如何收集信息",
        paragraphs: ["信息仅通过经授权的官方集成渠道收集。"],
        bullets: [
          { label: "TikTok Login Kit 与 OAuth 流程", text: "仅在 TikTok 账户所有者或经授权运营人员通过标准 TikTok OAuth 授权界面明确授予权限后收集信息。" },
          { label: "经授权的 TikTok API", text: "运营指标及视频统计通过官方 TikTok Developer API，并使用已授权 OAuth Token 以程序方式获取。" },
          { text: "未经授权账户运营人员事先明确许可，我们不会收集信息。" },
        ],
      },
      {
        title: "3. 我们如何使用信息",
        paragraphs: ["通过 TikTok 集成收集的数据仅用于内部零售运营管理。"],
        bullets: [
          { label: "内部零售运营监控", text: "为获授权的零售运营团队集中展示门店状态、启用渠道及系统健康概览。" },
          { label: "门店级绩效分析", text: "跟踪各零售门店的关注者增长、触达及互动率。" },
          { label: "内容活动监控", text: "评估门店发布频率、视频互动水平及热门门店内容。" },
          { label: "历史分析与报告", text: "生成内部汇总报告及运营摘要，供零售管理团队审阅。" },
        ],
      },
      {
        title: "4. 数据共享",
        paragraphs: ["我们不会将 TikTok 数据变现、出售或共享给外部方。"],
        bullets: [
          { label: "不出售数据", text: "我们绝不会向任何第三方出售、出租、租赁或商业分发账户或运营数据。" },
          { label: "不与广告商共享", text: "数据不会共享给第三方广告商、广告网络或数据经纪商。" },
          { label: "仅限授权披露", text: "仅在服务运营、法律合规或指定人员经授权内部使用所严格需要的情况下披露数据。" },
        ],
      },
      {
        title: "5. 数据存储与安全",
        paragraphs: ["我们采取合理的技术和组织安全措施保护所有已收集数据。"],
        bullets: [
          { label: "安全 Token 存储", text: "TikTok Access Token 和 Refresh Token 安全存储在后端服务器基础设施中，仅供经授权的后端服务访问。" },
          { label: "Token 保护", text: "OAuth Token 和秘密凭证不会暴露给前端用户、客户端 Web Bundle 或公共 Endpoint。" },
          { label: "访问控制", text: "后端数据存储仅限经过身份验证的系统管理员和授权后端运行流程访问。" },
        ],
      },
      {
        title: "6. 数据保留",
        paragraphs: ["我们仅在实现运营和报告目的所合理需要的期限内保留信息。"],
        bullets: [
          { text: "运营指标和快照会在门店处于活跃监控期间保留。" },
          { text: "账户断开连接或相关数据不再用于业务报告时，关联 Token 和数据将被删除或匿名化。" },
        ],
      },
      {
        title: "7. 账户断开与数据删除",
        paragraphs: ["经授权的账户所有者和运营人员对其账户连接保有完整控制权。"],
        bullets: [
          { label: "账户断开", text: "经授权的 TikTok 账户可随时通过仪表板管理界面断开本服务，或在 TikTok 账户权限设置中撤销访问权限。" },
          { label: "数据删除请求", text: "账户所有者或经授权运营人员可请求删除相关 TikTok 门店数据及缓存指标。" },
          { text: "隐私与数据删除请求可发送至 obsthailand@gmail.com。核实账户所有权后，我们会及时处理请求。" },
        ],
      },
      {
        title: "8. 第三方服务",
        paragraphs: ["本服务通过官方 TikTok API 与 TikTok 集成。TikTok 自身对个人信息的收集、处理和加工受其隐私政策及服务条款约束。建议用户阅读 TikTok 的隐私政策，以了解底层平台的数据处理方式。"],
      },
      {
        title: "9. 用户权利与请求",
        paragraphs: ["经授权运营人员和门店代表可就其已连接门店数据提出请求，包括："],
        bullets: [
          { text: "请求访问与其门店账户相关的已存储数据。" },
          { text: "请求更正或更新不准确的账户映射信息。" },
          { text: "请求删除已存储的指标和授权 Token。" },
          { text: "有关本服务的一般隐私问题或疑虑可发送至 obsthailand@gmail.com。" },
        ],
      },
      {
        title: "10. 本隐私政策的变更",
        paragraphs: ["我们可能不时更新本隐私政策，以反映运营、技术或监管方面的变化。任何变更都会直接发布在本页面，并标明新的生效日期。变更发布后继续使用本服务，即表示已知悉更新后的隐私政策。"],
      },
      {
        title: "11. 联系信息",
        paragraphs: ["如有任何隐私问题、数据访问请求或数据删除咨询，请通过以下信息联系运营工程团队。"],
      },
    ],
    contact: {
      applicationLabel: "应用",
      departmentLabel: "部门",
      department: "OPPO Retail Operations & Engineering",
      emailLabel: "支持邮箱",
      email: "obsthailand@gmail.com",
      domainLabel: "域名",
      domain: "https://lineoppo.click",
    },
    rightsText: "保留所有权利。",
  },
};

export function PrivacyContent() {
  return <PolicyDocument content={content} />;
}
