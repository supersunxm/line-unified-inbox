"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import type { ApiCustomerEvent } from "@/types/api";
import { ApiError, api } from "@/lib/api";
import { CustomerSignals } from "./components/customer/customer-signals";
import { AUTH_UNAUTHORIZED_EVENT, routeAfterLogin } from "@/lib/auth-session";
import { ThemeControl } from "./theme";
import type { PrimarySection } from "./primary-navigation";
import { applyStoreMasterSelection, clearStoreMasterSelection, synchronizedStoreMasterData } from "./store-master-form";
import { formatRelativeTime } from "./relative-time";
import { MessageImage } from "./message-image";
import { MessageTranslationAction } from "./message-translation-action";
import { isValidCanonicalWebhookUrl } from "./webhook-url";
import { openLineOaManager } from "./line-oa-manager";
import { buildChatsHref, readChatRouteFilters } from "./workspace-routing";
import { FollowerInsightsView } from "./follower-insights/follower-insights-view";
import { ClassificationInsightsView } from "./classification-insights/classification-insights-view";
import { followerInsightsTranslations } from "./follower-insights/follower-insights-translations";
import { getInclusiveCalendarDays } from "./follower-insights/follower-insights-utils";
import { FriendSourceLinksView } from "./friend-source-links/friend-source-links-view";
import { DashboardView } from "./dashboard/dashboard-view";
import { AppShell, ContextSidebar, PageContainer } from "@/components/shell";
import type { SidebarView } from "@/components/shell";
import { StoreChatsOverflowMenu } from "@/components/chats/store-chats-overflow-menu";
import { ResizableSeparator } from "./resizable-separator";
import { CHAT_PANE_LIMITS } from "./resizable-panes";
import { useResizablePanes } from "./use-resizable-panes";
import { ConversationPaginationFooter } from "./conversation-pagination-footer";
import { ConversationRowSkeleton } from "./conversation-row-skeleton";
import { getChatsPaginationText } from "./chats-pagination-utils";
import { buildConversationListQuery, conversationListQueryKey, LatestConversationRequestGuard, reconcileConversationPage, type ConversationListQuery } from "./conversation-list-query";
import { getConversationListTags, getConversationListTitle } from "./conversation-list-presentation";
import type { ApiBmReplyStatus, ApiConversation, ApiCustomerIntelligence, ApiFollowUpStatus, ApiStore, BackfillJobResponseDto, BmReplyStatusSummaryResponse, ConversationMessagesResponse, CreateLineOaInput, DashboardAnalyticsResponse, LineOfficialAccountResponse, LineOaTestResult, LineOaWebhookInfo, StoreDeletionPreview, StoreMasterSuggestion, SyncBatchResult } from "@/types/api";

type Language = "th" | "en" | "zh";
type FollowUpStatus =
  | "followUp"
  | "reminded"
  | "acknowledged"
  | "completed"
  | "escalated";
type Priority = "High" | "Normal";
type StatusFilter = FollowUpStatus | "all";
type PriorityFilter = Priority | "all";
type ActivityHistoryItem = {
  id: string;
  status: FollowUpStatus | null;
  bmReplyStatus?: ApiBmReplyStatus | null;
  timestamp: string;
  actionType: "status" | "messageReceived" | "bmReplyStatus";
};

export const bmReplyStatusLabels: Record<Language, Record<ApiBmReplyStatus, string>> = {
  th: {
    NOT_REPLIED: "ยังไม่ตอบ",
    NOTIFIED_BM: "แจ้ง BM แล้ว",
    REPLIED: "ตอบแล้ว",
  },
  en: {
    NOT_REPLIED: "Not replied",
    NOTIFIED_BM: "BM notified",
    REPLIED: "Replied",
  },
  zh: {
    NOT_REPLIED: "尚未回复",
    NOTIFIED_BM: "已通知 BM",
    REPLIED: "已回复",
  },
};

export const CONVERSATION_PAGE_SIZE = 40;

type UiPreferences = {
  language: Language;
  searchText: string;
  sidebarView: SidebarView;
  store: string;
  status: StatusFilter;
  priority: PriorityFilter;
  series: string;
  model: string;
  topic: string;
  lineOa: string;
};

type StoreMasterSearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "success"; query: string; suggestions: StoreMasterSuggestion[] }
  | { status: "error"; query: string; message: string };

type ConversationState = {
  status: FollowUpStatus;
  bmReplyStatus: ApiBmReplyStatus;
  note: string;
  activityHistory: ActivityHistoryItem[];
};
type Conversation = {
  id: string;
  customer: string;
  store: string;
  storeId: string;
  message: string;
  messageLanguage: Language;
  translations: Record<Language, string>;
  time: string;
  product: string;
  series: string;
  topic: string;
  priority: Priority;
  bmReplyStatus: ApiBmReplyStatus;
  relationship: string;
  purchaseIntent: string;
  lineOaId: string;
  lineOaName: string;
};

const CONVERSATION_STATES_STORAGE_KEY = "oppo-line-oa-conversation-states";
const LEGACY_CONVERSATION_STATES_STORAGE_KEY =
  "oppo-line-oa-conversation-states-legacy";
const UI_PREFERENCES_STORAGE_KEY = "oppo-line-oa-monitor-ui-preferences";

const translations = {
  th: {
    appName: "OPPO LINE OA Monitor",
    appDescription: "ระบบติดตามข้อความจาก LINE OA ของร้านค้า",
    searchPlaceholder: "ค้นหาลูกค้า ร้านค้า หรือข้อความ",
    language: "ภาษา",

    overview: "ภาพรวม",
    dashboard: "แดชบอร์ด",
    incoming: "ข้อความเข้าใหม่",
    customerIntelligence: "ข้อมูลเชิงลึกลูกค้า",
    customerStage: "สถานะลูกค้า",
    intent: "ความตั้งใจ",
    interestedProducts: "ผลิตภัณฑ์ที่สนใจ",
    recommendedActions: "คำแนะนำการดำเนินการ",
    confidence: "ความมั่นใจ",
    evidence: "หลักฐาน",
    loadingCustomerIntelligence: "กำลังโหลดข้อมูลเชิงลึกลูกค้า...",
    noCustomerIntelligence: "ไม่พบข้อมูลเชิงลึกของลูกค้า",
    noEvidence: "ไม่มีหลักฐานเพิ่มเติม",
    none: "ไม่มี",
    followUp: "ต้องติดตาม",
    reminded: "เตือนแล้ว",
    stores: "ร้านค้า",
    storeManagement: "จัดการร้านค้า",
    customerInsights: "ข้อมูลเชิงลึกลูกค้า",

    conversationsToFollow: "ข้อความที่ควรติดตาม",
    conversations: "บทสนทนา",
    filter: "ตัวกรอง",
    moreFilters: "กรองเพิ่มเติม",
    storeFilter: "ร้านค้า",
    statusFilter: "สถานะ",
    priorityFilter: "ความสำคัญ",
    seriesFilter: "กลุ่มผลิตภัณฑ์",
    modelFilter: "รุ่นสินค้า",
    allStores: "ร้านค้าทั้งหมด",
    allStatuses: "สถานะทั้งหมด",
    allPriorities: "ความสำคัญทั้งหมด",
    allSeries: "ทุกกลุ่มผลิตภัณฑ์",
    allModels: "ทุกรุ่นสินค้า",
    clearFilter: "ล้างตัวกรอง",
    clearAll: "ล้างทั้งหมด",
    noConversationsFound: "ไม่พบบทสนทนา",
    noResultsExplanation:
      "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองเพื่อดูบทสนทนาอื่น",
    searchFilter: "ค้นหา",
    searchResults: "ผลลัพธ์",
    topicFilter: "หัวข้อ",
    allTopics: "ทุกหัวข้อ",
    allLineOa: "LINE OA ทั้งหมด",

    latestMessage: "ข้อความล่าสุดจากลูกค้า",
    originalMessage: "ข้อความต้นฉบับ",
    translatedMessage: "ข้อความแปล",
    translateMessage: "ดูคำแปล",
    showOriginal: "ดูต้นฉบับ",

    productInsight: "ข้อมูลสินค้า",
    productCategory: "ประเภทสินค้า",
    productSeries: "กลุ่มผลิตภัณฑ์",
    productModel: "รุ่นสินค้า",
    customerRelationship: "สถานะความสัมพันธ์กับสินค้า",
    purchaseIntent: "ความตั้งใจซื้อ",

    conversationTopics: "หัวข้อสนทนา",
    internalNote: "บันทึกภายใน",
    notePlaceholder: "เพิ่มหมายเหตุสำหรับติดตามร้าน...",
    noteSaveHint: "บันทึกเมื่อออกจากช่องข้อความ",

    storeFollowUp: "การติดตามร้านค้า",
    currentStatus: "สถานะปัจจุบัน",
    waitingTime: "ระยะเวลารอ",
    reminder: "การแจ้งเตือน",
    storeManager: "ผู้จัดการร้าน",

    followUpStore: "ควรติดตามร้าน",
    notSent: "ยังไม่ได้ส่ง",
    notConfirmed: "ยังไม่ยืนยัน",

    remindManager: "เตือนผู้จัดการร้าน",
    managerAcknowledged: "ผู้จัดการรับทราบแล้ว",
    actionCompleted: "ดำเนินการแล้ว",
    escalate: "ส่งต่อหัวหน้า",

    messageReceived: "ข้อความเข้ามาเมื่อ",
    lineNameHistory: "ประวัติชื่อ LINE",
    currentLineName: "ชื่อล่าสุดใน LINE",
    noNameHistory: "ยังไม่มีประวัติชื่อก่อนหน้านี้",
    nameHistorySource: "ที่มาของข้อมูล",

    highPriority: "ความสำคัญสูง",
    normalPriority: "ความสำคัญปกติ",

    interested: "สนใจสินค้า",
    highIntent: "มีแนวโน้มซื้อสูง",

    automaticTranslation: "แปลข้อความอัตโนมัติ",
    translationNotice:
      "ขณะนี้เป็นคำแปลตัวอย่าง ระบบแปลจริงจะเชื่อมต่อ Translation API ภายหลัง",
    resetTestData: "รีเซ็ตตัวกรอง UI",
    resetTestDataConfirmation:
      "คุณต้องการล้างตัวกรองและการตั้งค่า UI หรือไม่ ข้อมูลบทสนทนาจะไม่ถูกลบ",
    returnToFollowUp: "กลับไปติดตาม",
    activityHistory: "ประวัติการดำเนินการ",
    statusChangedTo: "เปลี่ยนสถานะเป็น",
    bmReplyStatus: "สถานะการตอบ BM",
    bmReplyStatusChangedTo: "เปลี่ยนสถานะการตอบ BM เป็น",
    notReplied: "ยังไม่ตอบ",
    notifiedBm: "แจ้ง BM แล้ว",
    replied: "ตอบแล้ว",
    noActivity: "ยังไม่มีประวัติ",
    messageReceivedActivity: "ได้รับข้อความลูกค้าใหม่",
    customerImage: "รูปภาพจากลูกค้า",
    imageUnavailable: "รูปภาพไม่ได้ถูกจัดเก็บในระบบ",
    imageLoadError: "ไม่สามารถโหลดรูปภาพได้",
    retryImage: "ลองอีกครั้ง",
    webhookCreationIncomplete: "สร้าง LINE OA แล้ว แต่ไม่ได้รับ Webhook URL ที่ถูกต้อง โปรดรีเฟรชและตรวจสอบรายการก่อนลองอีกครั้ง",
    toastMoved: "ย้ายบทสนทนาไปที่",
    toastReturned: "ย้ายบทสนทนากลับไปที่",
    totalIncoming: "บทสนทนาเข้าทั้งหมด",
    followUpRequired: "ต้องติดตาม",
    remindersSent: "ส่งการเตือนแล้ว",
    acknowledgedKpi: "ผู้จัดการรับทราบ",
    completedKpi: "ดำเนินการแล้ว",
    escalatedKpi: "ส่งต่อหัวหน้า",
    storeMonitoringOverview: "ภาพรวมการติดตามร้านค้า",
    total: "ทั้งหมด",
    highestPriority: "ความสำคัญสูงสุด",
    action: "ดำเนินการ",
    openStore: "เปิดร้านค้า",
    mostDiscussedModels: "รุ่น OPPO ที่ถูกพูดถึงมากที่สุด",
    topConversationTopics: "หัวข้อสนทนายอดนิยม",
    storesRequiringAttention: "ร้านค้าที่ต้องดูแล",
    recentMonitoringActivity: "กิจกรรมการติดตามล่าสุด",
    conversationCount: "จำนวนบทสนทนา",
    noDashboardData: "ยังไม่มีข้อมูลสำหรับแสดง",
    openConversation: "เปิดบทสนทนา",
    lineOaManagement: "จัดการ LINE OA",
    systemStatus: "สถานะระบบ",
    refreshStatus: "รีเฟรชสถานะ",
    pilotChecklist: "รายการตรวจสอบ Pilot",
    lineOaDescription: "เชื่อมต่อและตรวจสอบบัญชี LINE Official Account ของแต่ละร้าน",
    connectLineOa: "เชื่อมต่อ LINE OA",
    exportCsv: "ดาวน์โหลด CSV",
    exportingCsv: "กำลังสร้าง CSV...",
    exportCsvFailed: "ดาวน์โหลด CSV ไม่สำเร็จ กรุณาลองอีกครั้ง",
    syncMasterFile: "↻ Sync Master File",
    syncingMasterFile: "กำลัง Sync...",
    syncMasterSuccess: "Sync สำเร็จ",
    syncMasterFailed: "Sync Master File ไม่สำเร็จ",
    lineOaAdded: "เพิ่มร้านสำเร็จ",
    pasteWebhookInstruction: "นำ URL นี้ไปวางใน LINE Developers Console → Messaging API → Webhook URL",
    advancedSettings: "การตั้งค่าขั้นสูง (ไม่บังคับ)",
    autoCreateStore: "สร้างร้านใหม่อัตโนมัติจากชื่อ LINE OA",
    rotateCredentialsWarning: "คำเตือนด้านความปลอดภัย: หาก Channel Secret หรือ Access Token เคยปรากฏในภาพหน้าจอ ให้เปลี่ยนข้อมูลทั้งสองใน LINE Developers Console ก่อนใช้งาน",
    regenerateWebhook: "สร้าง Webhook URL ใหม่",
    regenerateWebhookConfirmation: "สร้าง Webhook URL ใหม่หรือไม่? URL เดิมจะใช้งานไม่ได้ทันที",
    webhookRegenerated: "สร้าง Webhook URL ใหม่แล้ว โปรดอัปเดต Webhook URL ใน LINE Developers Console",
    close: "ปิด",
    goToLineOaManagement: "ไปที่หน้าจัดการ LINE OA",
    accessTokenInvalid: "ต้องกรอก Channel Access Token ใหม่",
    totalLineOa: "LINE OA ทั้งหมด",
    activeLineOa: "ใช้งานอยู่",
    connectionIssues: "ปัญหาการเชื่อมต่อ",
    messagesToday: "ข้อความวันนี้",
    basicId: "Basic ID",
    channelId: "Channel ID",
    destinationId: "Destination ID",
    channelIdHelp: "ดูได้ที่ LINE Developers Console > Basic settings",
    destinationIdHelp: "ดูได้ที่ LINE Developers Console > Messaging API (ไม่ใช่ Channel ID)",
    channelSecretHelp: "ใช้ Channel Secret จาก Basic settings ไม่ใช่ Channel Access Token",
    connectionStatus: "สถานะการเชื่อมต่อ",
    webhookUrl: "Webhook URL",
    lastWebhook: "Webhook ล่าสุด",
    viewConversations: "ดูบทสนทนา",
    testConnection: "ทดสอบการเชื่อมต่อ",
    copyWebhook: "คัดลอก Webhook URL",
    copied: "คัดลอกแล้ว",
    edit: "แก้ไข",
    activate: "เปิดใช้งาน",
    disable: "ปิดใช้งาน",
    connected: "เชื่อมต่อแล้ว",
    ready: "พร้อมใช้งาน",
    notConfigured: "ยังไม่ตั้งค่า",
    webhookNotConfigured: "ยังไม่ได้ตั้งค่า Webhook URL",
    publicWebhookRequired: "ต้องใช้ URL สาธารณะของแบ็กเอนด์ที่เป็น HTTPS เพื่อรับ LINE Webhook",
    publicWebhookSetupTitle: "ต้องตั้งค่า Webhook URL สำหรับการพัฒนา",
    backendPortLabel: "พอร์ตแบ็กเอนด์",
    expectedWebhookPath: "พาธ Webhook ที่ต้องใช้",
    tunnelExample: "ตัวอย่างคำสั่งเปิด tunnel",
    setWebhookEnvironment: "ตั้งค่า PUBLIC_WEBHOOK_BASE_URL ใน backend/.env เป็น URL HTTPS ที่ได้จาก tunnel",
    restartBackend: "รีสตาร์ตแบ็กเอนด์หลังแก้ไขไฟล์ .env",
    missingChannelId: "ยังไม่ได้ระบุ Channel ID",
    missingDestinationId: "ยังไม่ได้ระบุ Destination ID",
    missingChannelSecret: "ยังไม่ได้ระบุ Channel Secret",
    missingPublicWebhookUrl: "ยังไม่ได้ตั้งค่า URL Webhook สาธารณะ",
    credentialDecryptionError: "ถอดรหัสข้อมูลรับรองไม่สำเร็จ โปรดบันทึก Channel Secret ใหม่",
    credentialsReady: "พร้อมใช้งาน",
    reenterChannelSecret: "ต้องกรอก Channel Secret ใหม่",
    credentialDecryptionFailed: "ไม่สามารถถอดรหัสข้อมูลเชื่อมต่อได้",
    connectionError: "เกิดข้อผิดพลาด",
    disabled: "ปิดใช้งาน",
    channelSecret: "Channel Secret",
    accessToken: "Channel Access Token",
    createNewStore: "สร้างร้านค้าใหม่",
    storeName: "ชื่อร้านค้า",
    searchAccountName: "ค้นหาจาก ACCOUNT NAME",
    selectStore: "เลือกร้านค้า",
    accountName: "ชื่อบัญชี",
    storeIdLabel: "รหัสร้านค้า",
    province: "จังหวัด",
    lineIdLabel: "LINE ID",
    masterFile: "Master File",
    systemSuggested: "ระบบแนะนำ",
    storeAlreadyExists: "ร้านค้านี้มีอยู่แล้ว",
    openExistingStore: "เปิดร้านค้าที่มีอยู่",
    openLineManager: "เปิด LINE OA Manager",
    openLineOa: "เปิดหน้า LINE OA",
    noMatchingAccount: "ไม่พบบัญชีที่ตรงกัน",
    syncedStoreMasterTitle: "ข้อมูลร้านค้าที่ซิงก์จาก Store Master",
    manualFallbackHint: "ไม่พบข้อมูล Store Master คุณยังสามารถกรอกข้อมูล LINE OA ด้วยตนเองได้",
    searchingStoreMaster: "กำลังค้นหา...",
    storeMasterSearchFailed: "ไม่สามารถค้นหาข้อมูลร้านได้ กรุณาตรวจสอบว่า Store Master API และข้อมูลนำเข้าแล้ว",
    multipleMatches: "พบหลายรายการ โปรดเลือกร้านค้าที่ถูกต้อง",
    incompleteMasterData: "ข้อมูล Master ไม่ครบถ้วน",
    noMasterUrl: "ไม่มี URL ใน Master File",
    dataSource: "แหล่งข้อมูล",
    storeCode: "รหัสร้านค้า",
    region: "ภูมิภาค",
    area: "พื้นที่",
    activeStatus: "เปิดใช้งาน",
    saveConnection: "บันทึกการเชื่อมต่อ",
    cancel: "ยกเลิก",
    requiredFields: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน",
    noLineOa: "ยังไม่ได้เชื่อมต่อ LINE OA",
    showArchived: "แสดงรายการที่เก็บถาวร",
    removeLineOa: "ลบ LINE OA",
    removeStore: "ลบร้านค้า",
    removeStoreQuestion: "คุณต้องการลบร้าน “{storeName}” ออกจากระบบหรือไม่",
    deletePermanently: "ลบถาวร",
    archiveStore: "เก็บเข้าคลัง",
    permanentDeleteDescription: "การลบถาวรจะลบข้อมูลร้านและข้อมูลที่เกี่ยวข้องทั้งหมด และไม่สามารถกู้คืนได้",
    archiveDescription: "การเก็บเข้าคลังจะซ่อนร้าน แต่ยังเก็บประวัติไว้",
    irreversibleWarning: "การดำเนินการนี้ไม่สามารถย้อนกลับได้",
    typeStoreName: "พิมพ์ชื่อร้านให้ตรงเพื่อยืนยัน",
    restoreStore: "กู้คืนร้านค้า",
    storeDeletedSuccessfully: "ลบร้านและข้อมูลที่เกี่ยวข้องทั้งหมดแล้ว",
    storeArchivedSuccessfully: "เก็บร้านค้าถาวรแล้ว",
    storeCannotBeDeleted: "ไม่สามารถลบร้านค้านี้ได้",
    storeHasActiveLineOa: "ร้านค้านี้ยังมีบัญชี LINE OA ที่ใช้งานอยู่",
    historicalDataPreserved: "ข้อมูลประวัติทั้งหมดจะถูกเก็บรักษาไว้",
    noStoresFound: "ไม่พบร้านค้า",
    hideArchivedStores: "ซ่อนร้านค้าที่เก็บถาวร",
    lineOaAccountsCount: "บัญชี LINE OA",
    conversationCountLabel: "บทสนทนา",
    messageCountLabel: "ข้อความ",
    noteActivityCountLabel: "โน้ต/กิจกรรม",
    openLineOaManagement: "เปิดหน้าจัดการ LINE OA",
    restoreLineOa: "กู้คืน LINE OA",
    removeLineOaConfirmation: "ยืนยันการลบ LINE OA นี้หรือไม่? หากมีประวัติ ระบบจะเก็บถาวรแทนการลบถาวร",
    profileUnavailable: "ไม่สามารถโหลดโปรไฟล์ได้",
    refreshLineProfile: "รีเฟรชโปรไฟล์ LINE",
    loadEarlierMessages: "โหลดข้อความก่อนหน้า",
    repliesMayNotAppear: "ข้อความตอบกลับจาก LINE OA Manager อาจไม่แสดงที่นี่",
    noMessages: "ไม่มีข้อความในบทสนทนานี้",
    reanalyzeConversation: "วิเคราะห์ข้อความใหม่",
    classificationUpdated: "วิเคราะห์บทสนทนาใหม่แล้ว",
    editTags: "แก้ไขแท็ก",
    noProductDetected: "ยังไม่พบข้อมูลผลิตภัณฑ์",
    noTopicDetected: "ไม่พบหัวข้อ",
    autoSource: "อัตโนมัติ",
    manualSource: "กำหนดเอง",
    showSecret: "แสดง",
    hideSecret: "ซ่อน",
    setupInstructions: "ขั้นตอนตั้งค่า LINE Developers Console",
    testNoWebhook: "ตั้งค่าครบแล้ว แต่ยังไม่ได้รับ Webhook",
    lineOaName: "ชื่อ LINE OA",
    setupSteps: ["เปิด LINE Developers Console", "เลือกช่อง Messaging API", "เปิดการตั้งค่า Messaging API", "วาง Webhook URL", "คลิก Verify", "เปิด Use webhook", "ปิดข้อความตอบกลับอัตโนมัติหากจำเป็น", "ส่งข้อความทดสอบ", "กลับมาที่หน้านี้แล้วคลิกทดสอบการเชื่อมต่อ"],
    loadingData: "กำลังโหลดข้อมูลจากระบบ...",
    apiError: "ไม่สามารถเชื่อมต่อระบบข้อมูลได้",
    retry: "ลองอีกครั้ง",
    lastUpdated: "อัปเดตล่าสุด",
    needMoreConversationData: "ต้องการข้อมูลบทสนทนาเพิ่มเติม",
    aiSalesFollowUp: "ติดตามการขายลูกค้า",
    aiProductSpecificAction: "แนะนำข้อมูลผลิตภัณฑ์",
    aiReviewConversation: "ทบทวนบทสนทนาลูกค้า",
    aiInsightError: "ไม่สามารถโหลดการวิเคราะห์ AI ได้",
    aiInsightSummary: "สรุปการวิเคราะห์ลูกค้า",
    recommendedActionsCardSubtext: "ข้อเสนอแนะในการดำเนินการถัดไปเพื่อผลลัพธ์ที่ดีที่สุด",
    hideEvidenceDetails: "ซ่อนรายละเอียดหลักฐาน",
    showEvidenceDetails: "แสดงรายละเอียดหลักฐาน",
    aiRecommendedNextAction: "คำแนะนำการดำเนินการถัดไปโดย AI",
    noAiInsightAvailable: "ยังไม่มีคำแนะนำเพิ่มเติมในขณะนี้",
  },

  en: {
    appName: "OPPO LINE OA Monitor",
    appDescription: "Store LINE OA conversation monitoring system",
    searchPlaceholder: "Search customers, stores, or messages",
    language: "Language",

    overview: "Overview",
    dashboard: "Dashboard",
    incoming: "Incoming",
    followUp: "Follow-up",
    reminded: "Reminded",
    stores: "Stores",
    storeManagement: "Store Management",
    customerInsights: "Customer Insights",
    customerIntelligence: "Customer intelligence",
    customerStage: "Customer stage",
    intent: "Intent",
    interestedProducts: "Interested products",
    recommendedActions: "Recommended actions",
    confidence: "Confidence",
    evidence: "Evidence",
    loadingCustomerIntelligence: "Loading customer intelligence...",
    noCustomerIntelligence: "No customer intelligence available",
    noEvidence: "No evidence available",
    none: "None",

    conversationsToFollow: "Conversations to Follow Up",
    conversations: "conversations",
    filter: "Filter",
    moreFilters: "More filters",
    storeFilter: "Store",
    statusFilter: "Status",
    priorityFilter: "Priority",
    seriesFilter: "Series",
    modelFilter: "Model",
    allStores: "All Stores",
    allStatuses: "All Statuses",
    allPriorities: "All Priorities",
    allSeries: "All Series",
    allModels: "All Models",
    clearFilter: "Clear Filter",
    clearAll: "Clear All",
    noConversationsFound: "No conversations found",
    noResultsExplanation:
      "Try changing your search or clearing the filters to see other conversations.",
    searchFilter: "Search",
    searchResults: "results",
    topicFilter: "Topic",
    allTopics: "All Topics",
    allLineOa: "All LINE OA",

    latestMessage: "Latest Customer Message",
    originalMessage: "Original Message",
    translatedMessage: "Translated Message",
    translateMessage: "Show Translation",
    showOriginal: "Show Original",

    productInsight: "Product Insight",
    productCategory: "Product Category",
    productSeries: "Product Series",
    productModel: "Product Model",
    customerRelationship: "Product Relationship",
    purchaseIntent: "Purchase Intent",

    conversationTopics: "Conversation Topics",
    internalNote: "Internal Note",
    notePlaceholder: "Add a note for store follow-up...",
    noteSaveHint: "Saves when you leave the field",

    storeFollowUp: "Store Follow-up",
    currentStatus: "Current Status",
    waitingTime: "Waiting Time",
    reminder: "Reminder",
    storeManager: "Store Manager",

    followUpStore: "Follow Up Store",
    notSent: "Not Sent",
    notConfirmed: "Not Confirmed",

    remindManager: "Remind Store Manager",
    managerAcknowledged: "Manager Acknowledged",
    actionCompleted: "Action Completed",
    escalate: "Escalate",

    messageReceived: "Message received",
    lineNameHistory: "LINE Name History",
    currentLineName: "Current LINE Name",
    noNameHistory: "No previous name history available",
    nameHistorySource: "Source",

    highPriority: "High Priority",
    normalPriority: "Normal Priority",

    interested: "Interested",
    highIntent: "High Intent",

    automaticTranslation: "Automatic Message Translation",
    translationNotice:
      "This is currently a sample translation. A real Translation API will be connected later.",
    resetTestData: "Reset UI Filters",
    resetTestDataConfirmation:
      "Clear UI filters and preferences? Conversation data will not be deleted.",
    returnToFollowUp: "Return to Follow-up",
    activityHistory: "Activity History",
    statusChangedTo: "Status changed to",
    bmReplyStatus: "BM Reply Status",
    bmReplyStatusChangedTo: "BM reply status changed to",
    notReplied: "Not replied",
    notifiedBm: "BM notified",
    replied: "Replied",
    noActivity: "No activity yet",
    messageReceivedActivity: "New customer message received",
    customerImage: "Image from customer",
    imageUnavailable: "This image was not stored in the system",
    imageLoadError: "Unable to load image",
    retryImage: "Retry",
    webhookCreationIncomplete: "The LINE OA was created, but no valid webhook URL was returned. Refresh and review the record before retrying.",
    toastMoved: "Conversation moved to",
    toastReturned: "Conversation returned to",
    totalIncoming: "Total Incoming Conversations",
    followUpRequired: "Follow-up Required",
    remindersSent: "Reminders Sent",
    acknowledgedKpi: "Manager Acknowledged",
    completedKpi: "Completed",
    escalatedKpi: "Escalated",
    storeMonitoringOverview: "Store Monitoring Overview",
    total: "Total",
    highestPriority: "Highest Priority",
    action: "Action",
    openStore: "Open Store",
    mostDiscussedModels: "Most Discussed OPPO Models",
    topConversationTopics: "Top Conversation Topics",
    storesRequiringAttention: "Stores Requiring Attention",
    recentMonitoringActivity: "Recent Monitoring Activity",
    conversationCount: "Conversation Count",
    noDashboardData: "No data available yet",
    openConversation: "Open Conversation",
    lineOaManagement: "LINE OA Management",
    systemStatus: "System Status",
    refreshStatus: "Refresh Status",
    pilotChecklist: "Pilot Checklist",
    lineOaDescription: "Connect and monitor each store’s LINE Official Account",
    connectLineOa: "Connect LINE OA",
    exportCsv: "Export CSV",
    exportingCsv: "Generating CSV...",
    exportCsvFailed: "CSV download failed. Please try again.",
    syncMasterFile: "↻ Sync Master File",
    syncingMasterFile: "Syncing...",
    syncMasterSuccess: "Sync succeeded",
    syncMasterFailed: "Master File sync failed",
    lineOaAdded: "LINE OA added successfully",
    pasteWebhookInstruction: "Paste this URL into LINE Developers Console → Messaging API → Webhook URL",
    advancedSettings: "Advanced settings (optional)",
    autoCreateStore: "Automatically create a store using the LINE OA name",
    rotateCredentialsWarning: "Security warning: if a Channel Secret or Access Token appeared in a screenshot, rotate both credentials in LINE Developers Console before use.",
    regenerateWebhook: "Regenerate Webhook URL",
    regenerateWebhookConfirmation: "Regenerate this Webhook URL? The previous URL will stop working immediately.",
    webhookRegenerated: "Webhook URL regenerated. Update the Webhook URL in LINE Developers Console",
    close: "Close",
    goToLineOaManagement: "Go to LINE OA Management",
    accessTokenInvalid: "Channel Access Token invalid or missing",
    totalLineOa: "Total LINE OA",
    activeLineOa: "Active",
    connectionIssues: "Connection Issues",
    messagesToday: "Messages Received Today",
    basicId: "Basic ID",
    channelId: "Channel ID",
    destinationId: "Destination ID",
    channelIdHelp: "Find this in LINE Developers Console > Basic settings.",
    destinationIdHelp: "Find this in LINE Developers Console > Messaging API; it is not the Channel ID.",
    channelSecretHelp: "Use the Channel Secret from Basic settings, not the Channel Access Token.",
    connectionStatus: "Connection Status",
    webhookUrl: "Webhook URL",
    lastWebhook: "Last Webhook",
    viewConversations: "View Conversations",
    testConnection: "Test Connection",
    copyWebhook: "Copy Webhook URL",
    copied: "Copied",
    edit: "Edit",
    activate: "Activate",
    disable: "Disable",
    connected: "Connected",
    ready: "Ready",
    notConfigured: "Not Configured",
    webhookNotConfigured: "Webhook URL not configured",
    publicWebhookRequired: "A public HTTPS backend URL is required to receive LINE webhooks.",
    publicWebhookSetupTitle: "Development webhook setup required",
    backendPortLabel: "Backend port",
    expectedWebhookPath: "Expected webhook path",
    tunnelExample: "Example tunnel command",
    setWebhookEnvironment: "Set PUBLIC_WEBHOOK_BASE_URL in backend/.env to the tunnel’s HTTPS URL.",
    restartBackend: "Restart the backend after changing the .env file.",
    missingChannelId: "Missing Channel ID",
    missingDestinationId: "Missing Destination ID",
    missingChannelSecret: "Missing Channel Secret",
    missingPublicWebhookUrl: "Missing public webhook URL",
    credentialDecryptionError: "Credential decryption failed. Save the Channel Secret again.",
    credentialsReady: "Credentials ready",
    reenterChannelSecret: "Re-enter Channel Secret",
    credentialDecryptionFailed: "Credential decryption failed",
    connectionError: "Error",
    disabled: "Disabled",
    channelSecret: "Channel Secret",
    accessToken: "Channel Access Token",
    createNewStore: "Create a new store",
    storeName: "Store Name",
    searchAccountName: "Search by ACCOUNT NAME",
    selectStore: "Select a store",
    accountName: "Account Name",
    storeIdLabel: "Store ID",
    province: "Province",
    lineIdLabel: "LINE ID",
    masterFile: "Master File",
    systemSuggested: "System suggested",
    storeAlreadyExists: "This store already exists",
    openExistingStore: "Open existing store",
    openLineManager: "Open LINE OA Manager",
    openLineOa: "Open LINE OA",
    noMatchingAccount: "No matching account found",
    syncedStoreMasterTitle: "Store information synced from Store Master",
    manualFallbackHint: "No Store Master record was found. You can still enter the LINE OA details manually.",
    searchingStoreMaster: "Searching...",
    storeMasterSearchFailed: "Unable to search store data. Check that the Store Master API is running and the data has been imported.",
    multipleMatches: "Multiple matches found. Select the correct store.",
    incompleteMasterData: "Incomplete master data",
    noMasterUrl: "No URL in Master File",
    dataSource: "Data source",
    storeCode: "Store Code",
    region: "Region",
    area: "Area",
    activeStatus: "Active",
    saveConnection: "Save Connection",
    cancel: "Cancel",
    requiredFields: "Complete all required fields.",
    noLineOa: "No LINE OA connected yet",
    showArchived: "Show archived",
    removeLineOa: "Remove LINE OA",
    removeStore: "Remove Store",
    removeStoreQuestion: "Do you want to remove “{storeName}” from the system?",
    deletePermanently: "Delete Permanently",
    archiveStore: "Archive Store",
    permanentDeleteDescription: "Permanent deletion removes the store and all related data and cannot be undone.",
    archiveDescription: "Archiving hides the store but preserves its history.",
    irreversibleWarning: "This action cannot be undone.",
    typeStoreName: "Type the exact store name to confirm",
    restoreStore: "Restore Store",
    storeDeletedSuccessfully: "Store and all related data were permanently deleted.",
    storeArchivedSuccessfully: "Store archived successfully",
    storeCannotBeDeleted: "This store cannot be deleted",
    storeHasActiveLineOa: "This store still has active LINE OA accounts",
    historicalDataPreserved: "Historical data will be preserved",
    noStoresFound: "No stores found",
    hideArchivedStores: "Hide archived stores",
    lineOaAccountsCount: "LINE OA accounts",
    conversationCountLabel: "Conversations",
    messageCountLabel: "Messages",
    noteActivityCountLabel: "Notes/activity",
    openLineOaManagement: "Open LINE OA Management",
    restoreLineOa: "Restore LINE OA",
    removeLineOaConfirmation: "Remove this LINE OA? Records with history will be archived instead of permanently deleted.",
    profileUnavailable: "Profile unavailable",
    refreshLineProfile: "Refresh LINE Profile",
    loadEarlierMessages: "Load earlier messages",
    repliesMayNotAppear: "Replies sent in LINE OA Manager may not appear here.",
    noMessages: "No messages in this conversation",
    reanalyzeConversation: "Re-analyze Conversation",
    classificationUpdated: "Conversation classification updated",
    editTags: "Edit Tags",
    noProductDetected: "No product detected",
    noTopicDetected: "No topic detected",
    autoSource: "Auto",
    manualSource: "Manual",
    showSecret: "Show",
    hideSecret: "Hide",
    setupInstructions: "LINE Developers Console Setup",
    testNoWebhook: "Configuration complete; no webhook received yet",
    lineOaName: "LINE OA Name",
    setupSteps: ["Open LINE Developers Console", "Select the Messaging API channel", "Open Messaging API settings", "Paste the webhook URL", "Click Verify", "Enable Use webhook", "Disable automatic response messages if required", "Send a test message", "Return here and click Test Connection"],
    loadingData: "Loading data...",
    apiError: "Unable to connect to the data service",
    retry: "Retry",
    lastUpdated: "Last updated",
    needMoreConversationData: "Need more conversation data",
    aiSalesFollowUp: "Follow up on customer sales lead",
    aiProductSpecificAction: "Recommend product information for",
    aiReviewConversation: "Review customer conversation",
    aiInsightError: "Unable to load AI analysis",
    aiInsightSummary: "Customer Intelligence Summary",
    recommendedActionsCardSubtext: "Suggested next actions for optimal follow-up outcome",
    hideEvidenceDetails: "Hide evidence details",
    showEvidenceDetails: "Show evidence details",
    aiRecommendedNextAction: "AI Recommended Next Action",
    noAiInsightAvailable: "No additional insights available",
  },

  zh: {
    appName: "OPPO LINE OA 监控系统",
    appDescription: "门店 LINE OA 客户消息监控系统",
    searchPlaceholder: "搜索客户、门店或消息",
    language: "语言",

    overview: "总览",
    dashboard: "仪表板",
    incoming: "新消息",
    followUp: "待跟进",
    reminded: "已提醒",
    stores: "门店",
    storeManagement: "门店管理",
    customerInsights: "客户洞察",
    customerIntelligence: "客户情报",
    customerStage: "客户阶段",
    intent: "意图",
    interestedProducts: "感兴趣的产品",
    recommendedActions: "推荐操作",
    confidence: "置信度",
    evidence: "证据",
    loadingCustomerIntelligence: "正在加载客户情报...",
    noCustomerIntelligence: "没有可用的客户情报",
    noEvidence: "没有证据可用",
    none: "无",

    conversationsToFollow: "需要跟进的消息",
    conversations: "个会话",
    filter: "筛选",
    moreFilters: "更多筛选",
    storeFilter: "门店",
    statusFilter: "状态",
    priorityFilter: "优先级",
    seriesFilter: "产品系列",
    modelFilter: "产品型号",
    allStores: "所有门店",
    allStatuses: "所有状态",
    allPriorities: "所有优先级",
    allSeries: "所有系列",
    allModels: "所有型号",
    clearFilter: "清除筛选",
    clearAll: "全部清除",
    noConversationsFound: "未找到会话",
    noResultsExplanation: "请尝试更改搜索内容或清除筛选条件。",
    searchFilter: "搜索",
    searchResults: "个结果",
    topicFilter: "主题",
    allTopics: "所有主题",
    allLineOa: "所有 LINE OA",

    latestMessage: "客户最新消息",
    originalMessage: "原始消息",
    translatedMessage: "翻译消息",
    translateMessage: "查看翻译",
    showOriginal: "查看原文",

    productInsight: "产品信息",
    productCategory: "产品类别",
    productSeries: "产品系列",
    productModel: "产品型号",
    customerRelationship: "客户产品关系",
    purchaseIntent: "购买意向",

    conversationTopics: "会话主题",
    internalNote: "内部备注",
    notePlaceholder: "添加门店跟进备注……",
    noteSaveHint: "离开输入框时保存",

    storeFollowUp: "门店跟进",
    currentStatus: "当前状态",
    waitingTime: "等待时间",
    reminder: "提醒状态",
    storeManager: "门店经理",

    followUpStore: "需要跟进门店",
    notSent: "尚未发送",
    notConfirmed: "尚未确认",

    remindManager: "提醒门店经理",
    managerAcknowledged: "经理已确认",
    actionCompleted: "处理完成",
    escalate: "升级处理",

    messageReceived: "消息收到于",
    lineNameHistory: "LINE 名称历史",
    currentLineName: "当前 LINE 名称",
    noNameHistory: "暂无之前的名称历史",
    nameHistorySource: "来源",

    highPriority: "高优先级",
    normalPriority: "普通优先级",

    interested: "感兴趣",
    highIntent: "高购买意向",

    automaticTranslation: "自动翻译客户消息",
    translationNotice:
      "目前显示的是示例翻译，之后将连接真实的翻译 API。",
    resetTestData: "重置界面筛选",
    resetTestDataConfirmation: "是否清除界面筛选和偏好设置？会话数据不会被删除。",
    returnToFollowUp: "返回待跟进",
    activityHistory: "操作记录",
    statusChangedTo: "状态已更改为",
    bmReplyStatus: "BM 回复状态",
    bmReplyStatusChangedTo: "BM 回复状态已更改为",
    notReplied: "尚未回复",
    notifiedBm: "已通知 BM",
    replied: "已回复",
    noActivity: "暂无操作记录",
    messageReceivedActivity: "收到新的客户消息",
    customerImage: "客户发送的图片",
    imageUnavailable: "该图片未存储在系统中",
    imageLoadError: "无法加载图片",
    retryImage: "重试",
    webhookCreationIncomplete: "LINE OA 已创建，但未返回有效的 Webhook URL。请刷新并检查记录后再重试。",
    toastMoved: "会话已移至",
    toastReturned: "会话已返回",
    totalIncoming: "收到的会话总数",
    followUpRequired: "需要跟进",
    remindersSent: "已发送提醒",
    acknowledgedKpi: "经理已确认",
    completedKpi: "已完成",
    escalatedKpi: "已升级",
    storeMonitoringOverview: "门店监控概览",
    total: "总计",
    highestPriority: "最高优先级",
    action: "操作",
    openStore: "打开门店",
    mostDiscussedModels: "讨论最多的 OPPO 型号",
    topConversationTopics: "热门会话主题",
    storesRequiringAttention: "需要关注的门店",
    recentMonitoringActivity: "最近监控活动",
    conversationCount: "会话数量",
    noDashboardData: "暂无可显示的数据",
    openConversation: "打开会话",
    lineOaManagement: "LINE OA 管理",
    systemStatus: "系统状态",
    refreshStatus: "刷新状态",
    pilotChecklist: "Pilot 检查清单",
    lineOaDescription: "连接并监控各门店的 LINE Official Account",
    connectLineOa: "连接 LINE OA",
    exportCsv: "下载 CSV",
    exportingCsv: "正在生成 CSV...",
    exportCsvFailed: "CSV 下载失败，请重试。",
    syncMasterFile: "↻ 同步 Master File",
    syncingMasterFile: "正在同步...",
    syncMasterSuccess: "同步成功",
    syncMasterFailed: "Master File 同步失败",
    lineOaAdded: "LINE OA 添加成功",
    pasteWebhookInstruction: "请将此 URL 粘贴到 LINE Developers Console → Messaging API → Webhook URL",
    advancedSettings: "高级设置（可选）",
    autoCreateStore: "使用 LINE OA 名称自动创建门店",
    rotateCredentialsWarning: "安全警告：如果 Channel Secret 或 Access Token 曾出现在截图中，请先在 LINE Developers Console 中轮换这两个凭据。",
    regenerateWebhook: "重新生成 Webhook URL",
    regenerateWebhookConfirmation: "确定重新生成 Webhook URL 吗？旧 URL 将立即失效。",
    webhookRegenerated: "Webhook URL 已重新生成。请在 LINE Developers Console 中更新 Webhook URL",
    close: "关闭",
    goToLineOaManagement: "前往 LINE OA 管理",
    accessTokenInvalid: "Channel Access Token 无效或缺失",
    totalLineOa: "LINE OA 总数",
    activeLineOa: "启用",
    connectionIssues: "连接问题",
    messagesToday: "今日收到消息",
    basicId: "Basic ID",
    channelId: "Channel ID",
    destinationId: "Destination ID",
    channelIdHelp: "可在 LINE Developers Console > Basic settings 中找到。",
    destinationIdHelp: "可在 LINE Developers Console > Messaging API 中找到；它不是 Channel ID。",
    channelSecretHelp: "请使用 Basic settings 中的 Channel Secret，而不是 Channel Access Token。",
    connectionStatus: "连接状态",
    webhookUrl: "Webhook URL",
    lastWebhook: "最后 Webhook",
    viewConversations: "查看会话",
    testConnection: "测试连接",
    copyWebhook: "复制 Webhook URL",
    copied: "已复制",
    edit: "编辑",
    activate: "启用",
    disable: "停用",
    connected: "已连接",
    ready: "就绪",
    notConfigured: "未配置",
    webhookNotConfigured: "Webhook URL 未配置",
    publicWebhookRequired: "接收 LINE Webhook 需要一个公开的 HTTPS 后端 URL。",
    publicWebhookSetupTitle: "需要配置开发环境 Webhook",
    backendPortLabel: "后端端口",
    expectedWebhookPath: "预期 Webhook 路径",
    tunnelExample: "Tunnel 命令示例",
    setWebhookEnvironment: "在 backend/.env 中将 PUBLIC_WEBHOOK_BASE_URL 设置为 tunnel 的 HTTPS URL。",
    restartBackend: "修改 .env 文件后请重启后端。",
    missingChannelId: "缺少 Channel ID",
    missingDestinationId: "缺少 Destination ID",
    missingChannelSecret: "缺少 Channel Secret",
    missingPublicWebhookUrl: "缺少公开 Webhook URL",
    credentialDecryptionError: "凭据解密失败，请重新保存 Channel Secret。",
    credentialsReady: "凭证可用",
    reenterChannelSecret: "请重新输入 Channel Secret",
    credentialDecryptionFailed: "凭证解密失败",
    connectionError: "错误",
    disabled: "已停用",
    channelSecret: "Channel Secret",
    accessToken: "Channel Access Token",
    createNewStore: "创建新门店",
    storeName: "门店名称",
    searchAccountName: "通过 ACCOUNT NAME 搜索",
    selectStore: "选择门店",
    accountName: "账户名称",
    storeIdLabel: "门店 ID",
    province: "省份",
    lineIdLabel: "LINE ID",
    masterFile: "主数据文件",
    systemSuggested: "系统建议",
    storeAlreadyExists: "此门店已存在",
    openExistingStore: "打开现有门店",
    openLineManager: "打开 LINE OA Manager",
    openLineOa: "打开 LINE OA",
    noMatchingAccount: "未找到匹配账户",
    syncedStoreMasterTitle: "从 Store Master 同步的门店信息",
    manualFallbackHint: "未找到 Store Master 记录，您仍可手动输入 LINE OA 信息。",
    searchingStoreMaster: "正在搜索……",
    storeMasterSearchFailed: "无法搜索门店数据，请检查 Store Master API 是否运行以及数据是否已导入。",
    multipleMatches: "找到多个匹配项，请选择正确的门店。",
    incompleteMasterData: "主数据不完整",
    noMasterUrl: "Master File 中没有 URL",
    dataSource: "数据来源",
    storeCode: "门店代码",
    region: "区域",
    area: "地区",
    activeStatus: "启用",
    saveConnection: "保存连接",
    cancel: "取消",
    requiredFields: "请填写所有必填字段。",
    noLineOa: "尚未连接 LINE OA",
    showArchived: "显示已归档项目",
    removeLineOa: "移除 LINE OA",
    removeStore: "删除门店",
    removeStoreQuestion: "确定要从系统中移除“{storeName}”吗？",
    deletePermanently: "永久删除",
    archiveStore: "归档门店",
    permanentDeleteDescription: "永久删除将移除门店及所有关联数据，且无法恢复。",
    archiveDescription: "归档将隐藏门店，但保留历史记录。",
    irreversibleWarning: "此操作无法撤销。",
    typeStoreName: "请输入完整门店名称以确认",
    restoreStore: "恢复门店",
    storeDeletedSuccessfully: "门店及所有关联数据已永久删除。",
    storeArchivedSuccessfully: "门店归档成功",
    storeCannotBeDeleted: "此门店无法删除",
    storeHasActiveLineOa: "此门店仍有启用的 LINE OA 账户",
    historicalDataPreserved: "历史数据将被保留",
    noStoresFound: "未找到门店",
    hideArchivedStores: "隐藏已归档门店",
    lineOaAccountsCount: "LINE OA 账户",
    conversationCountLabel: "会话",
    messageCountLabel: "消息",
    noteActivityCountLabel: "备注/活动",
    openLineOaManagement: "打开 LINE OA 管理",
    restoreLineOa: "恢复 LINE OA",
    removeLineOaConfirmation: "确定移除此 LINE OA 吗？如有历史数据，系统会将其归档而不是永久删除。",
    profileUnavailable: "无法获取个人资料",
    refreshLineProfile: "刷新 LINE 个人资料",
    loadEarlierMessages: "加载更早的消息",
    repliesMayNotAppear: "在 LINE OA Manager 中发送的回复可能不会显示在这里。",
    noMessages: "此会话中没有消息",
    reanalyzeConversation: "重新分析会话",
    classificationUpdated: "会话分析已更新",
    editTags: "编辑标签",
    noProductDetected: "未检测到产品",
    noTopicDetected: "未检测到主题",
    autoSource: "自动",
    manualSource: "手动",
    showSecret: "显示",
    hideSecret: "隐藏",
    setupInstructions: "LINE Developers Console 设置步骤",
    testNoWebhook: "配置已完成，但尚未收到 Webhook",
    lineOaName: "LINE OA 名称",
    setupSteps: ["打开 LINE Developers Console", "选择 Messaging API 渠道", "打开 Messaging API 设置", "粘贴 Webhook URL", "点击 Verify", "启用 Use webhook", "如有需要请停用自动回复消息", "发送测试消息", "返回此页面并点击测试连接"],
    loadingData: "正在加载数据……",
    apiError: "无法连接数据服务",
    retry: "重试",
    lastUpdated: "最后更新",
    needMoreConversationData: "需要更多对话数据",
    aiSalesFollowUp: "跟进客户销售线索",
    aiProductSpecificAction: "推荐产品信息",
    aiReviewConversation: "审查客户对话",
    aiInsightError: "无法加载 AI 分析数据",
    aiInsightSummary: "客户分析摘要",
    recommendedActionsCardSubtext: "建议的下一步操作，以获得最佳跟进效果",
    hideEvidenceDetails: "隐藏证据详情",
    showEvidenceDetails: "显示证据详情",
    aiRecommendedNextAction: "AI 推荐下一步操作",
    noAiInsightAvailable: "暂无额外分析建议",
  },
};
const followUpStatusLabels: Record<
  Language,
  Record<FollowUpStatus, string>
> = {
  th: {
    followUp: "ควรติดตามร้าน",
    reminded: "แจ้งเตือนแล้ว",
    acknowledged: "ผู้จัดการรับทราบแล้ว",
    completed: "ดำเนินการแล้ว",
    escalated: "ส่งต่อหัวหน้าแล้ว",
  },

  en: {
    followUp: "Follow Up Store",
    reminded: "Reminder Sent",
    acknowledged: "Manager Acknowledged",
    completed: "Action Completed",
    escalated: "Escalated",
  },

  zh: {
    followUp: "需要跟进门店",
    reminded: "已发送提醒",
    acknowledged: "经理已确认",
    completed: "处理完成",
    escalated: "已升级处理",
  },
};
const statusOptions: FollowUpStatus[] = [
  "followUp",
  "reminded",
  "acknowledged",
  "completed",
  "escalated",
];

const defaultUiPreferences: UiPreferences = {
  language: "th",
  searchText: "",
  sidebarView: "all",
  store: "all",
  status: "all",
  priority: "all",
  series: "all",
  model: "all",
  topic: "all",
  lineOa: "all",
};

function isFollowUpStatus(value: unknown): value is FollowUpStatus {
  return (
    value === "followUp" ||
    value === "reminded" ||
    value === "acknowledged" ||
    value === "completed" ||
    value === "escalated"
  );
}

function isLanguage(value: unknown): value is Language {
  return value === "th" || value === "en" || value === "zh";
}

function isSidebarView(value: unknown): value is SidebarView {
  return (
    value === "dashboard" ||
    value === "all" ||
    value === "notReplied" ||
    value === "notifiedBm" ||
    value === "replied" ||
    value === "stores" ||
    value === "customerInsights" ||
    value === "lineOaManagement" ||
    value === "systemStatus" ||
    value === "pilotChecklist"
  );
}

function loadUiPreferences(): UiPreferences {
  try {
    const savedValue = localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!savedValue) return defaultUiPreferences;

    const saved: unknown = JSON.parse(savedValue);
    if (typeof saved !== "object" || saved === null) {
      return defaultUiPreferences;
    }

    const value = saved as Record<string, unknown>;
    return {
      language: isLanguage(value.language)
        ? value.language
        : defaultUiPreferences.language,
      searchText:
        typeof value.searchText === "string" ? value.searchText : "",
      sidebarView: isSidebarView(value.sidebarView)
        ? value.sidebarView
        : defaultUiPreferences.sidebarView,
      store:
        typeof value.store === "string" ? value.store : "all",
      status:
        value.status === "all" || isFollowUpStatus(value.status)
          ? value.status
          : "all",
      priority: value.priority === "High" || value.priority === "Normal"
        ? value.priority
        : "all",
      series:
        typeof value.series === "string" ? value.series : "all",
      model:
        typeof value.model === "string" ? value.model : "all",
      topic:
        typeof value.topic === "string" ? value.topic : "all",
      lineOa:
        typeof value.lineOa === "string" ? value.lineOa : "all",
    };
  } catch {
    return defaultUiPreferences;
  }
}

function getStatusLabel(language: Language, status: FollowUpStatus) {
  return followUpStatusLabels[language][status];
}

function getStoreDisplayName(store: string) {
  return store.replace(/^OPPO\s+/, "");
}

const apiToUiStatus: Record<ApiFollowUpStatus, FollowUpStatus> = {
  FOLLOW_UP: "followUp",
  REMINDED: "reminded",
  ACKNOWLEDGED: "acknowledged",
  COMPLETED: "completed",
  ESCALATED: "escalated",
};

const uiToApiStatus: Record<FollowUpStatus, ApiFollowUpStatus> = {
  followUp: "FOLLOW_UP",
  reminded: "REMINDED",
  acknowledged: "ACKNOWLEDGED",
  completed: "COMPLETED",
  escalated: "ESCALATED",
};

function mapApiConversation(item: ApiConversation): Conversation {
  const latestMessage = item.messages[0];
  const product = item.products[0]?.productModel;
  const messageLanguage =
    latestMessage?.originalLanguage === "zh" ? "zh" :
      latestMessage?.originalLanguage === "en" ? "en" : "th";
  return {
    id: item.id,
    customer: item.customer.displayName,
    store: item.store.name,
    storeId: item.store.id,
    message: latestMessage?.originalText ?? "",
    messageLanguage,
    translations: latestMessage?.messageType === "IMAGE" ? { th: "📷 รูปภาพ", en: "📷 Image", zh: "📷 图片" } : {
      th: latestMessage?.translatedThai ?? latestMessage?.originalText ?? "",
      en: latestMessage?.translatedEnglish ?? latestMessage?.originalText ?? "",
      zh: latestMessage?.translatedChinese ?? latestMessage?.originalText ?? "",
    },
    time: item.latestMessageAt,
    product: product?.name ?? "—",
    series: product?.productSeries.name ?? "—",
    topic: item.topics.map(({ topic }) => topic.name).join(" · "),
    priority:
      item.priority === "HIGH" || item.priority === "CRITICAL"
        ? "High"
        : "Normal",
    bmReplyStatus: item.bmReplyStatus,
    relationship: item.productRelationship ?? "Unknown",
    purchaseIntent: item.purchaseIntent ?? "Unknown",
    lineOaId: item.lineOfficialAccount.id,
    lineOaName: item.lineOfficialAccount.name,
  };
}

function mapApiConversationState(item: ApiConversation): ConversationState {
  return {
    status: apiToUiStatus[item.followUpStatus],
    bmReplyStatus: item.bmReplyStatus,
    note: item.notes[0]?.content ?? "",
    activityHistory: item.activityHistory.flatMap((activity): ActivityHistoryItem[] => {
      if (activity.actionType === "BM_REPLY_STATUS_CHANGED" && activity.newBmReplyStatus) {
        return [{
          id: activity.id,
          status: activity.newStatus ? apiToUiStatus[activity.newStatus] : null,
          bmReplyStatus: activity.newBmReplyStatus,
          timestamp: activity.createdAt,
          actionType: "bmReplyStatus",
        }];
      }
      if (activity.newStatus) {
        return [{
          id: activity.id,
          status: apiToUiStatus[activity.newStatus],
          bmReplyStatus: activity.newBmReplyStatus ?? null,
          timestamp: activity.createdAt,
          actionType: activity.actionType === "MESSAGE_RECEIVED" ? "messageReceived" : "status",
        }];
      }
      return [];
    }),
  };
}

export default function Home() {
  useEffect(() => window.location.replace("/dashboard"), []);
  return <main className="app-shell flex min-h-screen items-center justify-center"><p className="app-muted text-sm">Opening dashboard…</p></main>;
}

export function ApplicationWorkspace({ initialSection }: { initialSection: PrimarySection }) {
  const { widths: chatPaneWidths, containerRef: chatContainerRef, resize: resizeChatPanes, reset: resetChatPanes } = useResizablePanes(initialSection === "chats");
  const [authUser, setAuthUser] = useState<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ firstAdminRequired: boolean; registrationAvailable: boolean; emailProviderConfigured: boolean; emailProviderMode: string } | null>(null);
  const [setupStatusError, setSetupStatusError] = useState<string | null>(null);
  const [setupName, setSetupName] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPasswordConfirmation, setSetupPasswordConfirmation] = useState("");
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [setupChallenge, setSetupChallenge] = useState<{ challengeId: string; maskedEmail: string } | null>(null);
  const [setupOtp, setSetupOtp] = useState("");
  const [setupExpires, setSetupExpires] = useState(0);
  const [setupResend, setSetupResend] = useState(0);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<Awaited<ReturnType<typeof api.systemStatus>> | null>(null);
  const [operationalErrors, setOperationalErrors] = useState<Awaited<ReturnType<typeof api.operationalErrors>>>([]);
  const [pilotChecklist, setPilotChecklist] = useState<Awaited<ReturnType<typeof api.pilotChecklist>> | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string; waiting: number; lineOaCount: number }>>([]);
  const [availableStores, setAvailableStores] = useState<ApiStore[]>([]);
  const [availableProductModels, setAvailableProductModels] = useState<Array<{ id: string; name: string }>>([]);
  const [availableProductSeries, setAvailableProductSeries] = useState<Array<{ id: string; name: string }>>([]);
  const [availableTopics, setAvailableTopics] = useState<Array<{ id: string; name: string }>>([]);
  const [lineOas, setLineOas] = useState<LineOfficialAccountResponse[]>([]);
  const [showLineOaForm, setShowLineOaForm] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [lineOaForm, setLineOaForm] = useState<CreateLineOaInput>({ name: "", channelSecret: "", channelAccessToken: "", isActive: true });
  const [searchQuery, setSearchQuery] = useState("");
  const [masterSearchState, setMasterSearchState] = useState<StoreMasterSearchState>({ status: "idle" });
  const [selectedMaster, setSelectedMaster] = useState<StoreMasterSuggestion | null>(null);
  const [masterActiveIndex, setMasterActiveIndex] = useState(-1);
  const [masterRetryNonce, setMasterRetryNonce] = useState(0);
  const [showAdvancedLineOa, setShowAdvancedLineOa] = useState(false);
  const [createdLineOa, setCreatedLineOa] = useState<{ account: LineOfficialAccountResponse; webhookUrl: string } | null>(null);
  const [backfillModalOpen, setBackfillModalOpen] = useState(false);
  const [backfillDateFrom, setBackfillDateFrom] = useState("2026-07-01");
  const [backfillDateTo, setBackfillDateTo] = useState("2026-07-22");
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<SyncBatchResult | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillJob, setBackfillJob] = useState<BackfillJobResponseDto | null>(null);

  useEffect(() => {
    const oaId = createdLineOa?.account?.id;
    if (!oaId) return;

    let timer: NodeJS.Timeout | null = null;
    let cancelled = false;

    const poll = async () => {
      try {
        const job = await api.followerInsightsJobStatus(oaId);
        if (!cancelled && job) {
          setBackfillJob(job);
          if (job.status === "QUEUED" || job.status === "RUNNING") {
            timer = setTimeout(poll, 2000);
          }
        }
      } catch {
        // Safe poll catch
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [createdLineOa?.account?.id]);

  const [lineOaSubmitting, setLineOaSubmitting] = useState(false);
  const [editingLineOaId, setEditingLineOaId] = useState<string | null>(null);
  const [lineOaError, setLineOaError] = useState<string | null>(null);
  const [lineOaExporting, setLineOaExporting] = useState(false);
  const [lineOaExportError, setLineOaExportError] = useState<string | null>(null);
  const [masterSyncing, setMasterSyncing] = useState(false);
  const [connectionTest, setConnectionTest] = useState<{ id: string; result: LineOaTestResult } | null>(null);
  const [showArchivedLineOas, setShowArchivedLineOas] = useState(false);
  const [showArchivedStores, setShowArchivedStores] = useState(false);
  const [storeRemovalPreview, setStoreRemovalPreview] = useState<StoreDeletionPreview | null>(null);
  const [permanentDeleteStep, setPermanentDeleteStep] = useState(false);
  const [permanentDeleteConfirmation, setPermanentDeleteConfirmation] = useState("");
  const [storeRemovalLoading, setStoreRemovalLoading] = useState(false);
  const [storeRemovalMessage, setStoreRemovalMessage] = useState<string | null>(null);
  const [webhookInfoById, setWebhookInfoById] = useState<Record<string, LineOaWebhookInfo>>({});
  const [language, setLanguage] = useState<Language>("th");
  const [searchText, setSearchText] = useState("");
  const [storeManagementSearch, setStoreManagementSearch] = useState("");
  const [storeRouteStatus] = useState<"all" | "active" | "error">(() => {
    if (initialSection !== "stores" || typeof window === "undefined") return "all";
    const status = new URLSearchParams(window.location.search).get("status");
    return status === "active" || status === "error" ? status : "all";
  });
  const [sidebarView, setSidebarView] = useState<SidebarView>(
    initialSection === "stores" ? "lineOaManagement" : initialSection === "chats" ? "all" : "dashboard",
  );
  const [selectedStore, setSelectedStore] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [lineOaFilter, setLineOaFilter] = useState("all");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [managerLinkMissing, setManagerLinkMissing] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedApiConversation, setSelectedApiConversation] = useState<ApiConversation | null>(null);
  const [customerNameHistory, setCustomerNameHistory] = useState<{ currentName: string; history: Array<{ id: string; displayName: string; source: string; capturedAt: string }> } | null>(null);
  const [customerNameHistoryLoading, setCustomerNameHistoryLoading] = useState(false);
  const [customerNameHistoryError, setCustomerNameHistoryError] = useState<string | null>(null);
  const [customerIntelligence, setCustomerIntelligence] = useState<ApiCustomerIntelligence | null>(null);
  const [customerIntelligenceLoading, setCustomerIntelligenceLoading] = useState(false);
  const [customerIntelligenceError, setCustomerIntelligenceError] = useState<string | null>(null);
  const [customerEvents, setCustomerEvents] = useState<ApiCustomerEvent[] | null>(null);
  const [customerEventsLoading, setCustomerEventsLoading] = useState(false);
  const [customerEventsError, setCustomerEventsError] = useState<string | null>(null);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [chatHistory, setChatHistory] = useState<ConversationMessagesResponse>({ items: [], total: 0, page: 1, pageSize: 30, hasEarlier: false });
  const [chatLoading, setChatLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [conversationStates, setConversationStates] = useState<
    Record<string, ConversationState>
  >({});
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [openConversationDropdownId, setOpenConversationDropdownId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [supportingDataLoaded, setSupportingDataLoaded] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [bulkConfirmState, setBulkConfirmState] = useState<{
    storeId: string;
    storeName: string;
    targetStatus: ApiBmReplyStatus;
    fromStatuses?: ApiBmReplyStatus[];
    affectedCount: number;
  } | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkSuccessToast, setBulkSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!openConversationDropdownId) return;
    const handleClickOutside = () => setOpenConversationDropdownId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [openConversationDropdownId]);

  const [apiError, setApiError] = useState<string | null>(null);
  const [dashboardSummary, setDashboardSummary] =
    useState<DashboardAnalyticsResponse | null>(null);
  const [bmSummaryData, setBmSummaryData] = useState<BmReplyStatusSummaryResponse>({
    overview: { notReplied: 0, notifiedBm: 0, replied: 0 },
    stores: [],
  });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const refreshInProgress = useRef(false);
  const conversationRequestGuard = useRef(new LatestConversationRequestGuard());
  const lineOaSubmissionInFlight = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const newestChatMessageRef = useRef<string | null>(null);
  const replyIdempotencyKeyRef = useRef<string | null>(null);
  const chatRouteHydrated = useRef(false);
  const [uiPreferencesLoaded, setUiPreferencesLoaded] = useState(false);
  const [chatPage, setChatPage] = useState(1);
  const [chatPageSize, setChatPageSize] = useState(CONVERSATION_PAGE_SIZE);
  const [chatTotalCount, setChatTotalCount] = useState(0);
  const [isChatPageLoading, setIsChatPageLoading] = useState(false);
  const [chatPageError, setChatPageError] = useState<string | null>(null);
  const [hasNewChatsAvailable, setHasNewChatsAvailable] = useState(false);
  const text = translations[language];
  const aiRecommendedNextAction = useMemo(() => {
    if (!customerIntelligence) return null;
    if (customerIntelligence.confidenceScore < 0.5) return text.needMoreConversationData;
    const normalizedIntents = customerIntelligence.intent.map((value) => value.toLowerCase());
    const hasPurchaseIntent = normalizedIntents.some((value) => /purchase|sales|intent|interested|buy|journey/.test(value));
    if (hasPurchaseIntent) return text.aiSalesFollowUp;
    if (customerIntelligence.interestedProducts.length > 0) {
      const product = customerIntelligence.interestedProducts[0];
      return `${text.aiProductSpecificAction} ${product}`;
    }
    return text.aiReviewConversation;
  }, [customerIntelligence, text]);
  const chatsPaginationText = getChatsPaginationText(language);
  const storeOptions = useMemo(
    () => availableStores.filter(({ archivedAt }) => !archivedAt).map(({ id }) => id),
    [availableStores],
  );
  const seriesOptions = useMemo(
    () => availableProductSeries.map(({ name }) => name),
    [availableProductSeries],
  );
  const modelOptions = useMemo(
    () => availableProductModels.map(({ name }) => name),
    [availableProductModels],
  );
  const topicOptions = useMemo(
    () => availableTopics.map(({ name }) => name),
    [availableTopics],
  );
  const priorityOptions = useMemo(
    () => ["High", "Normal"] as Priority[],
    [],
  );
  const lineOaOptions = useMemo(
    () => lineOas.map(({ id }) => id),
    [lineOas],
  );
  const normalizedStoreManagementSearch = storeManagementSearch.trim().toLowerCase();
  const visibleLineOas = useMemo(
    () => lineOas.filter((account) =>
      (storeRouteStatus === "all" || (storeRouteStatus === "active" ? account.isActive : account.connectionStatus === "ERROR" || account.connectionStatus === "NOT_CONFIGURED")) &&
      (!normalizedStoreManagementSearch ||
        [account.name, account.store.name, account.store.accountName]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedStoreManagementSearch))),
    ),
    [lineOas, normalizedStoreManagementSearch, storeRouteStatus],
  );
  const synchronizedMaster = selectedMaster ? synchronizedStoreMasterData(selectedMaster) : null;
  const masterResults = masterSearchState.status === "success" ? masterSearchState.suggestions : [];

  useEffect(() => {
    const query = searchQuery.trim();
    if (!showLineOaForm || editingLineOaId || selectedMaster || !query) return;
    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (active) setMasterSearchState({ status: "loading", query });
    }, 0);
    const searchTimer = window.setTimeout(() => {
      void api.searchStoreMaster(query, 10)
        .then((suggestions) => {
          if (!active) return;
          setMasterSearchState({ status: "success", query, suggestions });
          setMasterActiveIndex(suggestions.length ? 0 : -1);
        })
        .catch(() => {
          if (active) setMasterSearchState({ status: "error", query, message: text.storeMasterSearchFailed });
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
      window.clearTimeout(searchTimer);
    };
  }, [editingLineOaId, masterRetryNonce, searchQuery, selectedMaster, showLineOaForm, text.storeMasterSearchFailed]);

  const activeConversationStatus = statusFilter !== "all" ? uiToApiStatus[statusFilter] : undefined;
  const activeConversationBmReplyStatus: ApiBmReplyStatus | undefined =
    sidebarView === "notReplied"
      ? "NOT_REPLIED"
      : sidebarView === "notifiedBm"
        ? "NOTIFIED_BM"
        : sidebarView === "replied"
          ? "REPLIED"
          : undefined;
  const productSeriesId = seriesFilter === "all"
    ? undefined
    : availableProductSeries.find(({ name }) => name === seriesFilter)?.id;
  const productModelId = modelFilter === "all"
    ? undefined
    : availableProductModels.find(({ name }) => name === modelFilter)?.id;
  const topicId = topicFilter === "all"
    ? undefined
    : availableTopics.find(({ name }) => name === topicFilter)?.id;
  const activeConversationQuery = useMemo(
    () => buildConversationListQuery({
      page: chatPage,
      pageSize: chatPageSize,
      search: initialSection === "chats" ? searchText : "",
      storeId: initialSection === "chats" ? selectedStore : "all",
      lineOaId: initialSection === "chats" ? lineOaFilter : "all",
      followUpStatus: initialSection === "chats" ? activeConversationStatus : undefined,
      bmReplyStatus: initialSection === "chats" ? activeConversationBmReplyStatus : undefined,
      priority: initialSection === "chats" && priorityFilter !== "all"
        ? priorityFilter === "High" ? "HIGH" : "NORMAL"
        : undefined,
      productSeriesId: initialSection === "chats" ? productSeriesId : undefined,
      productModelId: initialSection === "chats" ? productModelId : undefined,
      topicId: initialSection === "chats" ? topicId : undefined,
    }),
    [activeConversationBmReplyStatus, activeConversationStatus, chatPage, chatPageSize, initialSection, lineOaFilter, priorityFilter, productModelId, productSeriesId, searchText, selectedStore, topicId],
  );
  const activeConversationQueryKey = conversationListQueryKey(activeConversationQuery);
  const conversationQueryRef = useRef(activeConversationQuery);
  useEffect(() => {
    conversationQueryRef.current = activeConversationQuery;
  }, [activeConversationQuery]);
  const conversationFilterShapeKey = JSON.stringify({
    storeId: activeConversationQuery.storeId,
    lineOaId: activeConversationQuery.lineOaId,
    followUpStatus: activeConversationQuery.followUpStatus,
    bmReplyStatus: activeConversationQuery.bmReplyStatus,
    search: activeConversationQuery.search,
    priority: activeConversationQuery.priority,
    productSeriesId: activeConversationQuery.productSeriesId,
    productModelId: activeConversationQuery.productModelId,
    topicId: activeConversationQuery.topicId,
    pageSize: activeConversationQuery.pageSize,
  });
  const previousConversationFilterShape = useRef(conversationFilterShapeKey);

  const loadConversations = useCallback(async (query: ConversationListQuery, silent = false) => {
    const requestGeneration = conversationRequestGuard.current.begin();
    const requestKey = conversationListQueryKey(query);
    if (!silent) setIsChatPageLoading(true);
    setChatPageError(null);

    try {
      const response = await api.conversations(query);
      if (
        !conversationRequestGuard.current.isLatest(requestGeneration) ||
        requestKey !== conversationListQueryKey(conversationQueryRef.current)
      ) return;

      const reconciledPage = reconcileConversationPage(response.total, query.page, query.pageSize);
      setChatTotalCount(response.total);
      if (reconciledPage !== query.page) {
        setChatPage(reconciledPage);
        return;
      }

      const mapped = response.items.map(mapApiConversation);
      setConversations(mapped);
      setConversationStates(Object.fromEntries(response.items.map((item) => [item.id, mapApiConversationState(item)])));
      setSavedNotes(Object.fromEntries(response.items.map((item) => [item.id, item.notes[0]?.content ?? ""])));
      setSelectedConversationId((currentId) =>
        mapped.some(({ id }) => id === currentId) ? currentId : mapped[0]?.id ?? "",
      );
      setLastUpdatedAt(new Date());
    } catch (error) {
      if (!conversationRequestGuard.current.isLatest(requestGeneration)) return;
      setChatPageError(error instanceof Error ? error.message : text.connectionError);
    } finally {
      if (conversationRequestGuard.current.isLatest(requestGeneration)) {
        setIsChatPageLoading(false);
      }
    }
  }, [text.connectionError]);

  useEffect(() => {
    if (!authUser) return;
    if (previousConversationFilterShape.current !== conversationFilterShapeKey) {
      previousConversationFilterShape.current = conversationFilterShapeKey;
      if (chatPage !== 1) {
        const resetPage = window.setTimeout(() => setChatPage(1), 0);
        return () => window.clearTimeout(resetPage);
      }
    }
    void loadConversations(activeConversationQuery);
  }, [activeConversationQuery, activeConversationQueryKey, authUser, chatPage, conversationFilterShapeKey, loadConversations]);

  const loadSupportingData = useCallback(async (silent = false) => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    if (!silent) setIsLoading(true);
    setApiError(null);
    try {
      const [storeResponse, productResponse, topicResponse, dashboardResponse, lineOaResponse, bmSummaryResponse] = await Promise.all([
        api.stores(showArchivedStores),
        api.products(),
        api.topics(),
        api.dashboard(),
        api.lineOfficialAccounts(showArchivedLineOas),
        api.bmReplyStatusSummary(),
      ]);
      setStores(
        storeResponse.filter((store) => !store.archivedAt).map((store) => ({
          id: store.id,
          name: store.name,
          waiting: store._count?.operationalNotRepliedCount ?? 0,
          lineOaCount: store._count?.lineOfficialAccounts ?? 0,
        })),
      );
      setAvailableStores(storeResponse);
      setAvailableProductSeries(productResponse.series.map(({ id, name }) => ({ id, name })));
      setAvailableProductModels(productResponse.series.flatMap(({ models }) => models.map(({ id, name }) => ({ id, name }))));
      setAvailableTopics(topicResponse.map(({ id, name }) => ({ id, name })));
      setLineOas(lineOaResponse);
      setBmSummaryData(bmSummaryResponse);
      setSupportingDataLoaded(true);
      const webhookInfo = await Promise.all(
        lineOaResponse.map(async (account) => [
          account.id,
          await api.lineOfficialAccountWebhookInfo(account.id),
        ] as const),
      );
      setWebhookInfoById(Object.fromEntries(webhookInfo));
      setDashboardSummary(dashboardResponse);
      setLastUpdatedAt(new Date());
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to load data");
    } finally {
      if (!silent) setIsLoading(false);
      refreshInProgress.current = false;
    }
  }, [showArchivedLineOas, showArchivedStores]);

  const loadApplicationData = useCallback(async (silent = false) => {
    await Promise.all([
      loadSupportingData(silent),
      loadConversations(conversationQueryRef.current, silent),
    ]);
  }, [loadConversations, loadSupportingData]);


  const loadSystemStatus = useCallback(async () => {
    try {
      const [status, errors] = await Promise.all([api.systemStatus(), api.operationalErrors()]);
      setSystemStatus(status); setOperationalErrors(errors);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to load system status");
    }
  }, []);

  const checkSetupStatus = useCallback(async () => {
    setAuthChecked(false); setSetupStatusError(null);
    try {
      const status = await api.setupStatus();
      setSetupStatus(status);
      if (!status.firstAdminRequired) {
        try {
          setAuthUser(await api.me());
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          setAuthUser(null);
        }
      }
    }
    catch (error) { setSetupStatusError(error instanceof Error ? error.message : "Unable to check administrator setup"); }
    finally { setAuthChecked(true); }
  }, []);

  async function loadPilotChecklist(lineOaId: string) { setPilotChecklist(await api.pilotChecklist(lineOaId)); }
  async function updatePilotItem(itemKey: string, status: "NOT_TESTED" | "PASSED" | "FAILED" | "NOT_APPLICABLE", note?: string) {
    if (!pilotChecklist) return; await api.updatePilotChecklist(pilotChecklist.oa.id, itemKey, status, note); await loadPilotChecklist(pilotChecklist.oa.id);
  }

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthUser(null);
      setLoginPassword("");
      if (window.location.pathname !== "/login") window.location.replace("/login");
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void checkSetupStatus(), 0); return () => window.clearTimeout(timer); }, [checkSetupStatus]);

  useEffect(() => {
    if (!authUser) return;
    const destination = routeAfterLogin(window.location.pathname);
    if (destination) window.location.replace(destination);
  }, [authUser]);

  useEffect(() => {
    if (!setupChallenge) return; const timer = window.setInterval(() => { setSetupExpires((value) => Math.max(0, value - 1)); setSetupResend((value) => Math.max(0, value - 1)); }, 1000); return () => window.clearInterval(timer);
  }, [setupChallenge]);

  useEffect(() => {
    const oldState = localStorage.getItem(CONVERSATION_STATES_STORAGE_KEY);
    if (oldState && !localStorage.getItem(LEGACY_CONVERSATION_STATES_STORAGE_KEY)) {
      localStorage.setItem(LEGACY_CONVERSATION_STATES_STORAGE_KEY, oldState);
      localStorage.removeItem(CONVERSATION_STATES_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const loadData = window.setTimeout(() => { void loadSupportingData(); void loadSystemStatus(); }, 0);
    return () => window.clearTimeout(loadData);
  }, [authUser, loadSupportingData, loadSystemStatus]);

  useEffect(() => {
    if (!authUser) return;
    const poll = window.setInterval(() => {
      const isEditingNote = document.activeElement instanceof HTMLTextAreaElement;
      if (!document.hidden && !isEditingNote) void loadApplicationData(true);
    }, 12_000);
    return () => window.clearInterval(poll);
  }, [authUser, loadApplicationData]);

  useEffect(() => {
    const loadSavedPreferences = window.setTimeout(() => {
      const saved = loadUiPreferences();
      setLanguage(saved.language);
      setSearchText(saved.searchText);
      setSidebarView(initialSection === "stores" ? "lineOaManagement" : initialSection === "chats" ? "notReplied" : "dashboard");
      setSelectedStore(saved.store);
      setStatusFilter(saved.status);
      setPriorityFilter(saved.priority);
      setSeriesFilter(saved.series);
      setModelFilter(saved.model);
      setTopicFilter(saved.topic);
      setLineOaFilter(saved.lineOa);
      setUiPreferencesLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadSavedPreferences);
  }, [initialSection]);

  useEffect(() => {
    if (!uiPreferencesLoaded || initialSection !== "chats") return;
    const restoreRoute = () => {
      const route = readChatRouteFilters(window.location.search);
      setSelectedStore(route.store ?? "all");
      setSidebarView(
        route.bmReplyStatus === "NOTIFIED_BM"
          ? "notifiedBm"
          : route.bmReplyStatus === "REPLIED"
            ? "replied"
            : route.bmReplyStatus === "NOT_REPLIED"
              ? "notReplied"
              : "all",
      );
      setStatusFilter("all");
      setPriorityFilter(route.priority?.toLowerCase() === "high" ? "High" : "all");
      setModelFilter(route.model ?? "all");
      setTopicFilter(route.topic ?? "all");
      setLineOaFilter(route.lineOaId ?? "all");
      setSelectedConversationId(route.conversationId ?? "");
      chatRouteHydrated.current = true;
    };
    restoreRoute();
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, [initialSection, uiPreferencesLoaded]);

  useEffect(() => {
    if (initialSection !== "chats" || !uiPreferencesLoaded || !chatRouteHydrated.current) return;
    const bmReplyStatus =
      sidebarView === "notifiedBm"
        ? "NOTIFIED_BM"
        : sidebarView === "replied"
          ? "REPLIED"
          : sidebarView === "notReplied"
            ? "NOT_REPLIED"
            : undefined;
    const href = buildChatsHref({
      store: selectedStore,
      bmReplyStatus,
      status: statusFilter !== "all" ? statusFilter : undefined,
      priority: priorityFilter === "High" ? "high" : undefined,
      model: modelFilter,
      topic: topicFilter,
      lineOaId: lineOaFilter,
      conversationId: selectedConversationId || undefined,
    });
    window.history.replaceState(null, "", href);
  }, [initialSection, lineOaFilter, modelFilter, priorityFilter, selectedConversationId, selectedStore, sidebarView, statusFilter, topicFilter, uiPreferencesLoaded]);

  useEffect(() => {
    if (!uiPreferencesLoaded) return;

    const preferences: UiPreferences = {
      language,
      searchText,
      sidebarView,
      store: selectedStore,
      status: statusFilter,
      priority: priorityFilter,
      series: seriesFilter,
      model: modelFilter,
      topic: topicFilter,
      lineOa: lineOaFilter,
    };
    localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }, [language, lineOaFilter, modelFilter, priorityFilter, searchText, selectedStore, seriesFilter, sidebarView, statusFilter, topicFilter, uiPreferencesLoaded]);

  useEffect(() => {
    if (!toastMessage) return;
    const dismissToast = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(dismissToast);
  }, [toastMessage]);

  useEffect(() => {
    if (!uiPreferencesLoaded || !supportingDataLoaded) return;

    const validateFilters = window.setTimeout(() => {
      if (selectedStore !== "all" && !storeOptions.includes(selectedStore)) {
        setSelectedStore("all");
      }
      if (
        statusFilter !== "all" &&
        !statusOptions.includes(statusFilter)
      ) {
        setStatusFilter("all");
      }
      if (
        priorityFilter !== "all" &&
        !priorityOptions.includes(priorityFilter)
      ) {
        setPriorityFilter("all");
      }
      if (seriesFilter !== "all" && !seriesOptions.includes(seriesFilter)) {
        setSeriesFilter("all");
      }
      if (modelFilter !== "all" && !modelOptions.includes(modelFilter)) {
        setModelFilter("all");
      }
      if (topicFilter !== "all" && !topicOptions.includes(topicFilter)) {
        setTopicFilter("all");
      }
      if (lineOaFilter !== "all" && !lineOaOptions.includes(lineOaFilter)) {
        setLineOaFilter("all");
      }
    }, 0);

    return () => window.clearTimeout(validateFilters);
  }, [
    uiPreferencesLoaded,
    supportingDataLoaded,
    selectedStore,
    statusFilter,
    priorityFilter,
    seriesFilter,
    modelFilter,
    topicFilter,
    lineOaFilter,
    storeOptions,
    priorityOptions,
    seriesOptions,
    modelOptions,
    topicOptions,
    lineOaOptions,
  ]);

  const filteredConversations = conversations;

  const selectedConversation = useMemo(
    () => filteredConversations.find(({ id }) => id === selectedConversationId) ?? filteredConversations[0],
    [filteredConversations, selectedConversationId],
  );
  const selectedConversationState = selectedConversation
    ? conversationStates[selectedConversation.id]
    : undefined;
  useEffect(() => {
    if (!selectedConversation || selectedConversation.id === selectedConversationId) return;

    const selectFirstVisible = window.setTimeout(
      () => setSelectedConversationId(selectedConversation.id),
      0,
    );
    return () => window.clearTimeout(selectFirstVisible);
  }, [selectedConversation, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    let active = true;
    const load = async () => {
      try {
        const [conversation, messages] = await Promise.all([api.conversation(selectedConversationId), api.conversationMessages(selectedConversationId)]);
        if (active) { setSelectedApiConversation(conversation); setChatHistory(messages); }
      } catch { /* The main data error surface handles API availability. */ }
    };
    void load();
    const poll = window.setInterval(() => void load(), 12_000);
    return () => { active = false; window.clearInterval(poll); };
  }, [selectedConversationId]);

  useEffect(() => {
    let active = true;
    const customerId = selectedApiConversation?.customer?.id;
    if (!selectedApiConversation || !customerId || customerId === "undefined" || customerId === "null") {
      queueMicrotask(() => {
        if (active) {
          setCustomerNameHistory(null);
          setCustomerNameHistoryError(null);
        }
      });
      return () => { active = false; };
    }

    const loadHistory = async () => {
      setCustomerNameHistoryLoading(true);
      setCustomerNameHistoryError(null);
      try {
        const history = await api.customerNameHistory(customerId);
        if (active) setCustomerNameHistory(history);
      } catch (error) {
        if (active) setCustomerNameHistoryError(error instanceof Error ? error.message : "Unable to load LINE name history");
      } finally {
        if (active) setCustomerNameHistoryLoading(false);
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [selectedApiConversation]);

  useEffect(() => {
    let active = true;
    const customerId = selectedApiConversation?.customer?.id;
    if (!selectedApiConversation || !customerId || customerId === "undefined" || customerId === "null") {
      queueMicrotask(() => {
        if (active) {
          setCustomerIntelligence(null);
          setCustomerIntelligenceError(null);
        }
      });
      return () => { active = false; };
    }

    const loadIntelligence = async () => {
      setCustomerIntelligenceLoading(true);
      setCustomerIntelligenceError(null);
      try {
        const intelligence = await api.customerIntelligence(customerId);
        if (active) setCustomerIntelligence(intelligence);
      } catch (error) {
        if (active) setCustomerIntelligenceError(error instanceof Error ? error.message : "Unable to load customer intelligence");
      } finally {
        if (active) setCustomerIntelligenceLoading(false);
      }
    };

    void loadIntelligence();
    return () => {
      active = false;
    };
  }, [selectedApiConversation]);

  useEffect(() => {
    let active = true;
    const customerId = selectedApiConversation?.customer?.id;
    if (!selectedApiConversation || !customerId || customerId === "undefined" || customerId === "null") {
      queueMicrotask(() => {
        if (active) {
          setCustomerEvents(null);
          setCustomerEventsError(null);
        }
      });
      return () => { active = false; };
    }

    const loadEvents = async () => {
      setCustomerEventsLoading(true);
      setCustomerEventsError(null);
      try {
        const events = await api.customerEvents(customerId);
        if (active) setCustomerEvents(events);
      } catch (error) {
        if (active) setCustomerEventsError(error instanceof Error ? error.message : "Unable to load customer events");
      } finally {
        if (active) setCustomerEventsLoading(false);
      }
    };

    void loadEvents();
    return () => {
      active = false;
    };
  }, [selectedApiConversation]);

  useEffect(() => {
    const newestId = chatHistory.items.at(-1)?.id ?? null;
    if (newestId && newestId !== newestChatMessageRef.current) {
      newestChatMessageRef.current = newestId;
      window.requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }, [chatHistory.items]);


  const storeBmCounts = useMemo(() => {
    const countsMap: Record<string, { notReplied: number; notifiedBm: number; replied: number; oldestWaitingMinutes?: number }> = {};
    for (const s of bmSummaryData.stores) {
      countsMap[s.storeId] = {
        notReplied: s.notReplied,
        notifiedBm: s.notifiedBm,
        replied: s.replied,
        oldestWaitingMinutes: s.oldestWaitingMinutes ?? 0,
      };
    }
    return countsMap;
  }, [bmSummaryData.stores]);
  const hasActiveFilters =
    searchText.trim() !== "" || selectedStore !== "all" ||
    statusFilter !== "all" || priorityFilter !== "all" ||
    seriesFilter !== "all" || modelFilter !== "all" ||
    topicFilter !== "all" ||
    lineOaFilter !== "all" ||
    (sidebarView === "notifiedBm" || sidebarView === "replied" || sidebarView === "notReplied");
  const conversationListTitle = getConversationListTitle(sidebarView, statusFilter, {
    conversations: text.conversationsToFollow,
    notReplied: text.notReplied,
    notifiedBm: text.notifiedBm,
    replied: text.replied,
    status: (status) => getStatusLabel(language, status as FollowUpStatus),
  });


  async function updateFollowUpStatus(status: FollowUpStatus) {
    if (!selectedConversation) return;
    const currentStatus = conversationStates[selectedConversation.id].status;
    if (currentStatus === status) return;
    setIsMutating(true);
    setApiError(null);
    try {
      const response = await api.updateStatus(
        selectedConversation.id,
        uiToApiStatus[status],
      );
      setConversationStates((currentStates) => ({
        ...currentStates,
        [selectedConversation.id]: mapApiConversationState(response.conversation),
      }));
      setDashboardSummary(await api.dashboard());
      const statusLabel =
        status === "followUp"
          ? text.followUp
          : status === "reminded"
            ? text.reminded
            : getStatusLabel(language, status);
      setToastMessage(
        `${status === "followUp" ? text.toastReturned : text.toastMoved} ‘${statusLabel}’${language === "en" ? "." : language === "zh" ? "。" : " เรียบร้อย"}`,
      );
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Status update failed");
    } finally {
      setIsMutating(false);
    }
  }

  async function updateBmReplyStatus(status: ApiBmReplyStatus) {
    if (!selectedConversation || isMutating || authUser?.role === "VIEWER") return;
    const conversationId = selectedConversation.id;
    const previousState = conversationStates[conversationId];
    if (!previousState || previousState.bmReplyStatus === status) return;

    const completesFollowUp = status === "REPLIED" && previousState.status !== "completed";
    setIsMutating(true);
    setApiError(null);

    setConversationStates((currentStates) => {
      const current = currentStates[conversationId];
      if (!current) return currentStates;
      return {
        ...currentStates,
        [conversationId]: {
          ...current,
          bmReplyStatus: status,
          ...(completesFollowUp ? { status: "completed" } : {}),
        },
      };
    });

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            bmReplyStatus: status,
            ...(completesFollowUp ? { status: "completed" } : {}),
          }
          : c
      )
    );

    try {
      const response = await api.updateBmReplyStatus(selectedConversation.id, status);
      setConversationStates((currentStates) => ({
        ...currentStates,
        [conversationId]: mapApiConversationState(response.conversation),
      }));
      const [dashboardRes, bmSummaryRes] = await Promise.all([
        api.dashboard(),
        api.bmReplyStatusSummary(),
      ]);
      setDashboardSummary(dashboardRes);
      setBmSummaryData(bmSummaryRes);

      if (sidebarView !== "all") {
        void loadConversations(activeConversationQuery, true);
      }
    } catch (error) {
      setConversationStates((currentStates) => ({
        ...currentStates,
        [conversationId]: previousState,
      }));
      setApiError(error instanceof Error ? error.message : "BM reply status update failed");
    } finally {
      setIsMutating(false);
    }
  }

  async function updateConversationBmReplyStatus(conversationId: string, status: ApiBmReplyStatus) {
    if (isMutating || authUser?.role === "VIEWER") return;
    const previousState = conversationStates[conversationId];
    const currentStatus = previousState?.bmReplyStatus ?? conversations.find((c) => c.id === conversationId)?.bmReplyStatus;
    if (currentStatus === status) return;

    const completesFollowUp = status === "REPLIED" && previousState?.status !== "completed";
    setIsMutating(true);
    setApiError(null);

    setConversationStates((currentStates) => {
      const current = currentStates[conversationId];
      if (!current) return currentStates;
      return {
        ...currentStates,
        [conversationId]: {
          ...current,
          bmReplyStatus: status,
          ...(completesFollowUp ? { status: "completed" } : {}),
        },
      };
    });

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
            ...c,
            bmReplyStatus: status,
            ...(completesFollowUp ? { status: "completed" } : {}),
          }
          : c
      )
    );

    try {
      const response = await api.updateBmReplyStatus(conversationId, status);
      setConversationStates((currentStates) => ({
        ...currentStates,
        [conversationId]: mapApiConversationState(response.conversation),
      }));
      const [dashboardRes, bmSummaryRes] = await Promise.all([
        api.dashboard(),
        api.bmReplyStatusSummary(),
      ]);
      setDashboardSummary(dashboardRes);
      setBmSummaryData(bmSummaryRes);

      const statusLabel = bmReplyStatusLabels[language][status];
      setToastMessage(
        language === "th"
          ? `อัปเดตสถานะเป็น ‘${statusLabel}’ เรียบร้อย`
          : language === "zh"
            ? `已更新状态为 '${statusLabel}'`
            : `Updated status to '${statusLabel}'`,
      );

      if (sidebarView !== "all") {
        void loadConversations(activeConversationQuery, true);
      }
    } catch (error) {
      if (previousState) {
        setConversationStates((currentStates) => ({
          ...currentStates,
          [conversationId]: previousState,
        }));
      }
      setApiError(error instanceof Error ? error.message : "BM reply status update failed");
    } finally {
      setIsMutating(false);
    }
  }

  const handleExecuteBulkUpdate = useCallback(async () => {
    if (!bulkConfirmState) return;
    setIsBulkUpdating(true);
    try {
      const res = await api.bulkUpdateBmReplyStatus({
        storeId: bulkConfirmState.storeId,
        status: bulkConfirmState.targetStatus,
        fromStatuses: bulkConfirmState.fromStatuses,
      });
      const targetLabel = bmReplyStatusLabels[language][bulkConfirmState.targetStatus];
      const successMsg =
        language === "th"
          ? `อัปเดต ${res.updated} การสนทนาของ ${bulkConfirmState.storeName} เป็น "${targetLabel}" เรียบร้อยแล้ว`
          : language === "zh"
            ? `已成功将 ${bulkConfirmState.storeName} 的 ${res.updated} 条对话更新为 "${targetLabel}"`
            : `Successfully updated ${res.updated} conversations for ${bulkConfirmState.storeName} to "${targetLabel}"`;
      setBulkSuccessToast(successMsg);
      setTimeout(() => setBulkSuccessToast(null), 4000);
      setBulkConfirmState(null);

      // Reconcile in place without full page reload
      const [bmSummaryRes, storeRes] = await Promise.all([
        api.bmReplyStatusSummary(),
        api.stores(showArchivedStores),
        loadConversations(conversationQueryRef.current, true),
      ]);
      setBmSummaryData(bmSummaryRes);
      setStores(
        storeRes.filter((store) => !store.archivedAt).map((store) => ({
          id: store.id,
          name: store.name,
          waiting: store._count?.operationalNotRepliedCount ?? 0,
          lineOaCount: store._count?.lineOfficialAccounts ?? 0,
        })),
      );
      setAvailableStores(storeRes);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update bulk status");
    } finally {
      setIsBulkUpdating(false);
    }
  }, [bulkConfirmState, language, loadConversations, showArchivedStores]);

  function updateInternalNote(note: string) {
    if (!selectedConversation) return;
    setConversationStates((currentStates) => ({
      ...currentStates,
      [selectedConversation.id]: {
        ...currentStates[selectedConversation.id],
        note,
      },
    }));
  }

  async function saveInternalNote() {
    if (!selectedConversation || isMutating) return;
    const note = conversationStates[selectedConversation.id].note.trim();
    if (!note || note === savedNotes[selectedConversation.id]) return;
    setIsMutating(true);
    setApiError(null);
    try {
      await api.addNote(selectedConversation.id, note);
      const refreshed = await api.conversation(selectedConversation.id);
      setConversationStates((currentStates) => ({
        ...currentStates,
        [selectedConversation.id]: mapApiConversationState(refreshed),
      }));
      setSavedNotes((current) => ({ ...current, [selectedConversation.id]: note }));
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Note creation failed");
    } finally {
      setIsMutating(false);
    }
  }

  function changeLanguage(newLanguage: Language) {
    setLanguage(newLanguage);
    setShowTranslation(true);
  }

  async function openSelectedConversationInLineOa() {
    if (!selectedApiConversation) return;
    const result = await openLineOaManager({
      managerUrl: selectedApiConversation.resolvedLineOaManagerUrl,
      customerName: selectedApiConversation.customer.displayName,
      copy: (value) => navigator.clipboard.writeText(value),
      open: (url, target, features) => window.open(url, target, features),
    });
    setManagerLinkMissing(result === "missing");
    setToastMessage(result === "copied"
      ? "คัดลอกชื่อลูกค้าแล้ว กรุณาวางในช่องค้นหาของ LINE OA Manager"
      : result === "copy-failed"
        ? "เปิด LINE OA Manager แล้ว กรุณาค้นหาลูกค้าด้วยตนเอง"
        : selectedApiConversation.store.lineManagerUrlStatus === "INVALID"
          ? "ลิงก์ LINE OA Manager สำหรับร้านนี้ไม่ถูกต้อง กรุณาอัปเดต Store Master"
          : "ยังไม่มีลิงก์ LINE OA Manager สำหรับร้านนี้");
  }

  function selectSidebarView(view: SidebarView) {
    setSidebarView(view);
    if (view === "stores") {
      setSelectedStore("all");
      setShowFilterPanel(true);
    }
  }

  function clearAllFilters() {
    setSearchText("");
    setSelectedStore("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSeriesFilter("all");
    setModelFilter("all");
    setTopicFilter("all");
    setLineOaFilter("all");
    setSidebarView("all");
  }

  function openMonitoring(filters: {
    store?: string;
    status?: string;
    model?: string;
    topic?: string;
    lineOaId?: string;
    conversationId?: string;
  }) {
    if (initialSection !== "chats") {
      window.location.assign(buildChatsHref(filters));
      return;
    }
    setSidebarView("notReplied");
    setSearchText("");
    setSelectedStore(filters.store ?? "all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSeriesFilter("all");
    setModelFilter(filters.model ?? "all");
    setTopicFilter(filters.topic ?? "all");
    setLineOaFilter(filters.lineOaId ?? "all");
    if (filters.conversationId !== undefined) {
      setSelectedConversationId(filters.conversationId);
    }
  }

  function resetLineOaForm() {
    setLineOaForm({ name: "", channelSecret: "", channelAccessToken: "", isActive: true });
    setSearchQuery(""); setMasterSearchState({ status: "idle" }); setSelectedMaster(null); setMasterActiveIndex(-1);
    setShowAdvancedLineOa(false);
    setEditingLineOaId(null);
    setLineOaError(null);
    setShowCredentials(false);
  }

  function selectMasterRecord(master: StoreMasterSuggestion) {
    setSelectedMaster(master); setSearchQuery(master.accountName); setMasterSearchState({ status: "idle" }); setMasterActiveIndex(-1);
    setLineOaForm((form) => applyStoreMasterSelection(form, master));
  }

  function handleMasterSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (!masterResults.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setMasterActiveIndex((index) => Math.min(index + 1, masterResults.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setMasterActiveIndex((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter" && masterActiveIndex >= 0) { event.preventDefault(); selectMasterRecord(masterResults[masterActiveIndex]); }
    else if (event.key === "Escape") setMasterSearchState({ status: "idle" });
  }

  function editLineOa(account: LineOfficialAccountResponse) {
    setEditingLineOaId(account.id);
    setLineOaForm({ storeId: account.store.id, name: account.name, basicId: account.basicId ?? "", channelId: account.channelId ?? "", destinationId: account.destinationId ?? "", channelSecret: "", channelAccessToken: "", isActive: account.isActive });
    setShowAdvancedLineOa(false);
    setLineOaError(null);
    setShowLineOaForm(true);
  }

  async function submitLineOa() {
    if (lineOaSubmissionInFlight.current) return;
    const requiredValid = Boolean(lineOaForm.name.trim() && (editingLineOaId || (lineOaForm.channelSecret.trim() && lineOaForm.channelAccessToken.trim())));
    if (!requiredValid) { setLineOaError(text.requiredFields); return; }
    lineOaSubmissionInFlight.current = true;
    setLineOaSubmitting(true); setLineOaError(null);
    try {
      const submission = !lineOaForm.storeId && lineOaForm.newStore ? { ...lineOaForm, newStore: { ...lineOaForm.newStore, name: lineOaForm.name.trim() } } : lineOaForm;
      if (editingLineOaId) {
        await api.updateLineOfficialAccount(editingLineOaId, submission);
        setShowLineOaForm(false);
      } else {
        const account = await api.createLineOfficialAccount(submission);
        if (!account.webhookConfigured || !isValidCanonicalWebhookUrl(account.webhookUrl)) {
          await loadApplicationData(true);
          throw new Error(text.webhookCreationIncomplete);
        }
        setCreatedLineOa({ account, webhookUrl: account.webhookUrl });
        setShowLineOaForm(false);
      }
      resetLineOaForm(); await loadApplicationData(true);
    } catch (error) { setLineOaError(error instanceof Error ? error.message : text.connectionError); }
    finally { lineOaSubmissionInFlight.current = false; setLineOaSubmitting(false); }
  }

  async function toggleLineOa(account: LineOfficialAccountResponse) {
    setLineOaSubmitting(true); setLineOaError(null);
    try { await api.setLineOfficialAccountStatus(account.id, !account.isActive); await loadApplicationData(true); }
    catch (error) { setLineOaError(error instanceof Error ? error.message : text.connectionError); }
    finally { setLineOaSubmitting(false); }
  }

  async function testLineOa(account: LineOfficialAccountResponse) {
    setLineOaSubmitting(true); setLineOaError(null);
    try {
      const health = await api.lineOfficialAccountCredentialHealth(account.id);
      const result = await api.testLineOfficialAccount(account.id);
      setConnectionTest({ id: account.id, result: { ...result, credentialsAvailable: health.channelSecretStored, accessTokenAvailable: health.accessTokenStored, credentialDecryptionError: health.channelSecretStored && !health.channelSecretDecryptable } });
      await loadApplicationData(true);
    }
    catch (error) { setLineOaError(error instanceof Error ? error.message : text.connectionError); }
    finally { setLineOaSubmitting(false); }
  }

  async function exportLineOaCsv() {
    if (lineOaExporting || authUser?.role !== "ADMIN") return;
    setLineOaExporting(true);
    setLineOaExportError(null);
    try {
      const { blob, filename } = await api.exportLineOfficialAccounts({
        search: storeManagementSearch,
        status: storeRouteStatus === "error" ? "issues" : storeRouteStatus,
        showArchived: showArchivedLineOas,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setLineOaExportError(error instanceof Error ? error.message : text.exportCsvFailed);
    } finally {
      setLineOaExporting(false);
    }
  }

  async function syncMasterFile() {
    if (masterSyncing || authUser?.role !== "ADMIN") return;
    setMasterSyncing(true);
    setLineOaError(null);
    try {
      const result = await api.syncStoreMaster();
      await loadApplicationData(true);
      setToastMessage(`${text.syncMasterSuccess} · Google Sheet: ${result.source.rows} ร้าน · Updated: ${result.connectedOaSync.updated} · Unchanged: ${result.connectedOaSync.unchanged} · Warnings: ${result.validation.incomplete} · Connected OA Updated: ${result.connectedOaSync.updated}`);
    } catch (error) {
      setLineOaError(`${text.syncMasterFailed}: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally { setMasterSyncing(false); }
  }

  async function copyWebhookUrl(accountId: string, returnedUrl?: string | null) {
    const url = returnedUrl ?? webhookInfoById[accountId]?.webhookUrl;
    if (!url) { setLineOaError(text.webhookNotConfigured); return; }
    try { await navigator.clipboard.writeText(url); setToastMessage(text.copied); }
    catch { setLineOaError(text.connectionError); }
  }

  async function regenerateWebhookUrl(account: LineOfficialAccountResponse) {
    if (!window.confirm(text.regenerateWebhookConfirmation)) return;
    setLineOaSubmitting(true); setLineOaError(null);
    try {
      const webhook = await api.regenerateLineOfficialAccountWebhook(account.id);
      setWebhookInfoById((current) => ({ ...current, [account.id]: webhook }));
      setToastMessage(text.webhookRegenerated);
      await loadApplicationData(true);
    } catch (error) { setLineOaError(error instanceof Error ? error.message : text.connectionError); }
    finally { setLineOaSubmitting(false); }
  }

  async function removeLineOa(account: LineOfficialAccountResponse) {
    if (!window.confirm(`${text.removeLineOaConfirmation}\n\n${account.name} — ${account.store.name}`)) return;
    setLineOaSubmitting(true);
    try {
      await api.removeLineOfficialAccount(account.id);
      setWebhookInfoById((current) => { const next = { ...current }; delete next[account.id]; return next; });
      setCreatedLineOa((current) => current?.account.id === account.id ? null : current);
      await loadApplicationData(true); setToastMessage(text.removeLineOa);
    }
    catch (error) { setLineOaError(error instanceof Error ? error.message : text.connectionError); }
    finally { setLineOaSubmitting(false); }
  }

  async function restoreLineOa(account: LineOfficialAccountResponse) {
    setLineOaSubmitting(true);
    try { await api.restoreLineOfficialAccount(account.id); await loadApplicationData(true); }
    finally { setLineOaSubmitting(false); }
  }

  async function deleteStorePermanently() {
    if (!storeRemovalPreview) return;
    setStoreRemovalLoading(true); setStoreRemovalMessage(null);
    try {
      const result = await api.deleteStore(storeRemovalPreview.storeId, storeRemovalPreview.storeName);
      if (result.result === "deleted") {
        const deletedStoreId = storeRemovalPreview.storeId;
        const deletedConversationIds = new Set(conversations.filter(({ storeId }) => storeId === deletedStoreId).map(({ id }) => id));
        setStores((current) => current.filter(({ id }) => id !== deletedStoreId));
        setAvailableStores((current) => current.filter(({ id }) => id !== deletedStoreId));
        setConversations((current) => current.filter(({ storeId }) => storeId !== deletedStoreId));
        setLineOas((current) => current.filter(({ store }) => store.id !== deletedStoreId));
        if (selectedStore === deletedStoreId) setSelectedStore("all");
        if (deletedConversationIds.has(selectedConversationId)) setSelectedConversationId("");
        localStorage.removeItem(UI_PREFERENCES_STORAGE_KEY);
        localStorage.removeItem(CONVERSATION_STATES_STORAGE_KEY);
        setStoreRemovalPreview(null); setPermanentDeleteStep(false); setPermanentDeleteConfirmation("");
        setToastMessage(text.storeDeletedSuccessfully); await loadApplicationData(true);
      }
    } catch (error) { setStoreRemovalMessage(error instanceof Error ? error.message : text.connectionError); }
    finally { setStoreRemovalLoading(false); }
  }

  async function archiveSelectedStore() {
    if (!storeRemovalPreview) return;
    setStoreRemovalLoading(true);
    try {
      const result = await api.archiveStore(storeRemovalPreview.storeId);
      if (result.result === "archived") {
        setStores((current) => current.filter(({ id }) => id !== storeRemovalPreview.storeId));
        if (selectedStore === storeRemovalPreview.storeId) setSelectedStore("all");
        setStoreRemovalPreview(null); setToastMessage(text.storeArchivedSuccessfully); await loadApplicationData(true);
      } else setStoreRemovalMessage(text.storeHasActiveLineOa);
    } finally { setStoreRemovalLoading(false); }
  }

  async function restoreStore(storeId: string) {
    await api.restoreStore(storeId); await loadApplicationData(true); setToastMessage(text.restoreStore);
  }

  async function loadEarlierMessages() {
    if (!selectedConversationId || !chatHistory.hasEarlier) return;
    setChatLoading(true);
    try { const earlier = await api.conversationMessages(selectedConversationId, chatHistory.page + 1); setChatHistory((current) => ({ ...earlier, items: [...earlier.items, ...current.items] })); }
    finally { setChatLoading(false); }
  }

  async function sendReply() {
    const conversationId = selectedConversationId;
    const textToSend = replyText.trim();
    if (!conversationId || !textToSend || replySending || authUser?.role !== "ADMIN") return;
    const idempotencyKey = replyIdempotencyKeyRef.current ?? crypto.randomUUID();
    replyIdempotencyKeyRef.current = idempotencyKey;
    setReplySending(true);
    setReplyError(null);
    try {
      const result = await api.sendConversationMessage(conversationId, textToSend, idempotencyKey);
      setChatHistory((current) => current.items.some(({ id }) => id === result.message.id)
        ? current
        : { ...current, items: [...current.items, result.message], total: current.total + 1 });
      setConversationStates((current) => current[conversationId]
        ? { ...current, [conversationId]: { ...current[conversationId], bmReplyStatus: "REPLIED", status: "completed" } }
        : current);
      setReplyText("");
      replyIdempotencyKeyRef.current = null;
      await loadApplicationData(true);
      window.requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setReplySending(false);
    }
  }

  function updateMessageEnglishTranslation(messageId: string, translatedText: string) {
    setChatHistory((current) => ({
      ...current,
      items: current.items.map((message) => message.id === messageId
        ? { ...message, translatedEnglish: translatedText }
        : message),
    }));
  }

  async function refreshProfile() {
    if (!selectedConversationId) return;
    setChatLoading(true);
    try { await api.refreshLineProfile(selectedConversationId); setSelectedApiConversation(await api.conversation(selectedConversationId)); }
    finally { setChatLoading(false); }
  }

  async function reanalyzeConversation() {
    if (!selectedConversationId) return;
    setChatLoading(true);
    try { const conversation = await api.reanalyzeConversation(selectedConversationId); setSelectedApiConversation(conversation); setToastMessage(text.classificationUpdated); await loadApplicationData(true); }
    finally { setChatLoading(false); }
  }

  async function editConversationTags() {
    if (!selectedConversationId || !selectedApiConversation) return;
    const currentProducts = selectedApiConversation.products.map(({ productModel }) => productModel.name).join(", ");
    const currentTopics = selectedApiConversation.topics.map(({ topic }) => topic.name).join(", ");
    const productNames = window.prompt(`${text.productModel}\n${availableProductModels.map(({ name }) => name).join(", ")}`, currentProducts);
    if (productNames === null) return;
    const topicNames = window.prompt(`${text.conversationTopics}\n${availableTopics.map(({ name }) => name).join(", ")}`, currentTopics);
    if (topicNames === null) return;
    const normalizeNames = (value: string) => value.split(",").map((name) => name.trim().toLocaleLowerCase()).filter(Boolean);
    const requestedProducts = normalizeNames(productNames); const requestedTopics = normalizeNames(topicNames);
    setChatLoading(true);
    try { const updated = await api.updateConversationTags(selectedConversationId, availableProductModels.filter(({ name }) => requestedProducts.includes(name.toLocaleLowerCase())).map(({ id }) => id), availableTopics.filter(({ name }) => requestedTopics.includes(name.toLocaleLowerCase())).map(({ id }) => id)); setSelectedApiConversation(updated); setToastMessage(text.classificationUpdated); }
    finally { setChatLoading(false); }
  }

  function connectionLabel(status: LineOfficialAccountResponse["connectionStatus"]) {
    return status === "CONNECTED" ? text.connected : status === "READY" ? text.ready : status === "ERROR" ? text.connectionError : status === "DISABLED" ? text.disabled : text.notConfigured;
  }

  function connectionTestMessage(result: LineOaTestResult) {
    if (result.status === "DISABLED") return text.disabled;
    if (result.credentialDecryptionError) return text.credentialDecryptionError;
    if (!result.credentialsAvailable) return text.missingChannelSecret;
    if (!result.accessTokenAvailable) return text.accessTokenInvalid;
    if (!result.webhookUrlConfigured) return text.missingPublicWebhookUrl;
    if (result.status === "CONNECTED") return text.connected;
    return text.testNoWebhook;
  }

  const managementWebhookInfo = lineOas.length > 0 ? webhookInfoById[lineOas[0].id] : undefined;

  async function submitLogin(event: FormEvent) {
    event.preventDefault(); setLoginLoading(true); setLoginError(null);
    try { setAuthUser(await api.login(loginEmail, loginPassword)); setLoginPassword(""); }
    catch (error) { setLoginError(error instanceof Error ? error.message : "Login failed"); }
    finally { setLoginLoading(false); }
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setAuthUser(null);
      setLoginPassword("");
      window.location.replace("/login");
    }
  }

  async function sendSetupOtp(event: FormEvent) {
    event.preventDefault(); if (setupPassword !== setupPasswordConfirmation) { setLoginError("Passwords do not match"); return; }
    setLoginLoading(true); setLoginError(null);
    try { const result = await api.requestSetupOtp(setupName, setupEmail, setupPassword, language); setSetupChallenge(result); setSetupExpires(result.expiresInSeconds); setSetupResend(result.resendAfterSeconds); }
    catch (error) { setLoginError(error instanceof Error ? error.message : "Unable to send OTP"); }
    finally { setLoginLoading(false); }
  }

  async function verifySetupOtp(event: FormEvent) {
    event.preventDefault(); if (!setupChallenge) return; setLoginLoading(true); setLoginError(null);
    try { const user = await api.verifySetupOtp({ challengeId: setupChallenge.challengeId, displayName: setupName, email: setupEmail, password: setupPassword, otp: setupOtp, language }); setAuthUser(user); setSetupStatus({ firstAdminRequired: false, registrationAvailable: false, emailProviderConfigured: setupStatus?.emailProviderConfigured ?? false, emailProviderMode: setupStatus?.emailProviderMode ?? "none" }); setToastMessage("Administrator created successfully"); }
    catch (error) { setLoginError(error instanceof Error ? error.message : "Invalid verification code"); }
    finally { setLoginLoading(false); }
  }

  const setupLabels = {
    th: { title: "สร้างผู้ดูแลระบบคนแรก", name: "ชื่อผู้ดูแล", email: "อีเมล", password: "รหัสผ่าน", confirm: "ยืนยันรหัสผ่าน", send: "ส่งรหัส OTP", verifyTitle: "ยืนยันอีเมล", sent: "กรอกรหัส 6 หลักที่ส่งไปยัง", verify: "ยืนยันและสร้างผู้ดูแลระบบ", resend: "ส่งรหัสอีกครั้ง", change: "เปลี่ยนอีเมล" },
    en: { title: "Create First Administrator", name: "Administrator name", email: "Email", password: "Password", confirm: "Confirm password", send: "Send OTP", verifyTitle: "Verify email", sent: "Enter the six-digit code sent to", verify: "Verify and Create Administrator", resend: "Send code again", change: "Change email" },
    zh: { title: "创建首位管理员", name: "管理员姓名", email: "电子邮箱", password: "密码", confirm: "确认密码", send: "发送验证码", verifyTitle: "验证电子邮箱", sent: "请输入发送至以下邮箱的六位验证码", verify: "验证并创建管理员", resend: "重新发送验证码", change: "更改邮箱" },
  }[language];

  if (!authChecked) return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500"><div className="absolute right-6 top-6"><ThemeControl /></div>Loading…</main>;
  if (setupStatusError) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-xl"><h1 className="text-xl font-bold">Unable to check administrator setup</h1><p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{setupStatusError}</p><button onClick={() => void checkSetupStatus()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-white">Retry</button></div></main>;
  if (setupStatus?.firstAdminRequired) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="absolute right-6 top-6 flex gap-2">{(["th", "en", "zh"] as const).map((item) => <button key={item} onClick={() => setLanguage(item)} className={`rounded px-2 py-1 text-xs ${language === item ? "bg-slate-900 text-white" : "bg-white"}`}>{item.toUpperCase()}</button>)}</div>{!setupChallenge ? <form onSubmit={(event) => void sendSetupOtp(event)} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl"><h1 className="text-2xl font-bold">{setupLabels.title}</h1>{!setupStatus.emailProviderConfigured && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800">Email delivery is not configured. Configure Resend or development console mode.</p>}{loginError && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{loginError}</p>}<label className="mt-5 block text-sm">{setupLabels.name}<input required value={setupName} onChange={(event) => setSetupName(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="mt-4 block text-sm">{setupLabels.email}<input type="email" required value={setupEmail} onChange={(event) => setSetupEmail(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="mt-4 block text-sm">{setupLabels.password}<input type={showSetupPassword ? "text" : "password"} minLength={12} required value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="mt-4 block text-sm">{setupLabels.confirm}<input type={showSetupPassword ? "text" : "password"} minLength={12} required value={setupPasswordConfirmation} onChange={(event) => setSetupPasswordConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={showSetupPassword} onChange={(event) => setShowSetupPassword(event.target.checked)} />Show password</label><p className={`mt-2 text-xs ${setupPassword.length >= 12 ? "text-green-700" : "text-amber-700"}`}>Password must contain at least 12 characters</p><button disabled={loginLoading || setupPassword !== setupPasswordConfirmation || setupPassword.length < 12} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{setupLabels.send}</button></form> : <form onSubmit={(event) => void verifySetupOtp(event)} className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl"><h1 className="text-2xl font-bold">{setupLabels.verifyTitle}</h1><p className="mt-2 text-sm text-slate-500">{setupLabels.sent} {setupChallenge.maskedEmail}</p>{loginError && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{loginError}</p>}<input aria-label="Six-digit verification code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoFocus value={setupOtp} onChange={(event) => setSetupOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} onPaste={(event) => { const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (value.length === 6) { event.preventDefault(); setSetupOtp(value); } }} className="mt-6 w-full rounded-lg border p-3 text-center font-mono text-3xl tracking-[0.5em]" /><p className="mt-2 text-center text-xs text-slate-500">{setupExpires > 0 ? `${Math.floor(setupExpires / 60)}:${String(setupExpires % 60).padStart(2, "0")}` : "Code expired"}</p><button disabled={loginLoading || setupOtp.length !== 6 || setupExpires === 0} className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{setupLabels.verify}</button><div className="mt-4 flex justify-between text-sm"><button type="button" onClick={() => { setSetupChallenge(null); setSetupOtp(""); setLoginError(null); }} className="text-blue-700">{setupLabels.change}</button><button type="button" disabled={setupResend > 0 || loginLoading} onClick={() => void api.resendSetupOtp(setupChallenge.challengeId, language).then((result) => { setSetupChallenge(result); setSetupExpires(result.expiresInSeconds); setSetupResend(result.resendAfterSeconds); }).catch((error: unknown) => setLoginError(error instanceof Error ? error.message : "Unable to resend"))} className="text-blue-700 disabled:text-slate-400">{setupLabels.resend}{setupResend > 0 ? ` (${setupResend})` : ""}</button></div></form>}</main>;
  if (!authUser) return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><form onSubmit={(event) => void submitLogin(event)} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl"><h1 className="text-xl font-bold">OPPO LINE OA Monitor</h1><p className="mt-1 text-sm text-slate-500">Administrator sign in</p>{process.env.NODE_ENV !== "production" && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-800">{language === "th" ? "บัญชีทดสอบสำหรับเครื่อง Local เท่านั้น" : language === "zh" ? "仅限本地开发账户" : "Local development account only"}</p>}{loginError && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{loginError}</p>}<label className="mt-5 block text-sm">Username or email<input type="text" required autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><label className="mt-4 block text-sm">Password<input type="password" required autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><button disabled={loginLoading} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{loginLoading ? "Signing in…" : "Sign in"}</button></form></main>;

  return (
    <AppShell
      currentSection={initialSection}
      authUser={authUser}
      text={text}
      language={language}
      changeLanguage={changeLanguage}
      searchText={searchText}
      setSearchText={setSearchText}
      pilotMode={systemStatus?.pilotMode}
      lastUpdatedAt={lastUpdatedAt}
      logout={logout}
      isLoading={isLoading}
      apiError={apiError}
      loadApplicationData={loadApplicationData}
    >
      <PageContainer variant="full">
        <div
          ref={chatContainerRef}
          className={`app-workspace-grid grid h-full min-h-0 max-h-full min-w-0 overflow-hidden ${initialSection === "chats" ? "chat-resizable-grid" : ""}`}
          style={initialSection === "chats" ? { gridTemplateColumns: `${chatPaneWidths.sidebar}px ${CHAT_PANE_LIMITS.separatorWidth}px ${chatPaneWidths.conversations}px ${CHAT_PANE_LIMITS.separatorWidth}px minmax(${CHAT_PANE_LIMITS.detailMin}px, 1fr)` } : undefined}
        >
          {initialSection === "chats" && (
            <ContextSidebar
              sidebarView={sidebarView}
              selectSidebarView={selectSidebarView}
              overview={bmSummaryData.overview}
              storeBmCounts={storeBmCounts}
              selectedStore={selectedStore}
              setSelectedStore={setSelectedStore}
              clearAllFilters={clearAllFilters}
              stores={stores}
              text={text}
              getStoreDisplayName={getStoreDisplayName}
              onRequestBulkUpdate={(req) => setBulkConfirmState(req)}
            />
          )}

          {initialSection === "chats" && <ResizableSeparator separator="sidebar" value={chatPaneWidths.sidebar} minimum={CHAT_PANE_LIMITS.sidebar.min} maximum={CHAT_PANE_LIMITS.sidebar.max} onResize={resizeChatPanes} />}

          {initialSection === "chats" && sidebarView === "pilotChecklist" ? (
            <PageContainer variant="full">
              <section className="col-span-2 overflow-y-auto p-6"><div className="mx-auto max-w-5xl"><h2 className="text-2xl font-bold">{text.pilotChecklist}</h2><select className="mt-4 rounded border p-2" value={pilotChecklist?.oa.id ?? ""} onChange={(event) => event.target.value && void loadPilotChecklist(event.target.value)}><option value="">Select LINE OA</option>{lineOas.map((oa) => <option key={oa.id} value={oa.id}>{oa.name}</option>)}</select>{pilotChecklist && <div className="mt-5 space-y-2">{pilotChecklist.items.map((item, index) => <div key={item.itemKey} className="grid grid-cols-[1fr_160px_2fr] items-center gap-3 rounded-lg bg-white p-3 shadow-sm"><span className="text-sm">{index + 1}. {item.itemKey.replaceAll("_", " ")}</span><select disabled={authUser.role !== "ADMIN"} value={item.status} onChange={(event) => void updatePilotItem(item.itemKey, event.target.value as typeof item.status, item.note ?? undefined)} className="rounded border p-2 text-sm"><option value="NOT_TESTED">Not tested</option><option value="PASSED">Passed</option><option value="FAILED">Failed</option><option value="NOT_APPLICABLE">Not applicable</option></select><input disabled={authUser.role !== "ADMIN"} defaultValue={item.note ?? ""} onBlur={(event) => void updatePilotItem(item.itemKey, item.status, event.target.value)} placeholder="Test note" className="rounded border p-2 text-sm" /></div>)}</div>}</div></section>
            </PageContainer>
          ) : initialSection === "chats" && sidebarView === "systemStatus" ? (
            <PageContainer variant="full">
              <section className="col-span-2 overflow-y-auto p-6"><div className="mx-auto max-w-5xl space-y-5"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold">{text.systemStatus}</h2><button onClick={() => void loadSystemStatus()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">{text.refreshStatus}</button></div>{systemStatus ? <><div className="grid grid-cols-3 gap-3">{Object.entries(systemStatus).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{key.replaceAll(/([A-Z])/g, " $1")}</p><p className="mt-2 font-semibold">{typeof value === "boolean" ? value ? "Healthy" : "Not configured" : value ?? "Not configured"}</p></div>)}</div><div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Recent operational errors</h3>{operationalErrors.length ? <div className="mt-3 space-y-2">{operationalErrors.map((error) => <div key={error.id} className="rounded bg-red-50 p-3 text-sm"><strong>{error.feature}</strong> · {error.summary}<span className="block text-xs text-slate-500">{new Date(error.createdAt).toLocaleString()} · {error.resolved ? "Resolved" : "Unresolved"}</span></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No recent errors</p>}</div></> : <p className="text-slate-500">{text.loadingData}</p>}</div></section>
            </PageContainer>
          ) : initialSection === "stores" ? (
            <PageContainer variant="wide">
              <section className="app-content-section col-span-2 overflow-y-auto">
                <div className="mx-auto max-w-7xl space-y-6">
                  <div className="flex items-start justify-between">
                    <div><h2 className="text-2xl font-bold">{text.lineOaManagement}</h2><p className="mt-1 text-sm text-slate-500">{text.lineOaDescription}</p></div>
                    <div className="flex flex-wrap items-center justify-end gap-3"><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showArchivedLineOas} onChange={(event) => setShowArchivedLineOas(event.target.checked)} />{text.showArchived}</label><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showArchivedStores} onChange={(event) => setShowArchivedStores(event.target.checked)} />{showArchivedStores ? text.hideArchivedStores : text.showArchived}</label>{authUser.role === "ADMIN" && <><button type="button" disabled={masterSyncing} onClick={() => void syncMasterFile()} className="app-button-secondary rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{masterSyncing ? text.syncingMasterFile : text.syncMasterFile}</button><button type="button" disabled={lineOaExporting} onClick={() => void exportLineOaCsv()} className="app-button-secondary rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{lineOaExporting ? text.exportingCsv : `↓ ${text.exportCsv}`}</button></>}<button onClick={() => { resetLineOaForm(); setShowLineOaForm(true); }} className="app-button-primary rounded-xl px-4 py-2.5 text-sm font-semibold">＋ {text.connectLineOa}</button></div>
                  </div>

                  <div className="app-card p-4">
                    <label className="app-muted block text-xs font-medium">{text.searchFilter}
                      <input value={storeManagementSearch} onChange={(event) => setStoreManagementSearch(event.target.value)} placeholder={text.searchAccountName} className="app-input mt-2 w-full rounded-xl border px-4 py-2.5 text-sm" />
                    </label>
                  </div>

                  {showArchivedStores && <div className="app-card p-5"><h3 className="text-sm font-semibold">{text.showArchived}</h3><div className="mt-3 space-y-2">{availableStores.filter(({ archivedAt }) => Boolean(archivedAt)).map((store) => <div key={store.id} className="app-filter-panel flex items-center justify-between rounded-xl px-3 py-2"><span className="text-sm">{store.name}</span><button onClick={() => void restoreStore(store.id)} className="app-button-secondary rounded-lg border px-3 py-1.5 text-xs">{text.restoreStore}</button></div>)}{availableStores.every(({ archivedAt }) => !archivedAt) && <p className="app-muted text-sm">{text.noStoresFound}</p>}</div></div>}

                  {lineOaError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{lineOaError}</div>}
                  {lineOaExportError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{lineOaExportError}</div>}

                  {managementWebhookInfo && !managementWebhookInfo.webhookUrlConfigured && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                      <h3 className="font-semibold">{text.publicWebhookSetupTitle}</h3>
                      <p className="mt-1 text-amber-800">{text.publicWebhookRequired}</p>
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div><dt className="text-xs font-medium text-amber-700">{text.backendPortLabel}</dt><dd className="font-mono">{managementWebhookInfo.backendPort}</dd></div>
                        <div><dt className="text-xs font-medium text-amber-700">{text.expectedWebhookPath}</dt><dd className="font-mono">{managementWebhookInfo.webhookPath}</dd></div>
                        <div className="sm:col-span-2"><dt className="text-xs font-medium text-amber-700">{text.tunnelExample}</dt><dd><code className="rounded bg-amber-100 px-2 py-1">ngrok http {managementWebhookInfo.backendPort}</code></dd></div>
                      </dl>
                      <ol className="mt-3 list-inside list-decimal space-y-1 text-amber-800"><li>{text.setWebhookEnvironment}</li><li>{text.restartBackend}</li></ol>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {[
                      [text.totalLineOa, lineOas.length],
                      [text.activeLineOa, lineOas.filter((item) => item.isActive).length],
                      [text.connectionIssues, lineOas.filter((item) => item.connectionStatus === "ERROR" || item.connectionStatus === "NOT_CONFIGURED").length],
                      [text.messagesToday, lineOas.reduce((sum, item) => sum + item.messagesReceivedToday, 0)],
                    ].map(([label, value]) => <div key={String(label)} className="app-card p-5"><p className="app-muted text-xs font-medium">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div>)}
                  </div>

                  <div className="app-card overflow-hidden">
                    {visibleLineOas.length === 0 ? <div className="p-16 text-center text-slate-500">{text.noLineOa}</div> : (
                      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{[text.lineOaManagement, text.stores, text.connectionStatus, text.webhookUrl, text.lastWebhook, text.messagesToday, text.action].map((heading) => <th key={heading} className="px-3 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
                        {visibleLineOas.map((account) => <tr key={account.id} className={!account.isActive ? "opacity-60" : ""}>
                          <td className="px-3 py-4 font-medium">{account.name}</td><td className="px-3 py-4"><span className="block font-medium">{getStoreDisplayName(account.store.name)}</span>{account.store.accountName && <span className="block text-xs text-slate-500">{account.store.accountName}</span>}<span className="block text-xs text-slate-500">{[account.store.province, account.store.region, account.store.lineId].filter(Boolean).join(" · ") || "—"}</span><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${account.store.dataSource === "MASTER" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{account.store.dataSource === "MASTER" ? text.masterFile : text.dataSource}</span></td>
                          <td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-xs ${account.connectionStatus === "CONNECTED" ? "bg-green-100 text-green-700" : account.connectionStatus === "READY" ? "bg-blue-100 text-blue-700" : account.connectionStatus === "ERROR" ? "bg-red-100 text-red-700" : account.connectionStatus === "DISABLED" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700"}`}>{connectionLabel(account.connectionStatus)}</span><span className={`mt-2 block text-xs ${account.credentialsHealthy ? "text-green-700" : "text-red-700"}`}>{account.credentialsHealthy ? text.credentialsReady : account.hasChannelSecret ? text.credentialDecryptionFailed : text.reenterChannelSecret}</span></td>
                          <td className="max-w-52 px-3 py-4 text-xs">{webhookInfoById[account.id]?.webhookUrl ?? account.webhookUrl ? <span className="block truncate" title={webhookInfoById[account.id]?.webhookUrl ?? account.webhookUrl ?? undefined}>{webhookInfoById[account.id]?.webhookUrl ?? account.webhookUrl}</span> : <span className="text-amber-700" title={text.publicWebhookRequired}>{text.webhookNotConfigured}</span>}</td><td className="px-3 py-4 text-xs">{account.lastWebhookReceivedAt ? new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(new Date(account.lastWebhookReceivedAt)) : "—"}</td><td className="px-3 py-4 text-center">{account.messagesReceivedToday}</td>
                          <td className="px-3 py-4"><div className="flex min-w-44 flex-wrap gap-1.5"><button onClick={() => openMonitoring({ lineOaId: account.id })} className="rounded border border-slate-300 px-2 py-1 text-xs">{text.viewConversations}</button>{account.store.lineManagerUrl ? <a href={account.store.lineManagerUrl} target="_blank" rel="noopener noreferrer" className="rounded border border-green-300 px-2 py-1 text-xs text-green-700">{text.openLineManager} ↗</a> : <button disabled title={text.noMasterUrl} className="rounded border border-slate-200 px-2 py-1 text-xs opacity-50">{text.openLineManager}</button>}{account.store.lineOaLink ? <a href={account.store.lineOaLink} target="_blank" rel="noopener noreferrer" className="rounded border border-green-300 px-2 py-1 text-xs text-green-700">{text.openLineOa} ↗</a> : <button disabled title={text.noMasterUrl} className="rounded border border-slate-200 px-2 py-1 text-xs opacity-50">{text.openLineOa}</button>}<button disabled={lineOaSubmitting} onClick={() => void testLineOa(account)} className="rounded border border-slate-300 px-2 py-1 text-xs">{text.testConnection}</button><button disabled={!webhookInfoById[account.id]?.webhookUrl && !account.webhookUrl} title={!webhookInfoById[account.id]?.webhookUrl && !account.webhookUrl ? text.publicWebhookRequired : undefined} onClick={() => void copyWebhookUrl(account.id, account.webhookUrl)} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50">{text.copyWebhook}</button><button onClick={() => editLineOa(account)} className="rounded border border-slate-300 px-2 py-1 text-xs">{text.edit}</button><button disabled={lineOaSubmitting} onClick={() => void toggleLineOa(account)} className="rounded border border-slate-300 px-2 py-1 text-xs">{account.isActive ? text.disable : text.activate}</button><button disabled={lineOaSubmitting} onClick={() => void regenerateWebhookUrl(account)} className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-800">{text.regenerateWebhook}</button>{account.archivedAt ? <button onClick={() => void restoreLineOa(account)} className="rounded border border-green-300 px-2 py-1 text-xs text-green-700">{text.restoreLineOa}</button> : <button onClick={() => void removeLineOa(account)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">{text.removeLineOa}</button>}</div>{connectionTest?.id === account.id && <p className="mt-2 text-xs text-slate-500">{connectionTestMessage(connectionTest.result)}</p>}</td>
                        </tr>)}
                      </tbody></table></div>
                    )}
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-5"><h3 className="font-semibold text-blue-900">{text.setupInstructions}</h3><ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-blue-800">{text.setupSteps.map((step) => <li key={step}>{step}</li>)}</ol></div>
                </div>

                {showLineOaForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6"><div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{editingLineOaId ? text.edit : text.connectLineOa}</h3><button onClick={() => setShowLineOaForm(false)} className="text-xl text-slate-400">×</button></div>
                  {lineOaError && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{lineOaError}</p>}
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    {!editingLineOaId && <div className="relative col-span-2"><label className="text-sm font-medium">{text.searchAccountName}<input role="combobox" aria-expanded={masterResults.length > 0} aria-controls="store-master-results" aria-activedescendant={masterActiveIndex >= 0 ? `master-result-${masterActiveIndex}` : undefined} value={searchQuery} onKeyDown={handleMasterSearchKey} onChange={(event) => { const nextQuery = event.target.value; setSearchQuery(nextQuery); setSelectedMaster(null); setMasterSearchState({ status: "idle" }); setMasterActiveIndex(-1); setLineOaForm(clearStoreMasterSelection); }} placeholder={text.selectStore} className="app-input mt-1 w-full rounded-lg border p-2" /></label>
                      {masterSearchState.status === "loading" && <p className="mt-1 text-xs text-slate-500">{text.searchingStoreMaster}</p>}{masterSearchState.status === "error" && <div className="mt-1 flex items-center gap-2 text-xs text-red-600"><span>{masterSearchState.message}</span><button type="button" onClick={() => setMasterRetryNonce((value) => value + 1)} className="rounded border border-red-200 px-2 py-1 font-medium">{text.retry}</button></div>}
                      {masterSearchState.status === "success" && masterSearchState.query.length > 0 && masterSearchState.suggestions.length === 0 && <div className="app-muted mt-1 text-xs"><p>{text.noMatchingAccount}</p><p>{text.manualFallbackHint}</p></div>}
                      {masterResults.length > 0 && <div id="store-master-results" role="listbox" className="app-surface absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border shadow-xl">{masterResults.length > 1 && <p className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-800">{text.multipleMatches}</p>}{masterResults.map((item, index) => <button id={`master-result-${index}`} role="option" aria-selected={index === masterActiveIndex} key={item.id} type="button" onMouseEnter={() => setMasterActiveIndex(index)} onClick={() => selectMasterRecord(item)} className={`app-list-item block w-full border-b px-3 py-3 text-left last:border-0 ${index === masterActiveIndex ? "is-selected" : ""}`}><strong className="block text-sm">{item.accountName}</strong><span className="app-muted block text-xs">{item.storeName}</span><span className="app-muted mt-1 block text-xs">{[item.province, item.region, item.externalStoreId ? `${text.storeIdLabel} ${item.externalStoreId}` : null, item.lineId].filter(Boolean).join(" · ")}</span>{item.matchReason === "FUZZY_SUGGESTION" && <span className="mt-1 inline-block rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{text.systemSuggested}</span>}</button>)}</div>}
                    </div>}
                    {selectedMaster && synchronizedMaster && <section className="store-master-sync-card col-span-2 p-4 text-sm" aria-labelledby="store-master-sync-title"><div className="flex items-center justify-between gap-3"><h4 id="store-master-sync-title" className="font-semibold">{text.syncedStoreMasterTitle}</h4><span className="app-chip rounded-full px-2 py-1 text-xs">{text.masterFile}</span></div><dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2"><div><dt className="store-master-sync-label">{text.storeIdLabel}</dt><dd>{synchronizedMaster.storeId}</dd></div><div><dt className="store-master-sync-label">{text.storeName}</dt><dd>{synchronizedMaster.storeName}</dd></div><div><dt className="store-master-sync-label">{text.accountName}</dt><dd>{synchronizedMaster.accountName}</dd></div><div><dt className="store-master-sync-label">{text.lineIdLabel}</dt><dd>{synchronizedMaster.lineId}</dd></div><div><dt className="store-master-sync-label">{text.province}</dt><dd>{synchronizedMaster.province}</dd></div><div><dt className="store-master-sync-label">{text.region}</dt><dd>{synchronizedMaster.region}</dd></div><div><dt className="store-master-sync-label">{text.openLineOa}</dt><dd>{synchronizedMaster.lineOaLink ? <a className="store-master-sync-link" href={synchronizedMaster.lineOaLink} target="_blank" rel="noopener noreferrer">{synchronizedMaster.lineOaLink} ↗</a> : "-"}</dd></div><div><dt className="store-master-sync-label">{text.openLineManager}</dt><dd>{synchronizedMaster.lineManagerUrl ? <a className="store-master-sync-link" href={synchronizedMaster.lineManagerUrl} target="_blank" rel="noopener noreferrer">{synchronizedMaster.lineManagerUrl} ↗</a> : "-"}</dd></div></dl>{selectedMaster.existingStore && <p className="mt-3 rounded bg-blue-50 p-2 text-blue-800">{text.storeAlreadyExists}: {selectedMaster.existingStore.name}</p>}{selectedMaster.dataQualityStatus !== "COMPLETE" && <p className="mt-2 text-amber-700">{text.incompleteMasterData}</p>}</section>}
                    <p className="col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{text.rotateCredentialsWarning}</p>
                    <label className="col-span-2 text-sm">{text.lineOaName} *<input value={lineOaForm.name} onChange={(event) => setLineOaForm((form) => ({ ...form, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label>
                    <label className="text-sm">{text.channelSecret} {editingLineOaId ? "" : "*"}<input type={showCredentials ? "text" : "password"} autoComplete="new-password" value={lineOaForm.channelSecret} onChange={(event) => setLineOaForm((form) => ({ ...form, channelSecret: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><label className="text-sm">{text.accessToken} {editingLineOaId ? "" : "*"}<input type={showCredentials ? "text" : "password"} autoComplete="new-password" value={lineOaForm.channelAccessToken} onChange={(event) => setLineOaForm((form) => ({ ...form, channelAccessToken: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label>
                    <button type="button" onClick={() => setShowCredentials((shown) => !shown)} className="col-span-2 text-left text-sm text-blue-700">{showCredentials ? text.hideSecret : text.showSecret}</button>
                    <button type="button" onClick={() => setShowAdvancedLineOa((shown) => !shown)} className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-left text-sm font-medium">{showAdvancedLineOa ? "▾" : "▸"} {text.advancedSettings}</button>
                    {showAdvancedLineOa && <><label className="col-span-2 text-sm">{text.stores}<select value={lineOaForm.storeId ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, storeId: event.target.value || undefined }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="">{text.autoCreateStore}</option>{availableStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label className="text-sm">{text.region}<input disabled={Boolean(lineOaForm.storeId)} value={lineOaForm.newStore?.region ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, newStore: { name: form.name, ...form.newStore, region: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2 disabled:bg-slate-100" /></label><label className="text-sm">{text.area}<input disabled={Boolean(lineOaForm.storeId)} value={lineOaForm.newStore?.area ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, newStore: { name: form.name, ...form.newStore, area: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2 disabled:bg-slate-100" /></label><label className="text-sm">{text.basicId}<input value={lineOaForm.basicId ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, basicId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><label className="text-sm">{text.channelId}<input value={lineOaForm.channelId ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, channelId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={lineOaForm.isActive} onChange={(event) => setLineOaForm((form) => ({ ...form, isActive: event.target.checked }))} />{text.activeStatus}</label></>}
                  </div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowLineOaForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">{text.cancel}</button><button disabled={lineOaSubmitting} onClick={() => void submitLineOa()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{lineOaSubmitting ? text.loadingData : text.saveConnection}</button></div>
                </div></div>}
                {createdLineOa && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
                    <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-xl bg-white p-7 shadow-xl">
                      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                        <h3 className="text-xl font-bold text-green-900">✓ {text.lineOaAdded}</h3>
                        <p className="mt-2 text-sm text-green-800">{text.pasteWebhookInstruction}</p>
                      </div>
                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="break-all font-mono text-sm">{createdLineOa.webhookUrl}</p>
                        <button onClick={() => void copyWebhookUrl(createdLineOa.account.id, createdLineOa.webhookUrl)} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
                          {text.copyWebhook}
                        </button>
                      </div>

                      {/* Automatic Background Backfill Status */}
                      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-slate-800">
                        <h4 className="font-semibold text-sm text-blue-900 flex items-center gap-2">
                          <svg className="h-4 w-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {followerInsightsTranslations[language]?.backfillStatusQueued || "Connected successfully. Historical follower data is being fetched."}
                        </h4>

                        {backfillJob ? (
                          <div className="mt-2 text-xs space-y-1">
                            <p className="font-medium text-slate-700">
                              {backfillJob.status === "COMPLETED"
                                ? followerInsightsTranslations[language]?.backfillStatusCompleted
                                : backfillJob.status === "COMPLETED_WITH_ERRORS"
                                  ? followerInsightsTranslations[language]?.backfillStatusPartial
                                  : backfillJob.status === "FAILED"
                                    ? followerInsightsTranslations[language]?.backfillStatusFailed
                                    : followerInsightsTranslations[language]?.backfillStatusQueued}
                            </p>
                            <p className="text-slate-500 font-mono">
                              Range: {backfillJob.dateFrom} ~ {backfillJob.dateTo} | Days: {backfillJob.totalDays} | Succeeded: {backfillJob.succeeded} | Skipped: {backfillJob.skipped} | Failed: {backfillJob.failed}
                            </p>
                            {backfillResult && (
                              <p className="mt-1 text-xs font-semibold text-green-700">
                                ✓ {backfillResult.succeeded ?? 0} dates updated.
                              </p>
                            )}
                            {(backfillJob.status === "FAILED" || backfillJob.status === "COMPLETED_WITH_ERRORS") && (
                              <button
                                type="button"
                                onClick={() => {
                                  void api.followerInsightsRetryJob(createdLineOa.account.id);
                                }}
                                className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
                              >
                                {followerInsightsTranslations[language]?.backfillStatusFailed || "Historical backfill failed. Click to retry."}
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-slate-600">
                            {followerInsightsTranslations[language]?.backfillStatusQueued}
                          </p>
                        )}
                      </div>

                      <ol className="mt-5 list-inside list-decimal space-y-1 text-sm text-slate-600">
                        {text.setupSteps.slice(1, 8).map((step) => <li key={step}>{step}</li>)}
                      </ol>
                      <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => setCreatedLineOa(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                          {text.close}
                        </button>
                        <button onClick={() => setCreatedLineOa(null)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
                          {text.goToLineOaManagement}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Backfill Confirmation Dialog */}
                {backfillModalOpen && createdLineOa && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-6">
                    <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                      <h3 className="text-lg font-bold text-slate-900">
                        {language === "th" ? "ดึงข้อมูลประวัติผู้ติดตามย้อนหลัง" : language === "zh" ? "补全历史关注者数据" : "Backfill historical follower data"}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        {createdLineOa.account.name}
                      </p>

                      <div className="mt-4 space-y-3 text-xs">
                        <div>
                          <label className="font-medium text-slate-700">
                            {language === "th" ? "วันเริ่มต้น" : language === "zh" ? "开始日期" : "Start Date"}
                          </label>
                          <input
                            type="date"
                            value={backfillDateFrom}
                            onChange={(e) => setBackfillDateFrom(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                          />
                        </div>
                        <div>
                          <label className="font-medium text-slate-700">
                            {language === "th" ? "วันสิ้นสุด" : language === "zh" ? "结束日期" : "End Date"}
                          </label>
                          <input
                            type="date"
                            value={backfillDateTo}
                            onChange={(e) => setBackfillDateTo(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                          />
                        </div>

                        <div className="rounded-lg bg-slate-100 p-3 text-slate-700 font-medium">
                          {language === "th"
                            ? `ประมาณการเรียก LINE API: ${getInclusiveCalendarDays(backfillDateFrom, backfillDateTo)} วัน สำหรับบัญชี ${createdLineOa.account.name}`
                            : language === "zh"
                              ? `预估 LINE API 调用：账号 ${createdLineOa.account.name} 共 ${getInclusiveCalendarDays(backfillDateFrom, backfillDateTo)} 天`
                              : `Estimated LINE API calls: ${getInclusiveCalendarDays(backfillDateFrom, backfillDateTo)} dates for account ${createdLineOa.account.name}`}
                        </div>

                        {backfillError && (
                          <div className="rounded-lg bg-rose-50 p-2 text-rose-700 border border-rose-200">
                            {backfillError}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          type="button"
                          disabled={backfillLoading}
                          onClick={() => setBackfillModalOpen(false)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {language === "th" ? "ยกเลิก" : language === "zh" ? "取消" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={backfillLoading}
                          onClick={async () => {
                            setBackfillLoading(true);
                            setBackfillError(null);
                            try {
                              const res = await api.followerInsightsBackfill({
                                dateFrom: backfillDateFrom,
                                dateTo: backfillDateTo,
                                lineOaId: createdLineOa.account.id,
                              });
                              setBackfillResult(res);
                              setBackfillModalOpen(false);
                            } catch (err) {
                              setBackfillError(err instanceof Error ? err.message : "Backfill failed");
                            } finally {
                              setBackfillLoading(false);
                            }
                          }}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {backfillLoading
                            ? (language === "th" ? "กำลังดึงข้อมูล..." : "Backfilling...")
                            : (language === "th" ? "ยืนยันการดึงข้อมูลย้อนหลัง" : language === "zh" ? "确认补全历史数据" : "Confirm Historical Backfill")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </PageContainer>
          ) : initialSection === "dashboard" ? (
            <PageContainer variant="full">
              <section className="app-content-section col-span-2 overflow-y-auto">
                <DashboardView
                  language={language}
                  lineOas={lineOas}
                  dashboardSummary={dashboardSummary}
                  bmSummaryData={bmSummaryData}
                  getStoreDisplayName={getStoreDisplayName}
                  onOpenStore={(storeId) => openMonitoring({ store: storeId })}
                  lastUpdatedAt={lastUpdatedAt}
                />
              </section>
            </PageContainer>
          ) : initialSection === "follower-insights" ? (
            <PageContainer variant="readable">
              <FollowerInsightsView language={language} />
            </PageContainer>
          ) : initialSection === "classification-insights" ? (
            <PageContainer variant="readable">
              <ClassificationInsightsView language={language} />
            </PageContainer>
          ) : initialSection === "friend-source-links" ? (
            <PageContainer variant="readable">
              <FriendSourceLinksView language={language} userRole={authUser.role} />
            </PageContainer>
          ) : (
            <>
              <section data-chat-pane="conversations" className="app-surface min-w-0 min-h-0 flex flex-col h-full overflow-hidden border-r border-slate-200 dark:border-slate-800">
                <div className="border-b border-slate-200 dark:border-slate-800 p-3.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 data-chat-list-title className="text-base font-semibold">
                        {conversationListTitle}
                      </h2>
                      <p className="app-muted mt-0.5 text-sm font-tabular">
                        {chatTotalCount} {text.searchResults}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedStore !== "all" && (
                        <div className="flex items-center gap-1.5">
                          {sidebarView === "notReplied" && (storeBmCounts[selectedStore]?.notReplied ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const storeObj = availableStores.find((s) => s.id === selectedStore);
                                const sName = storeObj ? getStoreDisplayName(storeObj.name) : selectedStore;
                                setBulkConfirmState({
                                  storeId: selectedStore,
                                  storeName: sName,
                                  targetStatus: "REPLIED",
                                  fromStatuses: ["NOT_REPLIED"],
                                  affectedCount: storeBmCounts[selectedStore]?.notReplied ?? 0,
                                });
                              }}
                              className="rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1 shadow-2xs transition-colors"
                              title="Mark all matching as replied"
                            >
                              <span>✓</span>
                              <span>{language === "th" ? "ตอบแล้วทั้งหมด" : language === "zh" ? "全部标记为已回复" : "Mark all as replied"} ({storeBmCounts[selectedStore]?.notReplied ?? 0})</span>
                            </button>
                          )}
                          {sidebarView === "notifiedBm" && (storeBmCounts[selectedStore]?.notifiedBm ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const storeObj = availableStores.find((s) => s.id === selectedStore);
                                const sName = storeObj ? getStoreDisplayName(storeObj.name) : selectedStore;
                                setBulkConfirmState({
                                  storeId: selectedStore,
                                  storeName: sName,
                                  targetStatus: "REPLIED",
                                  fromStatuses: ["NOTIFIED_BM"],
                                  affectedCount: storeBmCounts[selectedStore]?.notifiedBm ?? 0,
                                });
                              }}
                              className="rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1 shadow-2xs transition-colors"
                              title="Mark all notified BM as replied"
                            >
                              <span>✓</span>
                              <span>{language === "th" ? "ตอบแล้วทั้งหมด" : language === "zh" ? "全部标记为已回复" : "Mark all as replied"} ({storeBmCounts[selectedStore]?.notifiedBm ?? 0})</span>
                            </button>
                          )}
                          {sidebarView === "all" && ((storeBmCounts[selectedStore]?.notReplied ?? 0) + (storeBmCounts[selectedStore]?.notifiedBm ?? 0)) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const storeObj = availableStores.find((s) => s.id === selectedStore);
                                const sName = storeObj ? getStoreDisplayName(storeObj.name) : selectedStore;
                                const pendingCount = (storeBmCounts[selectedStore]?.notReplied ?? 0) + (storeBmCounts[selectedStore]?.notifiedBm ?? 0);
                                setBulkConfirmState({
                                  storeId: selectedStore,
                                  storeName: sName,
                                  targetStatus: "REPLIED",
                                  fromStatuses: ["NOT_REPLIED", "NOTIFIED_BM"],
                                  affectedCount: pendingCount,
                                });
                              }}
                              className="rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1 shadow-2xs transition-colors"
                              title="Mark pending conversations as replied"
                            >
                              <span>✓</span>
                              <span>{language === "th" ? "ตอบแล้วทั้งหมด" : language === "zh" ? "待办全部标记为已回复" : "Mark all as replied"} ({(storeBmCounts[selectedStore]?.notReplied ?? 0) + (storeBmCounts[selectedStore]?.notifiedBm ?? 0)})</span>
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        data-chat-filter-button
                        onClick={() => setShowFilterPanel((isOpen) => !isOpen)}
                        aria-expanded={showFilterPanel}
                        className="app-button-secondary rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-medium"
                      >
                        {text.moreFilters}
                      </button>
                      <StoreChatsOverflowMenu language={language} resetPaneSizes={resetChatPanes} />
                    </div>
                  </div>

                  {showFilterPanel && (
                    <div className="app-filter-panel mt-3 grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-2xs">
                      <label className="app-muted text-xs">
                        {text.storeFilter}
                        <select value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)} className="app-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs">
                          <option value="all">{text.allStores}</option>
                          {storeOptions.map((storeId) => <option key={storeId} value={storeId}>{getStoreDisplayName(availableStores.find(({ id }) => id === storeId)?.name ?? storeId)}</option>)}
                        </select>
                      </label>
                      <label className="app-muted text-xs">
                        {text.statusFilter}
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="app-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs">
                          <option value="all">{text.allStatuses}</option>
                          {statusOptions.map((status) => <option key={status} value={status}>{getStatusLabel(language, status)}</option>)}
                        </select>
                      </label>
                      <label className="app-muted text-xs">
                        {text.priorityFilter}
                        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)} className="app-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs">
                          <option value="all">{text.allPriorities}</option>
                          {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority === "High" ? text.highPriority : text.normalPriority}</option>)}
                        </select>
                      </label>
                      <label className="app-muted text-xs">
                        {text.seriesFilter}
                        <select value={seriesFilter} onChange={(event) => setSeriesFilter(event.target.value)} className="app-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs">
                          <option value="all">{text.allSeries}</option>
                          {seriesOptions.map((series) => <option key={series} value={series}>{series}</option>)}
                        </select>
                      </label>
                      <label className="app-muted col-span-2 text-xs">
                        {text.modelFilter}
                        <select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} className="app-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs">
                          <option value="all">{text.allModels}</option>
                          {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                        </select>
                      </label>
                      <label className="app-muted col-span-2 text-xs">
                        {text.topicFilter}
                        <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="app-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs">
                          <option value="all">{text.allTopics}</option>
                          {topicOptions.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                        </select>
                      </label>
                      <label className="app-muted col-span-2 text-xs">
                        {text.lineOaManagement}
                        <select value={lineOaFilter} onChange={(event) => setLineOaFilter(event.target.value)} className="app-input mt-1 w-full rounded-md border px-2 py-1.5 text-xs">
                          <option value="all">{text.allLineOa}</option>
                          {lineOas.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                      </label>
                    </div>
                  )}

                  {hasActiveFilters && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {searchText.trim() && <button onClick={() => setSearchText("")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.searchFilter}: {searchText.trim()} ×</button>}
                      {selectedStore !== "all" && <button onClick={() => setSelectedStore("all")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.storeFilter}: {getStoreDisplayName(availableStores.find(({ id }) => id === selectedStore)?.name ?? selectedStore)} ×</button>}
                      {statusFilter !== "all" && <button onClick={() => setStatusFilter("all")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.statusFilter}: {getStatusLabel(language, statusFilter)} ×</button>}
                      {priorityFilter !== "all" && <button onClick={() => setPriorityFilter("all")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.priorityFilter}: {priorityFilter === "High" ? text.highPriority : text.normalPriority} ×</button>}
                      {seriesFilter !== "all" && <button onClick={() => setSeriesFilter("all")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.seriesFilter}: {seriesFilter} ×</button>}
                      {modelFilter !== "all" && <button onClick={() => setModelFilter("all")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.modelFilter}: {modelFilter} ×</button>}
                      {topicFilter !== "all" && <button onClick={() => setTopicFilter("all")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.topicFilter}: {topicFilter} ×</button>}
                      {lineOaFilter !== "all" && <button onClick={() => setLineOaFilter("all")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.lineOaManagement}: {lineOas.find(({ id }) => id === lineOaFilter)?.name ?? lineOaFilter} ×</button>}
                      {(sidebarView === "notifiedBm" || sidebarView === "replied" || sidebarView === "notReplied") && <button onClick={() => setSidebarView("all")} className="app-chip rounded-md px-2 py-0.5 text-[11px] font-medium">{text.bmReplyStatus}: {bmReplyStatusLabels[language][sidebarView === "notifiedBm" ? "NOTIFIED_BM" : sidebarView === "replied" ? "REPLIED" : "NOT_REPLIED"]} ×</button>}
                      <button onClick={clearAllFilters} className="text-[11px] font-medium text-red-600 dark:text-red-400 hover:underline">{text.clearAll}</button>
                    </div>
                  )}
                </div>

                {bulkSuccessToast && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">✓</span>
                      <span>{bulkSuccessToast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkSuccessToast(null)}
                      className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
                    >
                      ×
                    </button>
                  </div>
                )}

                {hasNewChatsAvailable && (
                  <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between text-xs text-blue-700 shrink-0">
                    <span>{chatsPaginationText.newChatsAvailable}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setHasNewChatsAvailable(false);
                        setChatPage(1);
                      }}
                      className="font-semibold underline hover:text-blue-900 focus:outline-none"
                    >
                      {chatsPaginationText.refreshPage1}
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  {isChatPageLoading ? (
                    <ConversationRowSkeleton count={chatPageSize} />
                  ) : chatPageError ? (
                    <div className="p-8 text-center text-sm text-red-600">
                      <p>{chatsPaginationText.failedToLoadConversations}: {chatPageError}</p>
                      <button
                        type="button"
                        onClick={() => setIsChatPageLoading((v) => !v)}
                        className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        {text.retry}
                      </button>
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="app-empty-state px-6 py-16 text-center">
                      <p className="font-semibold">{text.noConversationsFound}</p>
                      <p className="mt-2 text-sm">{text.noResultsExplanation}</p>
                      {hasActiveFilters && (
                        <button onClick={clearAllFilters} className="app-button-primary mt-4 rounded-lg px-4 py-2 text-sm font-medium">
                          {text.clearFilter}
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredConversations.map((conversation) => {
                      const isSelected = conversation.id === selectedConversation?.id;
                      const status = conversationStates[conversation.id]?.status;
                      const currentBmReplyStatus = conversationStates[conversation.id]?.bmReplyStatus ?? conversation.bmReplyStatus;
                      const tags = getConversationListTags({
                        priority: conversation.priority,
                        priorityLabel: text.highPriority,
                        statusLabel: getStatusLabel(language, status),
                        product: conversation.product,
                        topic: conversation.topic,
                      });
                      const allTagLabels = [...tags.visible, ...tags.hidden].map(({ label }) => label).join(", ");

                      return (
                        <div
                          key={conversation.id}
                          data-conversation-row
                          data-selected={isSelected}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedConversationId(conversation.id);
                            setShowTranslation(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedConversationId(conversation.id);
                              setShowTranslation(true);
                            }
                          }}
                          aria-pressed={isSelected}
                          className={`conversation-list-row app-list-item relative w-full border-b border-slate-100 dark:border-slate-800/80 px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 cursor-pointer ${isSelected ? "is-selected" : ""
                            }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p data-conversation-customer className="truncate text-base font-bold leading-5 tracking-tight flex-1 text-slate-900 dark:text-slate-100">{conversation.customer}</p>

                            <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                data-conversation-action-menu
                                aria-label="Change status"
                                aria-expanded={openConversationDropdownId === conversation.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenConversationDropdownId((prev) => (prev === conversation.id ? null : conversation.id));
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title={language === "th" ? "เปลี่ยนสถานะ" : language === "zh" ? "更改状态" : "Change Status"}
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
                              </button>

                              {openConversationDropdownId === conversation.id && (
                                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xl text-xs backdrop-blur-md">
                                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {language === "th" ? "สถานะการตอบ" : language === "zh" ? "回复状态" : "Status"}
                                  </div>
                                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                  <button
                                    type="button"
                                    disabled={authUser?.role === "VIEWER"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenConversationDropdownId(null);
                                      void updateConversationBmReplyStatus(conversation.id, "NOT_REPLIED");
                                    }}
                                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium transition-colors ${currentBmReplyStatus === "NOT_REPLIED"
                                        ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-semibold"
                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                      }`}
                                  >
                                    <span className="text-slate-400 text-xs">⚪</span>
                                    <span>{bmReplyStatusLabels[language]["NOT_REPLIED"]}</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={authUser?.role === "VIEWER"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenConversationDropdownId(null);
                                      void updateConversationBmReplyStatus(conversation.id, "NOTIFIED_BM");
                                    }}
                                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium transition-colors ${currentBmReplyStatus === "NOTIFIED_BM"
                                        ? "bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 font-semibold"
                                        : "text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                      }`}
                                  >
                                    <span className="text-xs">🟣</span>
                                    <span>{bmReplyStatusLabels[language]["NOTIFIED_BM"]}</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={authUser?.role === "VIEWER"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenConversationDropdownId(null);
                                      void updateConversationBmReplyStatus(conversation.id, "REPLIED");
                                    }}
                                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium transition-colors ${currentBmReplyStatus === "REPLIED"
                                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-semibold"
                                        : "text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                      }`}
                                  >
                                    <span className="text-xs">🟢</span>
                                    <span>{bmReplyStatusLabels[language]["REPLIED"]}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <p data-conversation-message-preview className="conversation-message-preview mt-2 line-clamp-2 text-sm leading-5">
                            {conversation.translations[language]}
                          </p>

                          <div data-conversation-metadata className="app-muted mt-2.5 flex items-center gap-1.5 text-xs font-tabular">
                            <span className="min-w-0 truncate">{conversation.store}</span>
                            <span aria-hidden="true">·</span>
                            <span className="shrink-0 whitespace-nowrap">{formatRelativeTime(conversation.time, language)}</span>
                          </div>

                          <div className="mt-3.5 flex flex-wrap gap-1.5 font-tabular" title={allTagLabels || undefined} aria-label={allTagLabels || undefined}>
                            <span
                              data-conversation-bm-reply-status={currentBmReplyStatus}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${currentBmReplyStatus === "REPLIED"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                                  : currentBmReplyStatus === "NOTIFIED_BM"
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200"
                                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                            >
                              {bmReplyStatusLabels[language][currentBmReplyStatus]}
                            </span>
                            {tags.visible.map((tag, index) => (
                              <span
                                key={`${tag.kind}-${tag.label}-${index}`}
                                data-conversation-priority={tag.kind === "priority" ? conversation.priority : undefined}
                                className={`rounded-full px-2 py-0.5 text-xs ${tag.kind === "priority"
                                    ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200"
                                    : tag.kind === "status"
                                      ? status === "followUp"
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                                        : status === "reminded"
                                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                                          : status === "acknowledged"
                                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200"
                                            : status === "completed"
                                              ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200"
                                              : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200"
                                      : tag.kind === "product"
                                        ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200"
                                        : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                                  }`}
                              >
                                {tag.label}
                              </span>
                            ))}
                            {tags.hidden.length > 0 && (
                              <span className="app-chip rounded-full px-2 py-0.5 text-xs" aria-label={tags.hidden.map(({ label }) => label).join(", ")}>
                                +{tags.hidden.length}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="shrink-0">
                  <ConversationPaginationFooter
                    currentPage={chatPage}
                    pageSize={chatPageSize}
                    totalCount={chatTotalCount}
                    loading={isChatPageLoading}
                    language={language}
                    onPageChange={(newPage) => setChatPage(newPage)}
                    onPageSizeChange={(newSize) => {
                      setChatPageSize(newSize);
                      setChatPage(1);
                    }}
                  />
                </div>
              </section>

              <ResizableSeparator separator="conversations" value={chatPaneWidths.conversations} minimum={CHAT_PANE_LIMITS.conversations.min} maximum={CHAT_PANE_LIMITS.conversations.max} onResize={resizeChatPanes} />

              <section data-chat-pane="detail" className="app-surface h-full min-w-0 min-h-0 overflow-hidden flex flex-col">
                {selectedConversation && selectedConversationState ? (
                  <div data-chat-detail-workspace className="flex h-full min-h-0 flex-col">
                    {/* ── 1. COMPACT CUSTOMER HEADER ─────────────────────── */}
                    <header data-chat-detail-header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {selectedApiConversation?.customer.pictureUrl
                          ? <div role="img" aria-label={selectedApiConversation.customer.displayName} style={{ backgroundImage: `url(${selectedApiConversation.customer.pictureUrl})` }} className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center ring-1 ring-slate-200 dark:ring-slate-700 shadow-2xs" />
                          : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-xs text-white shadow-2xs">{(selectedApiConversation?.customer.displayName ?? selectedConversation.customer).slice(0, 2).toUpperCase()}</div>
                        }
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <h2 data-chat-detail-customer className="truncate text-base font-bold tracking-tight">
                              {selectedApiConversation?.customer.displayName ?? selectedConversation.customer}
                            </h2>
                            <span className="app-muted shrink-0 text-xs font-medium">{selectedConversation.store}</span>
                            {selectedApiConversation?.customer.profileFetchStatus !== "SUCCESS" && <span className="shrink-0 text-xs text-amber-600 dark:text-amber-300">{text.profileUnavailable}</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-tabular">
                            {customerIntelligence && (
                              <span className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-semibold ${customerIntelligence.customerStage === "PURCHASED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                                  : customerIntelligence.customerStage === "INTERESTED" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40"
                                    : customerIntelligence.customerStage === "NEW" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                      : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40"}`}>
                                {customerIntelligence.customerStage.replaceAll("_", " ")}
                              </span>
                            )}
                            <span className="rounded-md bg-amber-50 px-1.5 py-0.2 text-[10px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200/60 dark:border-amber-900/40">
                              {followUpStatusLabels[language][selectedConversationState.status]}
                            </span>
                            <span className={`rounded-md px-1.5 py-0.2 text-[10px] font-medium ${selectedConversation.priority === "High" ? "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200 border border-red-200/60 dark:border-red-900/40" : "app-chip"}`}>
                              {selectedConversation.priority === "High" ? text.highPriority : text.normalPriority}
                            </span>
                            <select
                              data-bm-reply-status-select
                              aria-label={text.bmReplyStatus}
                              disabled={isMutating || authUser?.role === "VIEWER"}
                              value={selectedConversationState.bmReplyStatus}
                              onChange={(e) => void updateBmReplyStatus(e.target.value as ApiBmReplyStatus)}
                              className={`rounded-md border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 text-[10px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${selectedConversationState.bmReplyStatus === "REPLIED" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                                  : selectedConversationState.bmReplyStatus === "NOTIFIED_BM" ? "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200"
                                    : "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                            >
                              <option value="NOT_REPLIED">{bmReplyStatusLabels[language].NOT_REPLIED}</option>
                              <option value="NOTIFIED_BM">{bmReplyStatusLabels[language].NOTIFIED_BM}</option>
                              <option value="REPLIED">{bmReplyStatusLabels[language].REPLIED}</option>
                            </select>
                            <span className="app-muted text-[10px]">{formatRelativeTime(selectedConversation.time, language)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          data-chat-detail-secondary-action
                          disabled={chatLoading}
                          onClick={() => void refreshProfile()}
                          title={text.refreshLineProfile}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          ↻
                        </button>
                        <button
                          data-chat-detail-primary-action
                          type="button"
                          onClick={() => void openSelectedConversationInLineOa()}
                          className="app-button-primary inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          aria-label="เปิดใน LINE OA Manager"
                        >
                          เปิดใน LINE OA <span aria-hidden="true">↗</span>
                        </button>
                      </div>
                    </header>

                    {/* ── 2. CHAT CONVERSATION — PRIMARY AREA ─────────── */}
                    <div className="flex min-h-0 shrink-0 flex-col">
                      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-1.5">
                        <p className="app-muted text-xs font-tabular">{chatHistory.total} {text.messagesToday}</p>
                        <button
                          data-chat-detail-secondary-action
                          onClick={() => setShowTranslation(!showTranslation)}
                          className="app-button-secondary rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                        >
                          🌐 {showTranslation ? text.showOriginal : text.translateMessage}
                        </button>
                      </div>
                      <div data-chat-message-scroll className="h-[clamp(320px,48vh,540px)] min-h-0 space-y-2.5 overflow-y-auto overscroll-contain bg-slate-50/70 px-4 py-3 dark:bg-slate-950/60">
                        {chatHistory.hasEarlier && <div className="pb-2 text-center"><button disabled={chatLoading} onClick={() => void loadEarlierMessages()} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 shadow-2xs">{text.loadEarlierMessages}</button></div>}
                        {chatHistory.items.map((message, index) => { const previous = chatHistory.items[index - 1]; const date = new Date(message.sentAt); const showDate = !previous || new Date(previous.sentAt).toDateString() !== date.toDateString(); const translated = language === "th" ? message.translatedThai : language === "en" ? message.translatedEnglish : message.translatedChinese; const content = showTranslation ? translated ?? message.originalText : message.originalText; const inbound = message.direction === "INBOUND"; return <div key={message.id}>{showDate && <div data-chat-date-separator className="my-4 text-center text-xs text-slate-400 font-tabular">{new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(date)}</div>}<div className={`flex items-end gap-2 ${message.direction === "SYSTEM" ? "justify-center" : inbound ? "justify-start" : "justify-end"}`}>{inbound && <div style={selectedApiConversation?.customer.pictureUrl ? { backgroundImage: `url(${selectedApiConversation.customer.pictureUrl})` } : undefined} className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 bg-cover bg-center text-xs font-medium">{selectedApiConversation?.customer.pictureUrl ? "" : (selectedApiConversation?.customer.displayName ?? "L").slice(0, 1)}</div>}<div className={`max-w-[72%] ${message.direction === "SYSTEM" ? "bg-transparent text-xs text-slate-400 font-tabular" : inbound ? "rounded-2xl rounded-bl-xs bg-white border border-slate-200/80 px-4 py-2.5 shadow-2xs dark:bg-slate-900 dark:border-slate-800 text-slate-900 dark:text-slate-100" : "rounded-2xl rounded-br-xs bg-emerald-50/90 border border-emerald-200/60 px-4 py-2.5 dark:bg-emerald-950/40 dark:border-emerald-800/50 text-slate-900 dark:text-slate-100"}`}>{message.messageType === "IMAGE" ? <MessageImage messageId={message.id} media={message.media} alt={text.customerImage} unavailableLabel={text.imageUnavailable} errorLabel={text.imageLoadError} retryLabel={text.retryImage} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>}{message.fileName && <p className="mt-1 text-xs font-medium">📎 {message.fileName}</p>}<MessageTranslationAction message={message} userRole={authUser.role} onTranslated={(translatedText) => updateMessageEnglishTranslation(message.id, translatedText)} /><p className={`mt-1 text-[10px] text-slate-400 font-tabular ${inbound ? "" : "text-right"}`}>{new Intl.DateTimeFormat(language, { timeStyle: "short" }).format(date)}</p></div></div></div>; })}
                        {chatHistory.items.length === 0 && <p className="py-16 text-center text-sm text-slate-500">{text.noMessages}</p>}
                        <div ref={chatEndRef} />
                      </div>
                      <div data-chat-reply-composer className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-4 py-3">
                        <div className="flex items-end gap-2">
                          <textarea
                            value={replyText}
                            disabled={replySending || authUser.role === "VIEWER"}
                            maxLength={5000}
                            rows={2}
                            aria-label="พิมพ์ข้อความตอบกลับลูกค้า"
                            placeholder={authUser.role === "VIEWER" ? "บัญชี Viewer อ่านได้อย่างเดียว" : "พิมพ์ข้อความตอบกลับลูกค้า..."}
                            onChange={(event) => {
                              setReplyText(event.target.value);
                              setReplyError(null);
                              replyIdempotencyKeyRef.current = null;
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void sendReply();
                              }
                            }}
                            className="app-input max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={!replyText.trim() || replySending || authUser.role === "VIEWER"}
                            onClick={() => void sendReply()}
                            className="app-button-primary h-11 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {replySending ? "กำลังส่ง..." : "ส่ง"}
                          </button>
                        </div>
                        {replyError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{replyError}</p>}
                        <p className="app-muted mt-1 text-right text-[10px] font-tabular">{replyText.length.toLocaleString()}/5,000 · Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่</p>
                      </div>
                      <p data-line-oa-manager-notice className="shrink-0 flex items-start gap-2 border-t border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/40 px-4 py-1.5 text-xs text-slate-600 dark:text-slate-400"><span aria-hidden="true">ⓘ</span><span>{text.repliesMayNotAppear}</span></p>
                    </div>

                    {/* ── 3. AI INTENT CONTEXT CHIPS ──────────────────────── */}
                    {customerIntelligence && (customerIntelligence.intent.length > 0 || customerIntelligence.interestedProducts.length > 0) && (
                      <div data-chat-intent-chips className="shrink-0 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)] px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Context:</span>
                          {customerIntelligence.intent.map((item, i) => (
                            <span key={i} className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">{item}</span>
                          ))}
                          {customerIntelligence.interestedProducts.map((product, i) => (
                            <span key={`p${i}`} className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">📱 {product}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── 4. INFORMATION PANELS + LOWER SECTIONS ─────────── */}
                    <div data-chat-detail-scroll className="min-h-0 flex-1 overflow-y-auto">
                      <div className="px-3 py-3 sm:px-4">

                        {/* 4a. 2-column info grid: Customer Profile | AI Intelligence */}
                        <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] pb-3">
                          {/* Customer Profile column */}
                          <div className="space-y-3">
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-2xs">
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer Profile</p>
                              <div className="space-y-1.5 text-xs font-tabular">
                                <div className="flex justify-between gap-2"><span className="text-slate-500">Name</span><span className="truncate text-right font-medium">{selectedApiConversation?.customer.displayName ?? selectedConversation.customer}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-slate-500">Store</span><span className="truncate text-right font-medium">{selectedConversation.store}</span></div>
                                {customerIntelligence && <div className="flex justify-between gap-2"><span className="text-slate-500">Stage</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${customerIntelligence.customerStage === "PURCHASED" ? "bg-emerald-100 text-emerald-800" : customerIntelligence.customerStage === "INTERESTED" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>{customerIntelligence.customerStage.replaceAll("_", " ")}</span></div>}
                                <div className="flex justify-between gap-2"><span className="text-slate-500">Waiting</span><span className="font-medium">{formatRelativeTime(selectedConversation.time, language)}</span></div>
                              </div>
                            </div>
                            {selectedApiConversation && (
                              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-2xs">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Behavior Signals</p>
                                <CustomerSignals events={customerEvents} isLoading={customerEventsLoading} error={customerEventsError} language={language} />
                              </div>
                            )}
                          </div>
                          {/* AI Intelligence column */}
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-2xs">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{text.customerIntelligence}</p>
                              {customerIntelligence?.confidenceScore != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-tabular">{text.confidence}: {Math.round(customerIntelligence.confidenceScore * 100)}%</span>}
                            </div>
                            {customerIntelligenceLoading ? (
                              <div className="space-y-2">
                                <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                                <div className="h-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                                <div className="h-8 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                              </div>
                            ) : customerIntelligenceError ? (
                              <p className="text-xs text-rose-600 dark:text-rose-400">{customerIntelligenceError}</p>
                            ) : customerIntelligence ? (
                              <div className="space-y-2 text-xs">
                                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round(customerIntelligence.confidenceScore * 100)}%` }} /></div>
                                {customerIntelligence.intent.length > 0 && <div><p className="mb-1 text-[10px] uppercase text-slate-400">{text.intent}</p><div className="flex flex-wrap gap-1">{customerIntelligence.intent.map((item, i) => <span key={i} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">{item}</span>)}</div></div>}
                                {customerIntelligence.interestedProducts.length > 0 && <div><p className="mb-1 text-[10px] uppercase text-slate-400">{text.interestedProducts}</p><div className="flex flex-wrap gap-1">{customerIntelligence.interestedProducts.map((product, i) => <span key={i} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">{product}</span>)}</div></div>}
                                {aiRecommendedNextAction && <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/60"><p className="text-[10px] font-semibold uppercase text-blue-600 dark:text-blue-300">{text.aiRecommendedNextAction}</p><p className="mt-1 text-[11px] text-slate-800 dark:text-blue-100 leading-relaxed">{aiRecommendedNextAction}</p></div>}
                                {customerIntelligence.recommendedActions.length > 0 && <ul className="space-y-1">{customerIntelligence.recommendedActions.slice(0, 3).map((action, i) => <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[8px] text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">✓</span>{action}</li>)}</ul>}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">{text.noCustomerIntelligence}</p>
                            )}
                          </div>
                        </div>

                        {/* 4b. Name History — collapsible */}
                        {selectedApiConversation && (
                          <details className="group border-b border-[var(--border)] py-2">
                            <summary className="flex cursor-pointer items-center gap-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 list-none">
                              <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                              {text.lineNameHistory} — {customerNameHistory?.currentName ?? selectedApiConversation.customer.displayName}
                            </summary>
                            <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
                              {customerNameHistoryLoading ? <p className="text-slate-500">Loading...</p>
                                : customerNameHistoryError ? <p className="text-rose-600">{customerNameHistoryError}</p>
                                  : customerNameHistory?.history.length ? (
                                    <div className="space-y-1.5 font-tabular">
                                      {customerNameHistory.history.map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
                                          <span className="font-medium">{entry.displayName}</span>
                                          <span className="shrink-0 text-[10px] text-slate-400">{new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.capturedAt))} · {entry.source}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : <p className="text-slate-500">{text.noNameHistory}</p>}
                            </div>
                          </details>
                        )}

                        <div data-chat-detail-lower className="chat-detail-lower grid gap-0 py-3">
                          <section data-product-intent-card data-insights-section className="pb-3 chat-detail-insights">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <h3 className="font-semibold">{text.productInsight}</h3>
                              <div className="flex flex-wrap gap-2">
                                <button data-chat-detail-secondary-action disabled={chatLoading} onClick={() => void reanalyzeConversation()} className="app-button-secondary rounded border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{text.reanalyzeConversation}</button>
                                <button data-chat-detail-secondary-action disabled={chatLoading} onClick={() => void editConversationTags()} className="app-button-secondary rounded border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{text.editTags}</button>
                              </div>
                            </div>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                              <div><dt className="app-muted text-xs">{text.productCategory}</dt><dd className="mt-0.5 text-sm font-medium">{selectedApiConversation?.products.map(({ productModel }) => productModel.productSeries.productGroup?.replaceAll("_", " ")).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(", ") || text.noProductDetected}</dd></div>
                              <div><dt className="app-muted text-xs">{text.productModel}</dt><dd className="mt-0.5 text-sm font-medium font-tabular">{selectedApiConversation?.products.map(({ productModel, confidence }) => `${productModel.productSeries.name} · ${productModel.name}${confidence == null ? "" : ` (${Math.round(confidence * 100)}%)`}`).join(", ") || text.noProductDetected}</dd></div>
                              <div><dt className="app-muted text-xs">{text.customerRelationship}</dt><dd><span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-200">{selectedConversation.relationship === "Interested" ? text.interested : selectedConversation.relationship}</span></dd></div>
                              <div><dt className="app-muted text-xs">{text.purchaseIntent}</dt><dd><span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-200">{selectedConversation.purchaseIntent === "High Intent" ? text.highIntent : selectedConversation.purchaseIntent}</span></dd></div>
                            </dl>
                            <div className="mt-3 border-t border-[var(--border)] pt-3">
                              <h4 className="app-muted mb-2 text-xs font-semibold uppercase tracking-wide">{text.conversationTopics}</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {(selectedApiConversation?.topics ?? selectedConversation.topic.split(" · ").filter(Boolean).map((name) => ({ topic: { id: name, name, category: "" }, source: null, confidence: null })))
                                  .map(({ topic, source }) => (
                                    <span
                                      key={topic.id}
                                      className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/60 dark:text-blue-200"
                                    >
                                      {topic.name} <span className="text-[10px] opacity-70">{source === "MANUAL" ? text.manualSource : text.autoSource}</span>
                                    </span>
                                  ))}
                                {selectedApiConversation?.topics.length === 0 && <span className="text-sm text-slate-500">{text.noTopicDetected}</span>}
                              </div>
                            </div>
                          </section>

                          <section data-topics-note-card data-internal-note-section className="border-t border-[var(--border)] py-3 chat-detail-note">
                            <label className="mb-2 block text-sm font-semibold">{text.internalNote}</label>
                            <textarea value={selectedConversationState.note} onChange={(event) => updateInternalNote(event.target.value)} onBlur={() => void saveInternalNote()} disabled={isMutating} placeholder={text.notePlaceholder} className="app-input h-24 min-h-20 w-full resize-y rounded-lg border p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                            <p className="app-muted mt-1.5 text-xs">{isMutating ? text.loadingData : text.noteSaveHint}</p>
                          </section>

                          <section data-activity-history className="border-t border-[var(--border)] pt-3 chat-detail-activity">
                            <h3 className="mb-3 text-sm font-semibold">{text.activityHistory}</h3>
                            {selectedConversationState.activityHistory.length > 0 ? (
                              <div className="space-y-2">
                                {[...selectedConversationState.activityHistory]
                                  .reverse()
                                  .map((activity) => (
                                    <div
                                      key={activity.id}
                                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
                                    >
                                      <p className="text-sm">
                                        {activity.actionType === "messageReceived" ? (
                                          text.messageReceivedActivity
                                        ) : activity.actionType === "bmReplyStatus" && activity.bmReplyStatus ? (
                                          <>
                                            {text.bmReplyStatusChangedTo}{" "}
                                            <span className="font-semibold">{bmReplyStatusLabels[language][activity.bmReplyStatus]}</span>
                                          </>
                                        ) : activity.status ? (
                                          <>
                                            {text.statusChangedTo}{" "}
                                            <span className="font-semibold">{getStatusLabel(language, activity.status)}</span>
                                          </>
                                        ) : null}
                                      </p>
                                      <time className="text-xs text-slate-500" dateTime={activity.timestamp}>
                                        {formatRelativeTime(activity.timestamp, language)}
                                      </time>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">{text.noActivity}</p>
                            )}
                          </section>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-full items-center justify-center text-center">
                    <div>
                      <p className="font-semibold">{text.noConversationsFound}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {text.noResultsExplanation}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </PageContainer>
      {storeRemovalPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="remove-store-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 id="remove-store-title" className="text-xl font-bold">{text.removeStore}</h2>
            <p className="mt-2 text-sm text-slate-600">{text.removeStoreQuestion.replace("{storeName}", storeRemovalPreview.storeName)}</p>
            <dl className="mt-5 grid grid-cols-4 gap-3">
              {[[text.lineOaAccountsCount, storeRemovalPreview.lineOfficialAccountCount], [text.conversationCountLabel, storeRemovalPreview.conversationCount], [text.messageCountLabel, storeRemovalPreview.messageCount], [text.noteActivityCountLabel, storeRemovalPreview.noteCount + storeRemovalPreview.activityCount]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-100 p-3 text-center"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-xl font-bold">{value}</dd></div>)}
            </dl>
            {!permanentDeleteStep ? <div className="mt-4 space-y-2 text-sm"><p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{text.permanentDeleteDescription}</p><p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">{text.archiveDescription}</p></div> : <div className="mt-4"><p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">{text.irreversibleWarning}</p><label className="mt-3 block text-sm">{text.typeStoreName}<input autoFocus value={permanentDeleteConfirmation} onChange={(event) => setPermanentDeleteConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-red-300 p-2" /></label></div>}
            {storeRemovalMessage && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{storeRemovalMessage}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-3"><button disabled={storeRemovalLoading} onClick={() => { setStoreRemovalPreview(null); setPermanentDeleteStep(false); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">{text.cancel}</button>{!permanentDeleteStep ? <><button disabled={storeRemovalLoading} onClick={() => setPermanentDeleteStep(true)} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white">{text.deletePermanently}</button><button disabled={storeRemovalLoading} onClick={() => void archiveSelectedStore()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white">{text.archiveStore}</button></> : <button disabled={storeRemovalLoading || permanentDeleteConfirmation !== storeRemovalPreview.storeName} onClick={() => void deleteStorePermanently()} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{storeRemovalLoading ? text.loadingData : text.deletePermanently}</button>}</div>
          </div>
        </div>
      )}
      {bulkConfirmState && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-base">
                ⚡
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="bulk-confirm-title" className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {language === "th"
                    ? "ยืนยันการเปลี่ยนสถานะการตอบ"
                    : language === "zh"
                      ? "确认更新BM回复状态"
                      : "Confirm BM Reply Status Update"}
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {bulkConfirmState.storeName}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-4 text-sm text-slate-700 dark:text-slate-300">
              <p>
                {language === "th" ? (
                  <>
                    เปลี่ยนสถานะ <strong>{bulkConfirmState.affectedCount}</strong> การสนทนาของ{" "}
                    <strong>{bulkConfirmState.storeName}</strong> เป็น{" "}
                    <strong className="text-blue-600 dark:text-blue-400">
                      &ldquo;{bmReplyStatusLabels[language][bulkConfirmState.targetStatus]}&rdquo;
                    </strong>{" "}
                    หรือไม่?
                  </>
                ) : language === "zh" ? (
                  <>
                    确定将 <strong>{bulkConfirmState.storeName}</strong> 的{" "}
                    <strong>{bulkConfirmState.affectedCount}</strong> 条对话状态更新为{" "}
                    <strong className="text-blue-600 dark:text-blue-400">
                      &ldquo;{bmReplyStatusLabels[language][bulkConfirmState.targetStatus]}&rdquo;
                    </strong>{" "}
                    吗？
                  </>
                ) : (
                  <>
                    Update <strong>{bulkConfirmState.affectedCount}</strong> conversations for{" "}
                    <strong>{bulkConfirmState.storeName}</strong> to{" "}
                    <strong className="text-blue-600 dark:text-blue-400">
                      &ldquo;{bmReplyStatusLabels[language][bulkConfirmState.targetStatus]}&rdquo;
                    </strong>?
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() => setBulkConfirmState(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {language === "th" ? "ยกเลิก" : language === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={isBulkUpdating || bulkConfirmState.affectedCount === 0}
                onClick={() => void handleExecuteBulkUpdate()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
              >
                {isBulkUpdating && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                <span>{language === "th" ? "ยืนยัน" : language === "zh" ? "确认" : "Confirm"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          <span>{toastMessage}</span>
          {managerLinkMissing && <Link href="/stores" className="ml-3 underline underline-offset-2">{text.storeManagement}</Link>}
        </div>
      )}
    </AppShell>
  );
}
