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
    documentLabel: "ข้อกำหนดการให้บริการ",
    officialPolicyLabel: "นโยบายอย่างเป็นทางการ",
    effectiveLabel: "มีผลตั้งแต่",
    effectiveDate: "14 สิงหาคม 2026",
    productLabel: "ผลิตภัณฑ์",
    overviewTitle: "ภาพรวมและวัตถุประสงค์",
    overviewText: "OPPO Retail TikTok Monitor เป็นแดชบอร์ดภายในสำหรับฝ่ายปฏิบัติการค้าปลีก ซึ่งพัฒนาสำหรับบุคลากร OPPO ที่ได้รับอนุญาตและผู้จัดการร้าน เพื่อให้สามารถดูข้อมูลและติดตามตัวชี้วัดการดำเนินงานของบัญชี TikTok ร้านค้าที่ได้รับอนุญาตได้จากศูนย์กลางเดียว",
    sections: [
      {
        title: "1. วัตถุประสงค์ของบริการ",
        paragraphs: [
          "OPPO Retail TikTok Monitor (ต่อไปนี้เรียกว่า “บริการ”) เป็นเครื่องมือภายในสำหรับการบริหารงานและวิเคราะห์ข้อมูล ซึ่งพัฒนาขึ้นเพื่อทีมปฏิบัติการค้าปลีกของ OPPO ผู้ดูแลระดับภูมิภาค และผู้ดูแลร้านค้าที่ได้รับอนุญาตเท่านั้น",
          "วัตถุประสงค์หลักของบริการคือช่วยให้ผู้มีสิทธิ์สามารถติดตามตัวชี้วัดผลการดำเนินงาน แนวโน้มการเติบโตของผู้ติดตาม วิเคราะห์ข้อมูลการมีส่วนร่วม และกำกับดูแลกระบวนการตอบข้อสอบถามของลูกค้าในบัญชี TikTok ร้านค้าอย่างเป็นทางการที่เชื่อมต่ออยู่ ผ่านหน้าจอปฏิบัติการแบบรวมศูนย์",
        ],
      },
      {
        title: "2. การใช้งานที่ได้รับอนุญาต",
        paragraphs: ["การเข้าถึงบริการจำกัดเฉพาะบุคลากรขององค์กรที่ได้รับอนุญาต มีบัญชีบริษัทที่ผ่านการยืนยัน และได้รับสิทธิ์ตามบทบาทที่กำหนด"],
        bullets: [
          { text: "ผู้ใช้สามารถใช้บริการได้เฉพาะเพื่อการปฏิบัติการร้านค้าภายใน การจัดทำรายงานทางธุรกิจ และการติดตามผลการดำเนินงานของร้านค้าอย่างเป็นทางการ" },
          { text: "ห้ามแบ่งปันข้อมูลรับรอง ให้บุคคลภายนอกเข้าถึง ใช้ระบบอัตโนมัติเพื่อดึงข้อมูลจำนวนมาก หรือพยายามหลีกเลี่ยงมาตรการรักษาความปลอดภัย" },
          { text: "การเข้าถึงโดยไม่ได้รับอนุญาตหรือการใช้บริการในทางที่ผิดอาจทำให้ถูกเพิกถอนสิทธิ์ทันที และอาจอยู่ภายใต้มาตรการทางวินัยหรือกฎหมายขององค์กร" },
        ],
      },
      {
        title: "3. การอนุญาตบัญชี TikTok",
        paragraphs: ["บริการเชื่อมต่อกับ TikTok ผ่าน TikTok Developer API อย่างเป็นทางการและกระบวนการอนุญาตมาตรฐาน OAuth 2.0"],
        bullets: [
          { label: "ความยินยอมโดยชัดแจ้ง", text: "เฉพาะผู้ดูแลบัญชีร้านค้าที่ได้รับอนุญาตเท่านั้นที่สามารถเชื่อมต่อบัญชี TikTok ร้านค้าอย่างเป็นทางการ โดยดำเนินการผ่านขั้นตอน TikTok OAuth อย่างเป็นทางการ" },
          { label: "สิทธิ์เท่าที่จำเป็น", text: "บริการจะขอเฉพาะสิทธิ์ API ขั้นต่ำที่จำเป็นต่อการดึงข้อมูลการดำเนินงาน เช่น ข้อมูลโปรไฟล์บัญชี สถิติผู้ติดตาม และตัวชี้วัดปริมาณการมีส่วนร่วม" },
          { label: "การเพิกถอนสิทธิ์", text: "ผู้ดูแลร้านค้าสามารถยกเลิกการเชื่อมต่อบัญชีหรือเพิกถอนสิทธิ์ API ได้ทุกเมื่อผ่านการตั้งค่าบัญชี TikTok หรือหน้าจอจัดการของบริการ" },
        ],
      },
      {
        title: "4. การใช้ข้อมูล",
        paragraphs: ["เรามุ่งจัดการข้อมูลการดำเนินงานอย่างปลอดภัย โปร่งใส และสอดคล้องกับนโยบายของแพลตฟอร์มและข้อกำหนดด้านความเป็นส่วนตัวที่เกี่ยวข้อง"],
        cards: [
          { title: "ใช้เพื่อการดำเนินงานภายในเท่านั้น", text: "ข้อมูลที่เข้าถึงผ่าน TikTok API ใช้เฉพาะสำหรับแดชบอร์ดภายในและการวิเคราะห์ผลการดำเนินงานด้านค้าปลีก" },
          { title: "ไม่ขายหรือส่งต่อให้บุคคลภายนอก", text: "เราไม่ขาย ให้เช่า สร้างรายได้จาก หรือโอนข้อมูลผู้ใช้หรือข้อมูลร้านค้าจาก TikTok ให้ผู้โฆษณาหรือนายหน้าข้อมูลภายนอก" },
          { title: "การเข้ารหัสระหว่างส่งและขณะจัดเก็บ", text: "การสื่อสารผ่านเครือข่ายบังคับใช้ TLS 1.3/HTTPS และ OAuth token รวมถึงข้อมูลลับที่มีความอ่อนไหวจะถูกเข้ารหัสขณะจัดเก็บด้วยอัลกอริทึมเข้ารหัสมาตรฐานอุตสาหกรรม" },
          { title: "การเก็บรักษาและการลบข้อมูล", text: "ข้อมูลจะถูกเก็บไว้เท่าที่จำเป็นต่อการติดตามการดำเนินงานที่ยังใช้งานอยู่ เมื่อยกเลิกการเชื่อมต่อบัญชี token และข้อมูลตัวชี้วัดที่แคชไว้จะถูกลบตามนโยบายการเก็บรักษาข้อมูล" },
        ],
      },
      {
        title: "5. ความรับผิดชอบของผู้ใช้",
        paragraphs: ["ผู้ใช้ที่ได้รับสิทธิ์เข้าถึงบริการตกลงที่จะปฏิบัติดังต่อไปนี้"],
        bullets: [
          { text: "รักษาความลับและความปลอดภัยของข้อมูลรับรองสำหรับการยืนยันตัวตน" },
          { text: "แจ้งเหตุละเมิดความปลอดภัยหรือกิจกรรมที่ไม่ได้รับอนุญาตที่สงสัยให้ทีม IT Security ทราบโดยเร็ว" },
          { text: "ปฏิบัติตามนโยบายบริษัท กฎหมายความเป็นส่วนตัวที่เกี่ยวข้อง รวมถึงข้อกำหนดการให้บริการและนโยบายนักพัฒนาของ TikTok" },
          { text: "ใช้ข้อมูลที่เห็นในแดชบอร์ดเพื่อวัตถุประสงค์ทางธุรกิจของบริษัทที่ได้รับอนุญาตเท่านั้น" },
        ],
      },
      {
        title: "6. ความพร้อมใช้งานของบริการ",
        paragraphs: ["เรามุ่งรักษาความพร้อมใช้งานและความน่าเชื่อถือของบริการในระดับสูง อย่างไรก็ตาม บริการให้ใช้งานตามสภาพและตามที่มีอยู่ ความพร้อมใช้งานอาจได้รับผลกระทบเป็นครั้งคราวจากการบำรุงรักษาตามกำหนด การอัปเกรดเครือข่าย หรือการหยุดให้บริการของ API จากบุคคลภายนอก"],
      },
      {
        title: "7. ข้อจำกัดความรับผิด",
        paragraphs: ["ภายใต้ขอบเขตสูงสุดที่กฎหมายที่ใช้บังคับอนุญาต OPPO บริษัทในเครือ ผู้พัฒนา และผู้ให้บริการจะไม่รับผิดชอบต่อความเสียหายทางอ้อม ความเสียหายโดยบังเอิญ ความเสียหายสืบเนื่อง ความเสียหายพิเศษ หรือความเสียหายเชิงลงโทษ ที่เกิดจากการใช้หรือไม่สามารถใช้บริการ หรือจากข้อมูลที่ได้รับผ่าน API ของแพลตฟอร์มภายนอก"],
      },
      {
        title: "8. การเปลี่ยนแปลงข้อกำหนด",
        paragraphs: ["เราสงวนสิทธิ์ในการแก้ไขหรือปรับปรุงข้อกำหนดการให้บริการนี้ตามความจำเป็น เพื่อให้สอดคล้องกับการเปลี่ยนแปลงด้านการดำเนินงาน ความสามารถทางเทคนิค นโยบายแพลตฟอร์ม หรือข้อกำหนดทางกฎหมาย โดยการปรับปรุงจะเผยแพร่บนหน้านี้พร้อมวันที่แก้ไขล่าสุด"],
      },
      {
        title: "9. การติดต่อ",
        paragraphs: ["หากมีคำถามเกี่ยวกับข้อกำหนดการให้บริการ การเชื่อมต่อระบบสำหรับนักพัฒนา หรือการสนับสนุนทางเทคนิค โปรดติดต่อทีม Operations Engineering ตามข้อมูลด้านล่าง"],
      },
    ],
    contact: {
      applicationLabel: "แอปพลิเคชัน",
      departmentLabel: "หน่วยงาน",
      department: "OPPO Retail Operations & Engineering",
      emailLabel: "อีเมลสนับสนุน",
      email: "obsthailand@gmail.com",
      domainLabel: "โดเมน",
      domain: "https://lineoppo.click",
    },
    rightsText: "สงวนลิขสิทธิ์",
  },
  en: {
    ...shared,
    internalLabel: "Internal Retail Operations",
    documentLabel: "Terms of Service",
    officialPolicyLabel: "OFFICIAL POLICY",
    effectiveLabel: "Effective",
    effectiveDate: "August 14, 2026",
    productLabel: "Product",
    overviewTitle: "Overview & Purpose Statement",
    overviewText: "OPPO Retail TikTok Monitor is an internal enterprise retail operations dashboard developed for authorized OPPO retail operations personnel and store managers. The application provides centralized visibility and operational metrics monitoring across authorized official TikTok retail store accounts.",
    sections: [
      {
        title: "1. Purpose of Service",
        paragraphs: [
          "OPPO Retail TikTok Monitor (the “Service”) is an internal operational management and analytics tool developed exclusively for OPPO retail operations teams, regional supervisors, and authorized store administrators.",
          "The primary purpose of the Service is to enable authorized personnel to monitor operational performance metrics, track follower growth trends, analyze engagement insights, and oversee customer inquiry response workflows across connected official retail store TikTok accounts in a unified operational interface.",
        ],
      },
      {
        title: "2. Authorized Use",
        paragraphs: ["Access to the Service is strictly restricted to authorized enterprise personnel who have been provisioned with authenticated company accounts and verified role-based access permissions."],
        bullets: [
          { text: "Users may use the Service only for legitimate internal retail store operations, business reporting, and official store performance monitoring." },
          { text: "Sharing credentials, providing third-party access, automated bulk scraping, or attempting to circumvent security controls is strictly prohibited." },
          { text: "Any unauthorized access or misuse of the Service will result in immediate revocation of privileges and may be subject to enterprise disciplinary and legal measures." },
        ],
      },
      {
        title: "3. TikTok Account Authorization",
        paragraphs: ["The Service integrates with TikTok through official TikTok Developer APIs and standard OAuth 2.0 authorization protocols."],
        bullets: [
          { label: "Explicit Consent", text: "Only authorized store account administrators may connect official TikTok store accounts to the Service by completing the official TikTok OAuth authorization flow." },
          { label: "Scoped Access", text: "The Service requests only the minimal API permissions necessary to retrieve operational metrics, such as account profile information, follower analytics, and interaction volume statistics." },
          { label: "Revocation", text: "Store administrators can disconnect their accounts or revoke API authorization at any time via TikTok account settings or within the Service management console." },
        ],
      },
      {
        title: "4. Data Usage",
        paragraphs: ["We are committed to handling all operational data securely, transparently, and in strict compliance with platform developer policies and data privacy regulations."],
        cards: [
          { title: "Internal Operations Only", text: "Data accessed through the TikTok API is used solely for internal operational dashboards and retail performance analytics." },
          { title: "No Sale or Third-Party Transfer", text: "We do not sell, rent, monetize, or transfer TikTok user or store data to external third-party advertisers or data brokers." },
          { title: "Encryption in Transit & at Rest", text: "All network communication is enforced via TLS 1.3/HTTPS. OAuth tokens and sensitive secrets are encrypted at rest with industry-standard cryptographic algorithms." },
          { title: "Data Retention & Deletion", text: "Data is retained only as long as necessary for active retail monitoring. Upon account disconnection, associated tokens and cached metrics are purged in accordance with data retention policies." },
        ],
      },
      {
        title: "5. User Responsibilities",
        paragraphs: ["Users granted access to the Service agree to:"],
        bullets: [
          { text: "Maintain the confidentiality and security of their authentication credentials." },
          { text: "Promptly report any suspected security breaches or unauthorized activity to the IT security team." },
          { text: "Adhere to all applicable company policies, local privacy laws, and TikTok’s Terms of Service and Developer Policies." },
          { text: "Use data viewed within the dashboard solely for authorized company business purposes." },
        ],
      },
      {
        title: "6. Service Availability",
        paragraphs: ["We strive to maintain high availability and reliability for the Service. However, the Service is provided on an “as is” and “as available” basis. Operational availability may occasionally be affected by scheduled maintenance, network upgrades, or external third-party API service interruptions."],
      },
      {
        title: "7. Limitation of Liability",
        paragraphs: ["To the fullest extent permitted by applicable law, OPPO, its affiliates, developers, and service providers shall not be liable for any indirect, incidental, consequential, special, or punitive damages resulting from the use of, or inability to use, the Service or any data provided through external platform APIs."],
      },
      {
        title: "8. Changes to These Terms",
        paragraphs: ["We reserve the right to modify or update these Terms of Service as necessary to reflect changes in operational practices, technical capabilities, platform policies, or legal requirements. Any updates will be published on this page with a revised “Last Updated” timestamp."],
      },
      {
        title: "9. Contact",
        paragraphs: ["For questions regarding these Terms of Service, developer integration inquiries, or technical support, please contact the operations engineering team using the information below."],
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
    documentLabel: "服务条款",
    officialPolicyLabel: "正式政策",
    effectiveLabel: "生效日期",
    effectiveDate: "2026年8月14日",
    productLabel: "产品",
    overviewTitle: "概述与目的说明",
    overviewText: "OPPO Retail TikTok Monitor 是面向经授权的 OPPO 零售运营人员和门店经理的内部企业零售运营仪表板。该应用用于集中查看并监控已授权的官方 TikTok 零售门店账户及其运营指标。",
    sections: [
      {
        title: "1. 服务目的",
        paragraphs: [
          "OPPO Retail TikTok Monitor（以下简称“本服务”）是一款内部运营管理与数据分析工具，仅供 OPPO 零售运营团队、区域主管及经授权的门店管理员使用。",
          "本服务的主要目的是让获授权人员能够在统一运营界面中监控运营绩效指标、跟踪关注者增长趋势、分析互动数据，并管理已连接的官方零售门店 TikTok 账户中的客户咨询回复流程。",
        ],
      },
      {
        title: "2. 授权使用",
        paragraphs: ["本服务仅限已获得授权、已配置经过验证的公司账户并具有经确认的角色权限的企业人员访问。"],
        bullets: [
          { text: "用户仅可将本服务用于合法的内部零售门店运营、业务报告和官方门店绩效监控。" },
          { text: "严禁共享登录凭证、向第三方提供访问权限、进行自动化批量抓取或尝试绕过安全控制。" },
          { text: "任何未经授权的访问或滥用行为都可能导致权限被立即撤销，并可能受到企业纪律或法律措施处理。" },
        ],
      },
      {
        title: "3. TikTok 账户授权",
        paragraphs: ["本服务通过官方 TikTok Developer API 和标准 OAuth 2.0 授权协议与 TikTok 集成。"],
        bullets: [
          { label: "明确同意", text: "只有经授权的门店账户管理员才能通过官方 TikTok OAuth 授权流程，将官方 TikTok 门店账户连接到本服务。" },
          { label: "最小权限范围", text: "本服务仅请求获取运营指标所必需的最小 API 权限，例如账户资料、关注者分析及互动量统计。" },
          { label: "撤销授权", text: "门店管理员可随时通过 TikTok 账户设置或本服务的管理界面断开账户连接或撤销 API 授权。" },
        ],
      },
      {
        title: "4. 数据使用",
        paragraphs: ["我们致力于以安全、透明的方式处理所有运营数据，并严格遵守平台开发者政策及适用的数据隐私法规。"],
        cards: [
          { title: "仅用于内部运营", text: "通过 TikTok API 获取的数据仅用于内部运营仪表板及零售绩效分析。" },
          { title: "不出售或转移给第三方", text: "我们不会向外部第三方广告商或数据经纪商出售、出租、变现或转移 TikTok 用户或门店数据。" },
          { title: "传输中与静态数据加密", text: "所有网络通信均强制使用 TLS 1.3/HTTPS。OAuth Token 和敏感密钥在存储时使用行业标准的加密算法进行保护。" },
          { title: "数据保留与删除", text: "数据仅在活跃零售监控所需期间保留。账户断开连接后，相关 Token 和缓存指标将依据数据保留政策清除。" },
        ],
      },
      {
        title: "5. 用户责任",
        paragraphs: ["获得本服务访问权限的用户同意："],
        bullets: [
          { text: "维护其身份验证凭证的机密性与安全性。" },
          { text: "发现疑似安全事件或未经授权的活动时，及时向 IT 安全团队报告。" },
          { text: "遵守所有适用的公司政策、当地隐私法律，以及 TikTok 的服务条款和开发者政策。" },
          { text: "仅将仪表板中查看的数据用于经授权的公司业务目的。" },
        ],
      },
      {
        title: "6. 服务可用性",
        paragraphs: ["我们努力维持本服务的高可用性和可靠性，但本服务按“现状”和“可用状态”提供。计划维护、网络升级或外部第三方 API 服务中断可能会偶尔影响服务可用性。"],
      },
      {
        title: "7. 责任限制",
        paragraphs: ["在适用法律允许的最大范围内，OPPO、其关联方、开发者及服务提供商不对因使用或无法使用本服务，或因外部平台 API 提供的数据而产生的任何间接、附带、后果性、特殊或惩罚性损害承担责任。"],
      },
      {
        title: "8. 条款变更",
        paragraphs: ["我们保留根据运营方式、技术能力、平台政策或法律要求的变化，对本服务条款进行必要修改或更新的权利。任何更新都会发布在本页面，并标明更新后的“最后更新”日期。"],
      },
      {
        title: "9. 联系方式",
        paragraphs: ["如对本服务条款、开发者集成或技术支持有任何问题，请通过以下信息联系运营工程团队。"],
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

export function TermsContent() {
  return <PolicyDocument content={content} />;
}
