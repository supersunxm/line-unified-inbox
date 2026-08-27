"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import type { ApiCustomerEvent } from "@/types/api";
import { ApiError, api } from "@/lib/api";
import { AUTH_UNAUTHORIZED_EVENT, getAuthState, resolveAuthRedirect, routeAfterLogin } from "@/lib/auth-session";
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
import { followerInsightsTranslations } from "./follower-insights/follower-insights-translations";
import { getInclusiveCalendarDays } from "./follower-insights/follower-insights-utils";
import { FriendSourceLinksView } from "./friend-source-links/friend-source-links-view";
import { MassMessagesView } from "./mass-messages/mass-messages-view";
import { DashboardView } from "./dashboard/dashboard-view";
import { AppShell, ContextSidebar, PageContainer, PageHeader, FilterBar } from "@/components/shell";
import {
  Badge,
  type BadgeVariant,
  Button,
  IconButton,
  Card,
  MetricCard,
  Input,
  SearchInput,
  Select,
  TableContainer,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableEmptyState,
  ErrorState,
} from "@/components/ui";
import type { SidebarView } from "@/components/shell";
import { StoreChatsOverflowMenu } from "@/components/chats/store-chats-overflow-menu";
import { ResizableSeparator } from "./resizable-separator";
import { CHAT_PANE_LIMITS } from "./resizable-panes";
import { useResizablePanes } from "./use-resizable-panes";
import { ConversationPaginationFooter } from "./conversation-pagination-footer";
import { ConversationRowSkeleton } from "./conversation-row-skeleton";
import { getChatsPaginationText } from "./chats-pagination-utils";
import { buildConversationListQuery, conversationListQueryKey, LatestConversationRequestGuard, reconcileConversationPage, type ConversationListQuery } from "./conversation-list-query";
import { getBmCustomerSalesTags, getBmTagChipClass, getConversationListTags, getConversationListTitle } from "./conversation-list-presentation";
import type { ApiBmReplyStatus, ApiConversation, ApiCustomerIntelligence, ApiCustomerSalesInformation, ApiFollowUpStatus, ApiStore, BackfillJobResponseDto, BmReplyStatusSummaryResponse, ConversationMessagesResponse, CreateLineOaInput, DashboardAnalyticsResponse, LineOfficialAccountResponse, LineOaTestResult, LineOaWebhookInfo, StoreDeletionPreview, StoreMasterSuggestion, StoreMasterSyncResult, SyncBatchResult } from "@/types/api";

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
  customerSalesInformation?: ApiCustomerSalesInformation;
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
    selectConversationTitle: "เลือกการสนทนา",
    selectConversationDescription:
      "เลือกการสนทนาจากรายการเพื่อดูข้อความและรายละเอียดลูกค้า",
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
    details: "รายละเอียด",
    hideDetails: "ซ่อนรายละเอียด",

    purchased: "ซื้อแล้ว",
    customerSalesInformation: "ข้อมูลการขาย (CRM)",
    productsInterested: "สินค้าที่สนใจ",
    productsPurchased: "สินค้าที่ซื้อ",
    productInsight: "ข้อมูลสินค้า",
    customerPurchase: "ข้อมูลการขายของลูกค้า",
    purchaseChannel: "ช่องทางการซื้อ",
    paymentMethod: "วิธีชำระเงิน",
    recordedBy: "บันทึกโดย",
    recordedAt: "บันทึกเมื่อ",
    purchaseInformationUpdated: "อัปเดตข้อมูลการซื้อแล้ว",
    aiInsight: "ข้อมูลเชิงลึกจาก AI",
    mentionedProduct: "สินค้าที่กล่าวถึง",
    noPurchaseInformation: "ยังไม่มีข้อมูลการซื้อที่ยืนยัน",
    legacyPurchaseInformation: "ข้อมูลเดิมที่บันทึกแบบแมนนวล — ยังไม่ยืนยัน",
    noInsightAvailable: "ยังไม่มีข้อมูลเชิงลึก",
    editPurchaseInformation: "แก้ไขข้อมูลการซื้อ",
    productCategory: "ประเภทสินค้า",
    productSeries: "กลุ่มผลิตภัณฑ์",
    productModel: "รุ่นสินค้า",
    variant: "ตัวเลือกสินค้า",
    noMatchingProducts: "ไม่พบสินค้าที่ตรงกัน",
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
    syncMasterFile: "↻ Sync Store Master",
    syncingMasterFile: "Syncing Store Master...",
    syncMasterSuccess: "Sync Store Master สำเร็จ",
    syncMasterFailed: "Sync Store Master ไม่สำเร็จ",
    syncSummaryTitle: "ผลการ Sync Store Master",
    syncTotalRows: "ทั้งหมด (Total)",
    syncCompleteRows: "สมบูรณ์ (Complete)",
    syncIncompleteRows: "ไม่สมบูรณ์ (Incomplete)",
    syncOaUpdated: "อัปเดต LINE OA แล้ว (Updated)",
    syncOaUnchanged: "LINE OA ไม่เปลี่ยนแปลง (Unchanged)",
    missingStoreId: "ไม่มี Store ID",
    duplicateAccountNames: "ชื่อ Account ซ้ำ",
    duplicateLineIds: "LINE ID ซ้ำ",
    missingGoogleMapsUrls: "ไม่มี Google Maps URL",
    invalidGoogleMapsUrls: "Google Maps URL ไม่ถูกต้อง",
    dismiss: "ปิด",
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
    openGoogleMaps: "เปิด Google Maps",
    googleMapsNotConfigured: "ยังไม่ได้ตั้งค่า",
    googleMapsUrlLabel: "Google Maps",
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
    selectConversationTitle: "Select a conversation",
    selectConversationDescription:
      "Choose a conversation from the list to view messages and customer details.",
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
    details: "Details",
    hideDetails: "Hide Details",

    purchased: "Purchased",
    customerSalesInformation: "Customer Sales Information",
    productsInterested: "Interested Products",
    productsPurchased: "Purchased Products",
    productInsight: "Product Insight",
    customerPurchase: "Customer Sales Information",
    purchaseChannel: "Purchase Channel",
    paymentMethod: "Payment Method",
    recordedBy: "Recorded by",
    recordedAt: "Recorded at",
    purchaseInformationUpdated: "Purchase information updated",
    aiInsight: "AI Insight",
    mentionedProduct: "Mentioned Product",
    noPurchaseInformation: "No verified purchase information",
    legacyPurchaseInformation: "Legacy manual record — not verified",
    noInsightAvailable: "No additional insight available",
    editPurchaseInformation: "Edit Purchase Information",
    productCategory: "Product Category",
    productSeries: "Product Series",
    productModel: "Product Model",
    variant: "Variant",
    noMatchingProducts: "No matching product",
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
    syncMasterFile: "↻ Sync Store Master",
    syncingMasterFile: "Syncing Store Master...",
    syncMasterSuccess: "Store Master sync succeeded",
    syncMasterFailed: "Store Master sync failed",
    syncSummaryTitle: "Store Master Sync Summary",
    syncTotalRows: "Total Rows",
    syncCompleteRows: "Complete",
    syncIncompleteRows: "Incomplete",
    syncOaUpdated: "Updated",
    syncOaUnchanged: "Unchanged",
    missingStoreId: "Missing Store ID",
    duplicateAccountNames: "Duplicate Account Names",
    duplicateLineIds: "Duplicate LINE IDs",
    missingGoogleMapsUrls: "Missing Google Maps URLs",
    invalidGoogleMapsUrls: "Invalid Google Maps URLs",
    dismiss: "Dismiss",
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
    openGoogleMaps: "Open Google Maps",
    googleMapsNotConfigured: "Not configured",
    googleMapsUrlLabel: "Google Maps",
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
    selectConversationTitle: "选择对话",
    selectConversationDescription:
      "从列表中选择一个对话以查看消息和客户详情。",
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
    details: "详情",
    hideDetails: "隐藏详情",

    purchased: "已购买",
    customerSalesInformation: "客户销售信息",
    productsInterested: "意向商品",
    productsPurchased: "已购商品",
    productInsight: "产品信息",
    customerPurchase: "客户销售信息",
    purchaseChannel: "购买渠道",
    paymentMethod: "支付方式",
    recordedBy: "记录人",
    recordedAt: "记录时间",
    purchaseInformationUpdated: "购买信息已更新",
    aiInsight: "AI 洞察",
    mentionedProduct: "提及的产品",
    noPurchaseInformation: "暂无已验证的购买信息",
    legacyPurchaseInformation: "历史手动记录 — 尚未验证",
    noInsightAvailable: "暂无更多洞察",
    editPurchaseInformation: "编辑购买信息",
    productCategory: "产品类别",
    productSeries: "产品系列",
    productModel: "产品型号",
    variant: "规格",
    noMatchingProducts: "没有匹配的产品",
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
    syncMasterFile: "↻ 同步 Store Master",
    syncingMasterFile: "正在同步 Store Master...",
    syncMasterSuccess: "Store Master 同步成功",
    syncMasterFailed: "Store Master 同步失败",
    syncSummaryTitle: "Store Master 同步结果摘要",
    syncTotalRows: "总行数 (Total)",
    syncCompleteRows: "完整 (Complete)",
    syncIncompleteRows: "不完整 (Incomplete)",
    syncOaUpdated: "已更新 (Updated)",
    syncOaUnchanged: "未变更 (Unchanged)",
    missingStoreId: "缺失 Store ID",
    duplicateAccountNames: "重复 Account Name",
    duplicateLineIds: "重复 LINE ID",
    missingGoogleMapsUrls: "缺失 Google Maps URL",
    invalidGoogleMapsUrls: "无效 Google Maps URL",
    dismiss: "关闭",
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
    openGoogleMaps: "打开 Google 地图",
    googleMapsNotConfigured: "未配置",
    googleMapsUrlLabel: "Google 地图",
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
    customerSalesInformation: item.customerSalesInformation,
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
  const steps = [
    { number: "01", title: "Connect your account", description: "Start a secure connection from the account authorization page." },
    { number: "02", title: "Authorize access", description: "Review the requested permissions and approve access to your social account." },
    { number: "03", title: "View your insights", description: "Explore profile, audience, and public content performance in one place." },
  ];

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f4f7f5] text-slate-950 dark:bg-[#07100c] dark:text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_15%_10%,rgba(22,163,74,0.18),transparent_36%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.14),transparent_32%)]" />

        <header className="relative z-10 border-b border-emerald-950/10 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#07100c]/75">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
            <Link href="/" aria-label="OPPO Retail Insights home" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm">O</span>
              <span className="text-sm font-semibold tracking-tight sm:text-base">OPPO Retail Insights</span>
            </Link>
            <Link href="/login" className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-600 hover:text-emerald-700 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-300">
              Administrator Sign in
            </Link>
          </div>
        </header>

        <section className="relative z-10 flex flex-1 items-center">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex rounded-full border border-emerald-600/20 bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">Social performance insights</p>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-6xl dark:text-white">Understand your social content performance.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 dark:text-slate-300">Connect your social account to view profile insights, audience statistics, and public content performance.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/tiktok/connect" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-700/15 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                  Connect Account
                </Link>
                <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white/75 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                  Administrator Sign in
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/80 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-200 pb-5 dark:border-white/10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">How it works</p>
                  <h2 className="mt-1 text-xl font-semibold">Three simple steps</h2>
                </div>
                <span aria-hidden="true" className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_7px_rgba(16,185,129,0.12)]" />
              </div>
              <ol className="mt-2 divide-y divide-slate-200 dark:divide-white/10">
                {steps.map((step) => (
                  <li key={step.number} className="grid grid-cols-[2.75rem_1fr] gap-4 py-5">
                    <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">{step.number}</span>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <footer className="relative z-10 border-t border-emerald-950/10 dark:border-white/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:text-slate-400">
            <p>© {new Date().getFullYear()} OPPO Retail Insights</p>
            <nav aria-label="Public policies" className="flex gap-5">
              <Link href="/privacy" className="transition hover:text-emerald-700 dark:hover:text-emerald-300">Privacy Policy</Link>
              <Link href="/terms" className="transition hover:text-emerald-700 dark:hover:text-emerald-300">Terms of Service</Link>
            </nav>
          </div>
        </footer>
    </main>
  );
}

export function ApplicationWorkspace({ initialSection }: { initialSection: PrimarySection }) {
  const { widths: chatPaneWidths, containerRef: chatContainerRef, resize: resizeChatPanes, reset: resetChatPanes } = useResizablePanes(initialSection === "chats");
  const [authUser, setAuthUser] = useState<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER"; permissions?: { canAccessMainOa?: boolean } } | null>(null);
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
  const [masterSyncResult, setMasterSyncResult] = useState<StoreMasterSyncResult | null>(null);
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
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
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
    conversationIds?: string[];
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
        [account.name, account.store.name, account.store.accountName, account.store.storeId, account.store.externalStoreId, account.store.code]
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
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void checkSetupStatus(), 0); return () => window.clearTimeout(timer); }, [checkSetupStatus]);

  useEffect(() => {
    if (!authChecked) return;
    const authState = getAuthState(authChecked, authUser);
    const destination = resolveAuthRedirect({
      authState,
      pathname: window.location.pathname,
      firstAdminRequired: Boolean(setupStatus?.firstAdminRequired),
    });
    if (destination && destination !== window.location.pathname) {
      window.location.replace(destination);
    }
  }, [authChecked, authUser, setupStatus?.firstAdminRequired]);

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
      let updatedCount = 0;
      if (bulkConfirmState.fromStatuses?.includes("NOT_REPLIED")) {
        const res = await api.bulkMarkRepliedByFilter({
          bmReplyStatus: "NOT_REPLIED",
          storeId: bulkConfirmState.storeId === "all" ? undefined : bulkConfirmState.storeId,
        });
        updatedCount = res.updatedCount;
      } else if (bulkConfirmState.conversationIds && bulkConfirmState.conversationIds.length > 0) {
        const res = await api.bulkMarkReplied(bulkConfirmState.conversationIds);
        updatedCount = res.updatedCount;
      } else {
        const res = await api.bulkUpdateBmReplyStatus({
          storeId: bulkConfirmState.storeId,
          status: bulkConfirmState.targetStatus,
          fromStatuses: bulkConfirmState.fromStatuses,
        });
        updatedCount = res.updated;
      }
      const count = updatedCount || bulkConfirmState.affectedCount;
      const successMsg =
        language === "th"
          ? `อัปเดต ${count} บทสนทนาเรียบร้อย`
          : language === "zh"
            ? `已成功更新 ${count} 条对话`
            : `Successfully updated ${count} conversations`;
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
      setMasterSyncResult(result);
      await loadApplicationData(true);
      setToastMessage(`${text.syncMasterSuccess} · Total: ${result.validation?.total ?? result.source?.rows} · Updated: ${result.connectedOaSync?.updated} · Unchanged: ${result.connectedOaSync?.unchanged}`);
    } catch (error) {
      setLineOaError(`${text.syncMasterFailed}: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setMasterSyncing(false);
    }
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
    try {
      const user = await api.login(loginEmail, loginPassword);
      setAuthUser(user);
      setLoginPassword("");
      if (typeof window !== "undefined" && window.location.pathname === "/login") {
        window.location.replace("/dashboard");
      }
    }
    catch (error) { setLoginError(error instanceof Error ? error.message : "Login failed"); }
    finally { setLoginLoading(false); }
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setAuthUser(null);
      setLoginPassword("");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
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
  if (!authUser) {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500"><div className="absolute right-6 top-6"><ThemeControl /></div>Redirecting to login…</main>;
    }
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><form onSubmit={(event) => void submitLogin(event)} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl"><h1 className="text-xl font-bold">OPPO LINE OA Monitor</h1><p className="mt-1 text-sm text-slate-500">Administrator sign in</p>{process.env.NODE_ENV !== "production" && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-800">{language === "th" ? "บัญชีทดสอบสำหรับเครื่อง Local เท่านั้น" : language === "zh" ? "仅限本地开发账户" : "Local development account only"}</p>}{loginError && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{loginError}</p>}<label className="mt-5 block text-sm">Username or email<input type="text" required autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><label className="mt-4 block text-sm">Password<input type="password" required autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label><button disabled={loginLoading} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{loginLoading ? "Signing in…" : "Sign in"}</button></form></main>;
  }

  if (typeof window !== "undefined" && window.location.pathname === "/login") {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500"><div className="absolute right-6 top-6"><ThemeControl /></div>Redirecting to dashboard…</main>;
  }

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
              <section className="col-span-2 overflow-y-auto p-6 bg-[var(--app-bg)] text-[var(--app-text-primary)]">
                <div className="mx-auto max-w-5xl">
                  <h2 className="text-2xl font-bold">{text.pilotChecklist}</h2>
                  <select
                    className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 text-sm text-[var(--app-text-primary)] focus:outline-none"
                    value={pilotChecklist?.oa.id ?? ""}
                    onChange={(event) => event.target.value && void loadPilotChecklist(event.target.value)}
                  >
                    <option value="">Select LINE OA</option>
                    {lineOas.map((oa) => <option key={oa.id} value={oa.id}>{oa.name}</option>)}
                  </select>
                  {pilotChecklist && (
                    <div className="mt-5 space-y-2">
                      {pilotChecklist.items.map((item, index) => (
                        <div key={item.itemKey} className="grid grid-cols-[1fr_160px_2fr] items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-xs">
                          <span className="text-sm font-medium">{index + 1}. {item.itemKey.replaceAll("_", " ")}</span>
                          <select
                            disabled={authUser.role !== "ADMIN"}
                            value={item.status}
                            onChange={(event) => void updatePilotItem(item.itemKey, event.target.value as typeof item.status, item.note ?? undefined)}
                            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2 text-sm text-[var(--app-text-primary)]"
                          >
                            <option value="NOT_TESTED">Not tested</option>
                            <option value="PASSED">Passed</option>
                            <option value="FAILED">Failed</option>
                            <option value="NOT_APPLICABLE">Not applicable</option>
                          </select>
                          <input
                            disabled={authUser.role !== "ADMIN"}
                            defaultValue={item.note ?? ""}
                            onBlur={(event) => void updatePilotItem(item.itemKey, item.status, event.target.value)}
                            placeholder="Test note"
                            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2 text-sm text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </PageContainer>
          ) : initialSection === "chats" && sidebarView === "systemStatus" ? (
            <PageContainer variant="full">
              <section className="col-span-2 overflow-y-auto p-6 bg-[var(--app-bg)] text-[var(--app-text-primary)]">
                <div className="mx-auto max-w-5xl space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">{text.systemStatus}</h2>
                    <button
                      onClick={() => void loadSystemStatus()}
                      className="rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--app-accent-hover)] transition-colors"
                    >
                      {text.refreshStatus}
                    </button>
                  </div>
                  {systemStatus ? (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        {Object.entries(systemStatus).map(([key, value]) => (
                          <div key={key} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-xs">
                            <p className="text-xs text-[var(--app-text-secondary)]">{key.replaceAll(/([A-Z])/g, " $1")}</p>
                            <p className="mt-2 font-semibold text-[var(--app-text-primary)]">
                              {typeof value === "boolean" ? value ? "Healthy" : "Not configured" : value ?? "Not configured"}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xs">
                        <h3 className="font-semibold text-[var(--app-text-primary)]">Recent operational errors</h3>
                        {operationalErrors.length ? (
                          <div className="mt-3 space-y-2">
                            {operationalErrors.map((error) => (
                              <div key={error.id} className="rounded-lg border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">
                                <strong>{error.feature}</strong> · {error.summary}
                                <span className="block text-xs text-[var(--app-text-tertiary)] mt-1">
                                  {new Date(error.createdAt).toLocaleString()} · {error.resolved ? "Resolved" : "Unresolved"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-[var(--app-text-secondary)]">No recent errors</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-[var(--app-text-secondary)]">{text.loadingData}</p>
                  )}
                </div>
              </section>
            </PageContainer>
          ) : initialSection === "stores" ? (
            <PageContainer variant="wide">
              <section className="app-content-section col-span-2 overflow-y-auto">
                <div className="mx-auto max-w-7xl space-y-6">
                  <PageHeader
                    tag="OPPO LINE OA · การจัดการระบบ"
                    title={text.lineOaManagement}
                    description={text.lineOaDescription}
                    actions={
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-[var(--app-text-secondary)] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showArchivedLineOas}
                            onChange={(event) => setShowArchivedLineOas(event.target.checked)}
                            className="rounded border-[var(--app-border)] accent-[var(--app-accent)]"
                          />
                          {text.showArchived}
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[var(--app-text-secondary)] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showArchivedStores}
                            onChange={(event) => setShowArchivedStores(event.target.checked)}
                            className="rounded border-[var(--app-border)] accent-[var(--app-accent)]"
                          />
                          {showArchivedStores ? text.hideArchivedStores : text.showArchived}
                        </label>
                        {authUser.role === "ADMIN" && (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={masterSyncing}
                              isLoading={masterSyncing}
                              onClick={() => void syncMasterFile()}
                              data-testid="sync-store-master-button"
                            >
                              {masterSyncing ? text.syncingMasterFile : text.syncMasterFile}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={lineOaExporting}
                              isLoading={lineOaExporting}
                              onClick={() => void exportLineOaCsv()}
                            >
                              {lineOaExporting ? text.exportingCsv : `↓ ${text.exportCsv}`}
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            resetLineOaForm();
                            setShowLineOaForm(true);
                          }}
                        >
                          ＋ {text.connectLineOa}
                        </Button>
                      </div>
                    }
                  />

                  <FilterBar
                    searchSlot={
                      <SearchInput
                        value={storeManagementSearch}
                        onChange={(event) => setStoreManagementSearch(event.target.value)}
                        onClear={() => setStoreManagementSearch("")}
                        placeholder={text.searchAccountName}
                      />
                    }
                    actionSlot={
                      <span className="text-xs text-[var(--app-text-tertiary)] font-tabular">
                        {visibleLineOas.length} / {lineOas.length} {text.lineOaManagement}
                      </span>
                    }
                  />

                  {showArchivedStores && (
                    <Card className="p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-tertiary)]">
                          {text.showArchived}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {availableStores.filter(({ archivedAt }) => Boolean(archivedAt)).map((store) => (
                          <div
                            key={store.id}
                            className="flex items-center justify-between rounded-[var(--app-radius-md)] border border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)] px-3.5 py-2 text-xs"
                          >
                            <span className="font-medium text-[var(--app-text-primary)]">{store.name}</span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void restoreStore(store.id)}
                            >
                              {text.restoreStore}
                            </Button>
                          </div>
                        ))}
                        {availableStores.every(({ archivedAt }) => !archivedAt) && (
                          <p className="app-muted text-xs">{text.noStoresFound}</p>
                        )}
                      </div>
                    </Card>
                  )}

                  {lineOaError && <ErrorState message={lineOaError} />}
                  {lineOaExportError && <ErrorState message={lineOaExportError} />}

                  {masterSyncResult && (
                    <Card className="p-4 sm:p-5 border-[var(--app-border)] bg-[var(--app-surface)] shadow-xs space-y-3" data-testid="store-master-sync-summary" data-store-master-sync-summary>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-success-soft)] text-[var(--app-success)] text-xs font-bold">✓</span>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-primary)]">
                            {text.syncSummaryTitle}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMasterSyncResult(null)}
                          className="text-xs text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] px-2 py-1 rounded cursor-pointer"
                          aria-label="Dismiss summary"
                          data-testid="dismiss-sync-summary"
                        >
                          ✕ {text.dismiss}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
                        <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-2.5 border border-[var(--app-border-subtle)]">
                          <p className="text-[10px] text-[var(--app-text-tertiary)] uppercase font-semibold">{text.syncTotalRows}</p>
                          <p className="mt-0.5 text-sm font-bold text-[var(--app-text-primary)]" data-testid="sync-total">{masterSyncResult.validation.total}</p>
                        </div>
                        <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-2.5 border border-[var(--app-border-subtle)]">
                          <p className="text-[10px] text-[var(--app-text-tertiary)] uppercase font-semibold">{text.syncCompleteRows}</p>
                          <p className="mt-0.5 text-sm font-bold text-[var(--app-success)]" data-testid="sync-complete">{masterSyncResult.validation.complete}</p>
                        </div>
                        <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-2.5 border border-[var(--app-border-subtle)]">
                          <p className="text-[10px] text-[var(--app-text-tertiary)] uppercase font-semibold">{text.syncIncompleteRows}</p>
                          <p className={`mt-0.5 text-sm font-bold ${masterSyncResult.validation.incomplete > 0 ? "text-[var(--app-warning)]" : "text-[var(--app-text-primary)]"}`} data-testid="sync-incomplete">{masterSyncResult.validation.incomplete}</p>
                        </div>
                        <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-2.5 border border-[var(--app-border-subtle)]">
                          <p className="text-[10px] text-[var(--app-text-tertiary)] uppercase font-semibold">{text.syncOaUpdated}</p>
                          <p className="mt-0.5 text-sm font-bold text-[var(--app-accent)]" data-testid="sync-updated">{masterSyncResult.connectedOaSync.updated}</p>
                        </div>
                        <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-2.5 border border-[var(--app-border-subtle)]">
                          <p className="text-[10px] text-[var(--app-text-tertiary)] uppercase font-semibold">{text.syncOaUnchanged}</p>
                          <p className="mt-0.5 text-sm font-bold text-[var(--app-text-secondary)]" data-testid="sync-unchanged">{masterSyncResult.connectedOaSync.unchanged}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs pt-2 border-t border-[var(--app-border-subtle)]">
                        <div>
                          <span className="text-[11px] text-[var(--app-text-secondary)]">{text.missingStoreId}: </span>
                          <span className="font-semibold" data-testid="sync-missing-store-id">{masterSyncResult.validation.missingStoreId}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--app-text-secondary)]">{text.duplicateAccountNames}: </span>
                          <span className="font-semibold" data-testid="sync-duplicate-account-names">{masterSyncResult.validation.duplicateAccountNames}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--app-text-secondary)]">{text.duplicateLineIds}: </span>
                          <span className="font-semibold" data-testid="sync-duplicate-line-ids">{masterSyncResult.validation.duplicateLineIds}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--app-text-secondary)]">{text.missingGoogleMapsUrls}: </span>
                          <span className="font-semibold" data-testid="sync-missing-maps-urls">{masterSyncResult.validation.missingGoogleMapsUrls}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--app-text-secondary)]">{text.invalidGoogleMapsUrls}: </span>
                          <span className="font-semibold" data-testid="sync-invalid-maps-urls">{masterSyncResult.validation.invalidGoogleMapsUrls}</span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {managementWebhookInfo && !managementWebhookInfo.webhookUrlConfigured && (
                    <Card className="border-[var(--app-warning)]/30 bg-[var(--app-warning-soft)] text-xs text-[#B25E00] dark:text-[#f6c65b]">
                      <h3 className="font-semibold text-sm">{text.publicWebhookSetupTitle}</h3>
                      <p className="mt-1 opacity-90">{text.publicWebhookRequired}</p>
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-medium opacity-80">{text.backendPortLabel}</dt>
                          <dd className="font-mono">{managementWebhookInfo.backendPort}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium opacity-80">{text.expectedWebhookPath}</dt>
                          <dd className="font-mono">{managementWebhookInfo.webhookPath}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-medium opacity-80">{text.tunnelExample}</dt>
                          <dd>
                            <code className="rounded bg-[var(--app-surface)]/80 px-2 py-1 font-mono text-xs border border-[var(--app-warning)]/20">
                              ngrok http {managementWebhookInfo.backendPort}
                            </code>
                          </dd>
                        </div>
                      </dl>
                      <ol className="mt-3 list-inside list-decimal space-y-1 opacity-90">
                        <li>{text.setWebhookEnvironment}</li>
                        <li>{text.restartBackend}</li>
                      </ol>
                    </Card>
                  )}

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <MetricCard
                      label={text.totalLineOa}
                      value={lineOas.length}
                    />
                    <MetricCard
                      label={text.activeLineOa}
                      value={lineOas.filter((item) => item.isActive).length}
                      tone="success"
                    />
                    <MetricCard
                      label={text.connectionIssues}
                      value={lineOas.filter((item) => item.connectionStatus === "ERROR" || item.connectionStatus === "NOT_CONFIGURED").length}
                      tone={lineOas.some((item) => item.connectionStatus === "ERROR" || item.connectionStatus === "NOT_CONFIGURED") ? "danger" : "default"}
                    />
                    <MetricCard
                      label={text.messagesToday}
                      value={lineOas.reduce((sum, item) => sum + item.messagesReceivedToday, 0)}
                      tone="accent"
                    />
                  </div>

                  <TableContainer>
                    {visibleLineOas.length === 0 ? (
                      <div className="p-16 text-center text-xs text-[var(--app-text-secondary)]">{text.noLineOa}</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <tr>
                            <TableHead>{text.lineOaManagement}</TableHead>
                            <TableHead>{text.stores}</TableHead>
                            <TableHead>{text.connectionStatus}</TableHead>
                            <TableHead>{text.webhookUrl}</TableHead>
                            <TableHead>{text.lastWebhook}</TableHead>
                            <TableHead align="center">{text.messagesToday}</TableHead>
                            <TableHead align="right">{text.action}</TableHead>
                          </tr>
                        </TableHeader>
                        <TableBody>
                          {visibleLineOas.map((account) => {
                            const statusVariant: BadgeVariant =
                              account.connectionStatus === "CONNECTED"
                                ? "success"
                                : account.connectionStatus === "READY"
                                ? "info"
                                : account.connectionStatus === "ERROR"
                                ? "danger"
                                : account.connectionStatus === "DISABLED"
                                ? "neutral"
                                : "warning";

                            return (
                              <TableRow key={account.id} className={!account.isActive ? "opacity-60" : ""}>
                                <TableCell>
                                  <span className="font-semibold text-[var(--app-text-primary)]">{account.name}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="block font-medium text-[var(--app-text-primary)]">
                                    {(account.store.storeId || account.store.externalStoreId) && (
                                      <span className="font-mono text-xs text-[var(--app-text-tertiary)] mr-1.5 opacity-80">
                                        [{account.store.storeId ?? account.store.externalStoreId}]
                                      </span>
                                    )}
                                    {getStoreDisplayName(account.store.name)}
                                  </span>
                                  {account.store.accountName && (
                                    <span className="block text-xs text-[var(--app-text-secondary)]">{account.store.accountName}</span>
                                  )}
                                  <span className="block text-xs text-[var(--app-text-tertiary)]">
                                    {[
                                      account.store.storeId ?? account.store.externalStoreId ? `Store ID: ${account.store.storeId ?? account.store.externalStoreId}` : null,
                                      account.store.province,
                                      account.store.region,
                                      account.store.lineId,
                                    ].filter(Boolean).join(" · ") || "—"}
                                  </span>
                                  <span className="mt-1 inline-block">
                                    <Badge size="sm" variant={account.store.dataSource === "MASTER" ? "success" : "neutral"} dot={account.store.dataSource === "MASTER"}>
                                      {account.store.dataSource === "MASTER" ? text.masterFile : text.dataSource}
                                    </Badge>
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge size="md" variant={statusVariant} dot>
                                    {connectionLabel(account.connectionStatus)}
                                  </Badge>
                                  <span className={`mt-1.5 block text-xs font-medium ${account.credentialsHealthy ? "text-[var(--app-success)]" : "text-[var(--app-danger)]"}`}>
                                    {account.credentialsHealthy ? text.credentialsReady : account.hasChannelSecret ? text.credentialDecryptionFailed : text.reenterChannelSecret}
                                  </span>
                                </TableCell>
                                <TableCell className="max-w-52">
                                  {webhookInfoById[account.id]?.webhookUrl ?? account.webhookUrl ? (
                                    <span className="block truncate font-mono text-xs text-[var(--app-text-secondary)]" title={webhookInfoById[account.id]?.webhookUrl ?? account.webhookUrl ?? undefined}>
                                      {webhookInfoById[account.id]?.webhookUrl ?? account.webhookUrl}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--app-danger)] text-xs font-medium" title={text.publicWebhookRequired}>
                                      {text.webhookNotConfigured}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-[var(--app-text-secondary)] font-tabular">
                                  {account.lastWebhookReceivedAt ? new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(new Date(account.lastWebhookReceivedAt)) : "—"}
                                </TableCell>
                                <TableCell align="center" numeric className="font-semibold text-xs">
                                  {account.messagesReceivedToday}
                                </TableCell>
                                <TableCell align="right">
                                  <div className="flex min-w-44 flex-wrap justify-end gap-1.5">
                                    <Button size="sm" variant="secondary" onClick={() => openMonitoring({ lineOaId: account.id })}>
                                      {text.viewConversations}
                                    </Button>
                                    {account.store.lineManagerUrl ? (
                                      <a
                                        href={account.store.lineManagerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center h-7 px-2.5 text-xs font-medium rounded-[var(--app-radius-sm)] border border-[var(--app-success)]/30 text-[var(--app-success)] hover:bg-[var(--app-success-soft)] transition-colors"
                                      >
                                        {text.openLineManager} ↗
                                      </a>
                                    ) : (
                                      <button disabled title={text.noMasterUrl} className="inline-flex items-center h-7 px-2.5 text-xs font-medium rounded-[var(--app-radius-sm)] border border-[var(--app-border)] text-[var(--app-text-disabled)] opacity-50 cursor-not-allowed">
                                        {text.openLineManager}
                                      </button>
                                    )}
                                    {account.store.lineOaLink ? (
                                      <a
                                        href={account.store.lineOaLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center h-7 px-2.5 text-xs font-medium rounded-[var(--app-radius-sm)] border border-[var(--app-success)]/30 text-[var(--app-success)] hover:bg-[var(--app-success-soft)] transition-colors"
                                      >
                                        {text.openLineOa} ↗
                                      </a>
                                    ) : (
                                      <button disabled title={text.noMasterUrl} className="inline-flex items-center h-7 px-2.5 text-xs font-medium rounded-[var(--app-radius-sm)] border border-[var(--app-border)] text-[var(--app-text-disabled)] opacity-50 cursor-not-allowed">
                                        {text.openLineOa}
                                      </button>
                                    )}
                                    {account.store.googleMapsUrl ? (
                                      <a
                                        href={account.store.googleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center h-7 px-2.5 text-xs font-medium rounded-[var(--app-radius-sm)] border border-[var(--app-accent)]/30 text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors"
                                      >
                                        {text.openGoogleMaps} ↗
                                      </a>
                                    ) : (
                                      <button disabled title={text.googleMapsNotConfigured} className="inline-flex items-center h-7 px-2.5 text-xs font-medium rounded-[var(--app-radius-sm)] border border-[var(--app-border)] text-[var(--app-text-disabled)] opacity-50 cursor-not-allowed">
                                        {text.googleMapsNotConfigured}
                                      </button>
                                    )}
                                    <Button size="sm" variant="secondary" disabled={lineOaSubmitting} onClick={() => void testLineOa(account)}>
                                      {text.testConnection}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      disabled={!webhookInfoById[account.id]?.webhookUrl && !account.webhookUrl}
                                      title={!webhookInfoById[account.id]?.webhookUrl && !account.webhookUrl ? text.publicWebhookRequired : undefined}
                                      onClick={() => void copyWebhookUrl(account.id, account.webhookUrl)}
                                    >
                                      {text.copyWebhook}
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => editLineOa(account)}>
                                      {text.edit}
                                    </Button>
                                    <Button size="sm" variant="secondary" disabled={lineOaSubmitting} onClick={() => void toggleLineOa(account)}>
                                      {account.isActive ? text.disable : text.activate}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      disabled={lineOaSubmitting}
                                      onClick={() => void regenerateWebhookUrl(account)}
                                      className="text-[var(--app-warning)] border-[var(--app-warning)]/30 hover:bg-[var(--app-warning-soft)]"
                                    >
                                      {text.regenerateWebhook}
                                    </Button>
                                    {account.archivedAt ? (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => void restoreLineOa(account)}
                                        className="text-[var(--app-success)] border-[var(--app-success)]/30 hover:bg-[var(--app-success-soft)]"
                                      >
                                        {text.restoreLineOa}
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="danger" onClick={() => void removeLineOa(account)}>
                                        {text.removeLineOa}
                                      </Button>
                                    )}
                                  </div>
                                  {connectionTest?.id === account.id && (
                                    <p className="mt-1.5 text-right text-xs text-[var(--app-text-secondary)]">
                                      {connectionTestMessage(connectionTest.result)}
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </TableContainer>

                  <Card className="border-[var(--app-info)]/20 bg-[var(--app-info-soft)] text-xs text-[#0062CC] dark:text-[#8ac5ff]">
                    <h3 className="font-semibold text-sm text-[var(--app-text-primary)]">{text.setupInstructions}</h3>
                    <ol className="mt-3 list-inside list-decimal space-y-1 opacity-90">
                      {text.setupSteps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  </Card>
                </div>

                {showLineOaForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-120">
                    <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--app-radius-xl)] bg-[var(--app-surface)] border border-[var(--app-border)] p-6 shadow-[var(--app-shadow-modal)] text-[var(--app-text-primary)]">
                      <div className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-4">
                        <h3 className="text-lg font-bold text-[var(--app-text-primary)] tracking-tight">
                          {editingLineOaId ? text.edit : text.connectLineOa}
                        </h3>
                        <IconButton size="sm" variant="ghost" aria-label="Close dialog" onClick={() => setShowLineOaForm(false)}>
                          ×
                        </IconButton>
                      </div>

                      {lineOaError && (
                        <p className="mt-4 rounded-[var(--app-radius-md)] bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)] border border-[var(--app-danger)]/20">
                          {lineOaError}
                        </p>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {!editingLineOaId && (
                          <div className="relative col-span-2">
                            <label className="text-xs font-medium text-[var(--app-text-secondary)]">
                              {text.searchAccountName}
                              <input
                                role="combobox"
                                aria-expanded={masterResults.length > 0}
                                aria-controls="store-master-results"
                                aria-activedescendant={masterActiveIndex >= 0 ? `master-result-${masterActiveIndex}` : undefined}
                                value={searchQuery}
                                onKeyDown={handleMasterSearchKey}
                                onChange={(event) => {
                                  const nextQuery = event.target.value;
                                  setSearchQuery(nextQuery);
                                  setSelectedMaster(null);
                                  setMasterSearchState({ status: "idle" });
                                  setMasterActiveIndex(-1);
                                  setLineOaForm(clearStoreMasterSelection);
                                }}
                                placeholder={text.selectStore}
                                className="app-input mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)]"
                              />
                            </label>
                            {masterSearchState.status === "loading" && <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{text.searchingStoreMaster}</p>}
                            {masterSearchState.status === "error" && (
                              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--app-danger)]">
                                <span>{masterSearchState.message}</span>
                                <button type="button" onClick={() => setMasterRetryNonce((value) => value + 1)} className="rounded border border-[var(--app-danger)]/30 px-2 py-0.5 font-medium">
                                  {text.retry}
                                </button>
                              </div>
                            )}
                            {masterSearchState.status === "success" && masterSearchState.query.length > 0 && masterSearchState.suggestions.length === 0 && (
                              <div className="app-muted mt-1 text-xs">
                                <p>{text.noMatchingAccount}</p>
                                <p>{text.manualFallbackHint}</p>
                              </div>
                            )}
                            {masterResults.length > 0 && (
                              <div id="store-master-results" role="listbox" className="app-surface absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-elevated)]">
                                {masterResults.length > 1 && <p className="border-b border-[var(--app-border-subtle)] bg-[var(--app-warning-soft)] px-3 py-2 text-xs text-[var(--app-warning)]">{text.multipleMatches}</p>}
                                {masterResults.map((item, index) => (
                                  <button
                                    id={`master-result-${index}`}
                                    role="option"
                                    aria-selected={index === masterActiveIndex}
                                    key={item.id}
                                    type="button"
                                    onMouseEnter={() => setMasterActiveIndex(index)}
                                    onClick={() => selectMasterRecord(item)}
                                    className={`app-list-item block w-full border-b border-[var(--app-border-subtle)] px-3.5 py-3 text-left last:border-0 hover:bg-[var(--app-surface-hover)] ${index === masterActiveIndex ? "is-selected bg-[var(--app-surface-active)]" : ""}`}
                                  >
                                    <strong className="block text-xs font-semibold text-[var(--app-text-primary)]">{item.accountName}</strong>
                                    <span className="app-muted block text-xs">{item.storeName}</span>
                                    <span className="app-muted mt-0.5 block text-[11px]">{[item.province, item.region, item.externalStoreId ? `${text.storeIdLabel} ${item.externalStoreId}` : null, item.lineId].filter(Boolean).join(" · ")}</span>
                                    {item.matchReason === "FUZZY_SUGGESTION" && <span className="mt-1 inline-block rounded-[var(--app-radius-sm)] bg-[var(--app-info-soft)] text-[var(--app-info)] border border-[var(--app-info)]/20 px-2 py-0.5 text-[10px]">{text.systemSuggested}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {selectedMaster && synchronizedMaster && (
                          <section className="store-master-sync-card col-span-2 p-4 text-xs rounded-[var(--app-radius-lg)]" aria-labelledby="store-master-sync-title">
                            <div className="flex items-center justify-between gap-3">
                              <h4 id="store-master-sync-title" className="font-semibold text-xs">{text.syncedStoreMasterTitle}</h4>
                              <span className="app-chip rounded-full px-2 py-0.5 text-[10px]">{text.masterFile}</span>
                            </div>
                            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-2">
                              <div><dt className="store-master-sync-label text-[11px]">{text.storeIdLabel}</dt><dd className="font-medium">{synchronizedMaster.storeId}</dd></div>
                              <div><dt className="store-master-sync-label text-[11px]">{text.storeName}</dt><dd className="font-medium">{synchronizedMaster.storeName}</dd></div>
                              <div><dt className="store-master-sync-label text-[11px]">{text.accountName}</dt><dd className="font-medium">{synchronizedMaster.accountName}</dd></div>
                              <div><dt className="store-master-sync-label text-[11px]">{text.lineIdLabel}</dt><dd className="font-medium">{synchronizedMaster.lineId}</dd></div>
                              <div><dt className="store-master-sync-label text-[11px]">{text.province}</dt><dd className="font-medium">{synchronizedMaster.province}</dd></div>
                              <div><dt className="store-master-sync-label text-[11px]">{text.region}</dt><dd className="font-medium">{synchronizedMaster.region}</dd></div>
                              <div><dt className="store-master-sync-label text-[11px]">{text.openLineOa}</dt><dd className="font-medium">{synchronizedMaster.lineOaLink ? <a className="store-master-sync-link" href={synchronizedMaster.lineOaLink} target="_blank" rel="noopener noreferrer">{synchronizedMaster.lineOaLink} ↗</a> : "-"}</dd></div>
                              <div><dt className="store-master-sync-label text-[11px]">{text.openLineManager}</dt><dd className="font-medium">{synchronizedMaster.lineManagerUrl ? <a className="store-master-sync-link" href={synchronizedMaster.lineManagerUrl} target="_blank" rel="noopener noreferrer">{synchronizedMaster.lineManagerUrl} ↗</a> : "-"}</dd></div>
                              <div><dt className="store-master-sync-label text-[11px]">{text.googleMapsUrlLabel}</dt><dd className="font-medium">{synchronizedMaster.googleMapsUrl ? <a className="store-master-sync-link" href={synchronizedMaster.googleMapsUrl} target="_blank" rel="noopener noreferrer">{synchronizedMaster.googleMapsUrl} ↗</a> : "-"}</dd></div>
                            </dl>
                            {selectedMaster.existingStore && <p className="mt-3 rounded-[var(--app-radius-sm)] bg-[var(--app-info-soft)] p-2 text-[var(--app-info)] border border-[var(--app-info)]/20">{text.storeAlreadyExists}: {selectedMaster.existingStore.name}</p>}
                            {selectedMaster.dataQualityStatus !== "COMPLETE" && <p className="mt-2 text-[var(--app-warning)]">{text.incompleteMasterData}</p>}
                          </section>
                        )}

                        <p className="col-span-2 rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/20 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">{text.rotateCredentialsWarning}</p>

                        <label className="col-span-2 text-xs font-medium text-[var(--app-text-secondary)]">{text.lineOaName} *<input value={lineOaForm.name} onChange={(event) => setLineOaForm((form) => ({ ...form, name: event.target.value }))} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)]" /></label>

                        <label className="text-xs font-medium text-[var(--app-text-secondary)]">
                          {text.channelSecret} {editingLineOaId ? "" : "*"}
                          <input type={showCredentials ? "text" : "password"} autoComplete="new-password" value={lineOaForm.channelSecret} onChange={(event) => setLineOaForm((form) => ({ ...form, channelSecret: event.target.value }))} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)]" />
                        </label>

                        <label className="text-xs font-medium text-[var(--app-text-secondary)]">
                          {text.accessToken} {editingLineOaId ? "" : "*"}
                          <input type={showCredentials ? "text" : "password"} autoComplete="new-password" value={lineOaForm.channelAccessToken} onChange={(event) => setLineOaForm((form) => ({ ...form, channelAccessToken: event.target.value }))} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)]" />
                        </label>

                        <button type="button" onClick={() => setShowCredentials((shown) => !shown)} className="col-span-2 text-left text-xs font-medium text-[var(--app-accent)] hover:underline">
                          {showCredentials ? text.hideSecret : text.showSecret}
                        </button>

                        <button type="button" onClick={() => setShowAdvancedLineOa((shown) => !shown)} className="col-span-2 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2 text-left text-xs font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]">
                          {showAdvancedLineOa ? "▾" : "▸"} {text.advancedSettings}
                        </button>

                        {showAdvancedLineOa && (
                          <>
                            <label className="col-span-2 text-xs font-medium text-[var(--app-text-secondary)]">
                              {text.stores}
                              <select value={lineOaForm.storeId ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, storeId: event.target.value || undefined }))} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)]">
                                <option value="">{text.autoCreateStore}</option>
                                {availableStores.map((store) => <option key={store.id} value={store.id}>{store.storeId ? `[${store.storeId}] ` : ""}{store.name}</option>)}
                              </select>
                            </label>
                            <label className="text-xs font-medium text-[var(--app-text-secondary)]">
                              {text.region}
                              <input disabled={Boolean(lineOaForm.storeId)} value={lineOaForm.newStore?.region ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, newStore: { name: form.name, ...form.newStore, region: event.target.value } }))} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)] disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)]" />
                            </label>
                            <label className="text-xs font-medium text-[var(--app-text-secondary)]">
                              {text.area}
                              <input disabled={Boolean(lineOaForm.storeId)} value={lineOaForm.newStore?.area ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, newStore: { name: form.name, ...form.newStore, area: event.target.value } }))} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)] disabled:bg-[var(--disabled-background)] disabled:text-[var(--disabled-foreground)]" />
                            </label>
                            <label className="text-xs font-medium text-[var(--app-text-secondary)]">
                              {text.basicId}
                              <input value={lineOaForm.basicId ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, basicId: event.target.value }))} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)]" />
                            </label>
                            <label className="text-xs font-medium text-[var(--app-text-secondary)]">
                              {text.channelId}
                              <input value={lineOaForm.channelId ?? ""} onChange={(event) => setLineOaForm((form) => ({ ...form, channelId: event.target.value }))} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2.5 text-xs text-[var(--app-text-primary)]" />
                            </label>
                            <label className="col-span-2 flex items-center gap-2 text-xs font-medium text-[var(--app-text-secondary)] cursor-pointer select-none">
                              <input type="checkbox" checked={lineOaForm.isActive} onChange={(event) => setLineOaForm((form) => ({ ...form, isActive: event.target.checked }))} className="rounded border-[var(--app-border)] accent-[var(--app-accent)]" />
                              {text.activeStatus}
                            </label>
                          </>
                        )}
                      </div>

                      <div className="mt-6 flex justify-end gap-2.5 border-t border-[var(--app-border-subtle)] pt-4">
                        <Button size="md" variant="secondary" onClick={() => setShowLineOaForm(false)}>
                          {text.cancel}
                        </Button>
                        <Button size="md" variant="primary" disabled={lineOaSubmitting} isLoading={lineOaSubmitting} onClick={() => void submitLineOa()}>
                          {lineOaSubmitting ? text.loadingData : text.saveConnection}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {createdLineOa && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-120">
                    <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-[var(--app-radius-xl)] bg-[var(--app-surface)] border border-[var(--app-border)] p-6 sm:p-7 shadow-[var(--app-shadow-modal)] text-[var(--app-text-primary)]">
                      <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-success)]/30 bg-[var(--app-success-soft)] p-5">
                        <h3 className="text-lg font-bold text-[var(--app-success)] flex items-center gap-2">
                          <span>✓</span> {text.lineOaAdded}
                        </h3>
                        <p className="mt-1.5 text-xs opacity-90 text-[var(--app-text-primary)]">{text.pasteWebhookInstruction}</p>
                      </div>

                      <div className="mt-4 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
                        <p className="break-all font-mono text-xs text-[var(--app-text-primary)]">{createdLineOa.webhookUrl}</p>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => void copyWebhookUrl(createdLineOa.account.id, createdLineOa.webhookUrl)}
                          className="mt-3"
                        >
                          {text.copyWebhook}
                        </Button>
                      </div>

                      {/* Automatic Background Backfill Status */}
                      <div className="mt-4 rounded-[var(--app-radius-lg)] border border-[var(--app-info)]/30 bg-[var(--app-info-soft)] p-4 text-[var(--app-text-primary)]">
                        <h4 className="font-semibold text-xs text-[var(--app-info)] flex items-center gap-2">
                          <svg className="h-3.5 w-3.5 animate-spin text-[var(--app-info)]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {followerInsightsTranslations[language]?.backfillStatusQueued || "Connected successfully. Historical follower data is being fetched."}
                        </h4>

                        {backfillJob ? (
                          <div className="mt-2 text-xs space-y-1">
                            <p className="font-medium text-[var(--app-text-primary)]">
                              {backfillJob.status === "COMPLETED"
                                ? followerInsightsTranslations[language]?.backfillStatusCompleted
                                : backfillJob.status === "COMPLETED_WITH_ERRORS"
                                  ? followerInsightsTranslations[language]?.backfillStatusPartial
                                  : backfillJob.status === "FAILED"
                                    ? followerInsightsTranslations[language]?.backfillStatusFailed
                                    : followerInsightsTranslations[language]?.backfillStatusQueued}
                            </p>
                            <p className="text-[var(--app-text-tertiary)] font-mono text-[11px]">
                              Range: {backfillJob.dateFrom} ~ {backfillJob.dateTo} | Days: {backfillJob.totalDays} | Succeeded: {backfillJob.succeeded} | Skipped: {backfillJob.skipped} | Failed: {backfillJob.failed}
                            </p>
                            {backfillResult && (
                              <p className="mt-1 text-xs font-semibold text-[var(--app-success)]">
                                ✓ {backfillResult.succeeded ?? 0} dates updated.
                              </p>
                            )}
                            {(backfillJob.status === "FAILED" || backfillJob.status === "COMPLETED_WITH_ERRORS") && (
                              <button
                                type="button"
                                onClick={() => {
                                  void api.followerInsightsRetryJob(createdLineOa.account.id);
                                }}
                                className="mt-2 rounded-[var(--app-radius-sm)] bg-[var(--app-danger)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                              >
                                {followerInsightsTranslations[language]?.backfillStatusFailed || "Historical backfill failed. Click to retry."}
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                            {followerInsightsTranslations[language]?.backfillStatusQueued}
                          </p>
                        )}
                      </div>

                      <ol className="mt-4 list-inside list-decimal space-y-1 text-xs text-[var(--app-text-secondary)]">
                        {text.setupSteps.slice(1, 8).map((step) => <li key={step}>{step}</li>)}
                      </ol>

                      <div className="mt-6 flex justify-end gap-2.5 border-t border-[var(--app-border-subtle)] pt-4">
                        <Button size="md" variant="secondary" onClick={() => setCreatedLineOa(null)}>
                          {text.close}
                        </Button>
                        <Button size="md" variant="primary" onClick={() => setCreatedLineOa(null)}>
                          {text.goToLineOaManagement}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Backfill Confirmation Dialog */}
                {backfillModalOpen && createdLineOa && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-120">
                    <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-[var(--app-radius-xl)] bg-[var(--app-surface)] border border-[var(--app-border)] p-6 shadow-[var(--app-shadow-modal)] text-[var(--app-text-primary)]">
                      <h3 className="text-base font-bold text-[var(--app-text-primary)]">
                        {language === "th" ? "ดึงข้อมูลประวัติผู้ติดตามย้อนหลัง" : language === "zh" ? "补全历史关注者数据" : "Backfill historical follower data"}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-[var(--app-text-secondary)]">
                        {createdLineOa.account.name}
                      </p>

                      <div className="mt-4 space-y-3 text-xs">
                        <div>
                          <label className="font-medium text-[var(--app-text-secondary)]">
                            {language === "th" ? "วันเริ่มต้น" : language === "zh" ? "开始日期" : "Start Date"}
                          </label>
                          <input
                            type="date"
                            value={backfillDateFrom}
                            onChange={(e) => setBackfillDateFrom(e.target.value)}
                            className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2 text-xs text-[var(--app-text-primary)]"
                          />
                        </div>
                        <div>
                          <label className="font-medium text-[var(--app-text-secondary)]">
                            {language === "th" ? "วันสิ้นสุด" : language === "zh" ? "结束日期" : "End Date"}
                          </label>
                          <input
                            type="date"
                            value={backfillDateTo}
                            onChange={(e) => setBackfillDateTo(e.target.value)}
                            className="mt-1 w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--input-background)] p-2 text-xs text-[var(--app-text-primary)]"
                          />
                        </div>

                        <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-3 text-[var(--app-text-secondary)] font-medium">
                          {language === "th"
                            ? `ประมาณการเรียก LINE API: ${getInclusiveCalendarDays(backfillDateFrom, backfillDateTo)} วัน สำหรับบัญชี ${createdLineOa.account.name}`
                            : language === "zh"
                              ? `预估 LINE API 调用：账号 ${createdLineOa.account.name} 共 ${getInclusiveCalendarDays(backfillDateFrom, backfillDateTo)} 天`
                              : `Estimated LINE API calls: ${getInclusiveCalendarDays(backfillDateFrom, backfillDateTo)} dates for account ${createdLineOa.account.name}`}
                        </div>

                        {backfillError && (
                          <div className="rounded-[var(--app-radius-md)] bg-[var(--app-danger-soft)] p-2.5 text-xs text-[var(--app-danger)] border border-[var(--app-danger)]/20">
                            {backfillError}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex justify-end gap-2.5 border-t border-[var(--app-border-subtle)] pt-4">
                        <Button
                          type="button"
                          size="md"
                          variant="secondary"
                          disabled={backfillLoading}
                          onClick={() => setBackfillModalOpen(false)}
                        >
                          {language === "th" ? "ยกเลิก" : language === "zh" ? "取消" : "Cancel"}
                        </Button>
                        <Button
                          type="button"
                          size="md"
                          variant="primary"
                          disabled={backfillLoading}
                          isLoading={backfillLoading}
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
                        >
                          {backfillLoading
                            ? (language === "th" ? "กำลังดึงข้อมูล..." : "Backfilling...")
                            : (language === "th" ? "ยืนยันการดึงข้อมูลย้อนหลัง" : language === "zh" ? "确认补全历史数据" : "Confirm Historical Backfill")}
                        </Button>
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
          ) : initialSection === "friend-source-links" ? (
            <PageContainer variant="readable">
              <FriendSourceLinksView language={language} userRole={authUser.role} />
            </PageContainer>
          ) : initialSection === "mass-messages" ? (
            <PageContainer variant="full">
              <MassMessagesView language={language} userRole={authUser.role} />
            </PageContainer>
          ) : (
            <>
              <section data-chat-pane="conversations" className="app-surface min-w-0 min-h-0 flex flex-col h-full overflow-hidden border-r border-[var(--app-border)] bg-[var(--app-surface)]">
                <div className="border-b border-[var(--app-border)] p-3.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 data-chat-list-title className="text-sm font-bold text-[var(--app-text-primary)]">
                        {conversationListTitle}
                      </h2>
                      <p className="app-muted mt-0.5 text-xs text-[var(--app-text-tertiary)] font-tabular font-mono">
                        {chatTotalCount} {text.searchResults}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {sidebarView === "notReplied" && authUser?.role !== "VIEWER" && (chatTotalCount > 0 || conversations.length > 0) && (
                        <button
                          type="button"
                          data-bulk-mark-all-replied-button
                          onClick={() => {
                            const storeObj = selectedStore !== "all" ? availableStores.find((s) => s.id === selectedStore) : undefined;
                            const sName = storeObj
                              ? getStoreDisplayName(storeObj.name)
                              : (language === "th" ? "ทุกสาขา" : language === "zh" ? "所有门店" : "All Stores");
                            const unrepliedCount = selectedStore !== "all"
                              ? (storeBmCounts[selectedStore]?.notReplied ?? chatTotalCount)
                              : (bmSummaryData?.overview?.notReplied ?? chatTotalCount);
                            const targetCount = unrepliedCount > 0 ? unrepliedCount : (chatTotalCount || conversations.length);
                            const targetIds = conversations.map((c) => c.id);

                            setBulkConfirmState({
                              storeId: selectedStore,
                              storeName: sName,
                              targetStatus: "REPLIED",
                              fromStatuses: ["NOT_REPLIED"],
                              affectedCount: targetCount,
                              conversationIds: targetIds.length > 0 ? targetIds : undefined,
                            });
                          }}
                          className="rounded-[var(--app-radius-sm)] bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-[var(--app-shadow-card)] transition-colors cursor-pointer"
                          title={language === "th" ? "เปลี่ยนสถานะเป็นตอบแล้วทั้งหมด" : language === "zh" ? "全部标记为已回复" : "Mark all as replied"}
                        >
                          <span>✓</span>
                          <span>
                            {language === "th"
                              ? "ตอบแล้วทั้งหมด"
                              : language === "zh"
                                ? "全部标记为已回复"
                                : "Mark All Replied"}
                          </span>
                        </button>
                      )}
                      <button
                        data-chat-filter-button
                        onClick={() => setShowFilterPanel((isOpen) => !isOpen)}
                        aria-expanded={showFilterPanel}
                        className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] px-2.5 py-1 text-xs font-medium transition-colors"
                      >
                        {text.moreFilters}
                      </button>
                      <StoreChatsOverflowMenu language={language} resetPaneSizes={resetChatPanes} />
                    </div>
                  </div>

                  {showFilterPanel && (
                    <div className="app-filter-panel mt-3 grid grid-cols-2 gap-2 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-2.5 shadow-[var(--app-shadow-card)]">
                      <label className="text-[var(--app-text-secondary)] text-xs font-medium">
                        {text.storeFilter}
                        <select value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)} className="mt-1 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none">
                          <option value="all">{text.allStores}</option>
                          {storeOptions.map((storeId) => <option key={storeId} value={storeId}>{getStoreDisplayName(availableStores.find(({ id }) => id === storeId)?.name ?? storeId)}</option>)}
                        </select>
                      </label>
                      <label className="text-[var(--app-text-secondary)] text-xs font-medium">
                        {text.statusFilter}
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="mt-1 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none">
                          <option value="all">{text.allStatuses}</option>
                          {statusOptions.map((status) => <option key={status} value={status}>{getStatusLabel(language, status)}</option>)}
                        </select>
                      </label>
                      <label className="text-[var(--app-text-secondary)] text-xs font-medium">
                        {text.priorityFilter}
                        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)} className="mt-1 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none">
                          <option value="all">{text.allPriorities}</option>
                          {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority === "High" ? text.highPriority : text.normalPriority}</option>)}
                        </select>
                      </label>
                      <label className="text-[var(--app-text-secondary)] text-xs font-medium">
                        {text.seriesFilter}
                        <select value={seriesFilter} onChange={(event) => setSeriesFilter(event.target.value)} className="mt-1 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none">
                          <option value="all">{text.allSeries}</option>
                          {seriesOptions.map((series) => <option key={series} value={series}>{series}</option>)}
                        </select>
                      </label>
                      <label className="text-[var(--app-text-secondary)] col-span-2 text-xs font-medium">
                        {text.modelFilter}
                        <select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} className="mt-1 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none">
                          <option value="all">{text.allModels}</option>
                          {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                        </select>
                      </label>
                      <label className="text-[var(--app-text-secondary)] col-span-2 text-xs font-medium">
                        {text.topicFilter}
                        <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="mt-1 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none">
                          <option value="all">{text.allTopics}</option>
                          {topicOptions.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                        </select>
                      </label>
                      <label className="text-[var(--app-text-secondary)] col-span-2 text-xs font-medium">
                        {text.lineOaManagement}
                        <select value={lineOaFilter} onChange={(event) => setLineOaFilter(event.target.value)} className="mt-1 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none">
                          <option value="all">{text.allLineOa}</option>
                          {lineOas.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                      </label>
                    </div>
                  )}

                  {hasActiveFilters && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {searchText.trim() && <button onClick={() => setSearchText("")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.searchFilter}: {searchText.trim()} ×</button>}
                      {selectedStore !== "all" && <button onClick={() => setSelectedStore("all")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.storeFilter}: {getStoreDisplayName(availableStores.find(({ id }) => id === selectedStore)?.name ?? selectedStore)} ×</button>}
                      {statusFilter !== "all" && <button onClick={() => setStatusFilter("all")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.statusFilter}: {getStatusLabel(language, statusFilter)} ×</button>}
                      {priorityFilter !== "all" && <button onClick={() => setPriorityFilter("all")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.priorityFilter}: {priorityFilter === "High" ? text.highPriority : text.normalPriority} ×</button>}
                      {seriesFilter !== "all" && <button onClick={() => setSeriesFilter("all")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.seriesFilter}: {seriesFilter} ×</button>}
                      {modelFilter !== "all" && <button onClick={() => setModelFilter("all")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.modelFilter}: {modelFilter} ×</button>}
                      {topicFilter !== "all" && <button onClick={() => setTopicFilter("all")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.topicFilter}: {topicFilter} ×</button>}
                      {lineOaFilter !== "all" && <button onClick={() => setLineOaFilter("all")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.lineOaManagement}: {lineOas.find(({ id }) => id === lineOaFilter)?.name ?? lineOaFilter} ×</button>}
                      {(sidebarView === "notifiedBm" || sidebarView === "replied" || sidebarView === "notReplied") && <button onClick={() => setSidebarView("all")} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] px-2 py-0.5 text-[11px] font-medium">{text.bmReplyStatus}: {bmReplyStatusLabels[language][sidebarView === "notifiedBm" ? "NOTIFIED_BM" : sidebarView === "replied" ? "REPLIED" : "NOT_REPLIED"]} ×</button>}
                      <button onClick={clearAllFilters} className="text-[11px] font-medium text-[var(--app-danger)] hover:underline">{text.clearAll}</button>
                    </div>
                  )}
                </div>

                {bulkSuccessToast && (
                  <div className="bg-[var(--app-success-soft)] border-b border-[var(--app-border)] px-4 py-2 flex items-center justify-between text-xs text-[var(--app-text-primary)] shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--app-success)]">✓</span>
                      <span>{bulkSuccessToast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkSuccessToast(null)}
                      className="text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] font-bold ml-2"
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
                      const currentBmReplyStatus = conversationStates[conversation.id]?.bmReplyStatus ?? conversation.bmReplyStatus;
                      const tags = getConversationListTags(conversation.customerSalesInformation);
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
                          className={`conversation-list-row app-list-item relative w-full border-b border-[var(--app-border-subtle)] px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)]/40 cursor-pointer ${isSelected ? "is-selected" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <p data-conversation-customer className="truncate text-sm font-bold leading-5 tracking-tight flex-1 min-w-0 text-[var(--app-text-primary)]">{conversation.customer}</p>

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
                                className="p-1 rounded-[var(--app-radius-sm)] text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)] transition-colors"
                                title={language === "th" ? "เปลี่ยนสถานะ" : language === "zh" ? "更改状态" : "Change Status"}
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
                              </button>

                              {openConversationDropdownId === conversation.id && (
                                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[var(--app-shadow-dropdown)] text-xs backdrop-blur-md">
                                  <div className="px-2 py-1 text-[10px] font-semibold text-[var(--app-text-tertiary)] uppercase tracking-wider">
                                    {language === "th" ? "สถานะการตอบ" : language === "zh" ? "回复状态" : "Status"}
                                  </div>
                                  <div className="my-1 border-t border-[var(--app-border-subtle)]" />

                                  <button
                                    type="button"
                                    disabled={authUser?.role === "VIEWER"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenConversationDropdownId(null);
                                      void updateConversationBmReplyStatus(conversation.id, "NOT_REPLIED");
                                    }}
                                    className={`w-full flex items-center gap-2 rounded-[var(--app-radius-sm)] px-2.5 py-1.5 text-left font-medium transition-colors ${
                                      currentBmReplyStatus === "NOT_REPLIED"
                                        ? "bg-[var(--app-surface-subtle)] text-[var(--app-text-primary)] font-semibold"
                                        : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-subtle)] hover:text-[var(--app-text-primary)]"
                                    }`}
                                  >
                                    <span className="text-[var(--app-text-tertiary)] text-xs">⚪</span>
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
                                    className={`w-full flex items-center gap-2 rounded-[var(--app-radius-sm)] px-2.5 py-1.5 text-left font-medium transition-colors ${
                                      currentBmReplyStatus === "NOTIFIED_BM"
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
                                    className={`w-full flex items-center gap-2 rounded-[var(--app-radius-sm)] px-2.5 py-1.5 text-left font-medium transition-colors ${
                                      currentBmReplyStatus === "REPLIED"
                                        ? "bg-[var(--app-success-soft)] text-[var(--app-success)] font-semibold"
                                        : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-subtle)] hover:text-[var(--app-text-primary)]"
                                    }`}
                                  >
                                    <span className="text-xs">🟢</span>
                                    <span>{bmReplyStatusLabels[language]["REPLIED"]}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <p data-conversation-message-preview className="conversation-message-preview mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--app-text-secondary)] break-words">
                            {conversation.translations[language]}
                          </p>

                          <div data-conversation-metadata className="app-muted mt-2 flex items-center gap-1.5 text-[11px] font-tabular text-[var(--app-text-tertiary)] font-mono">
                            <span className="min-w-0 truncate font-medium text-[var(--app-text-secondary)]">{conversation.store}</span>
                            <span aria-hidden="true" className="opacity-50">·</span>
                            <span className="shrink-0 whitespace-nowrap">{formatRelativeTime(conversation.time, language)}</span>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1 font-tabular" title={allTagLabels || undefined} aria-label={allTagLabels || undefined}>
                            <span
                              data-conversation-bm-reply-status={currentBmReplyStatus}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                currentBmReplyStatus === "REPLIED"
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
                                data-conversation-bm-tag={tag.kind}
                                className={`rounded-full px-2 py-0.5 text-[10px] ${getBmTagChipClass(tag)}`}
                              >
                                {tag.label}
                              </span>
                            ))}
                            {tags.hidden.length > 0 && (
                              <span className="app-chip rounded-full px-1.5 py-0.5 text-[10px] bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)] border border-[var(--app-border)] font-mono" aria-label={tags.hidden.map(({ label }) => label).join(", ")}>
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
                    <header data-chat-detail-header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {selectedApiConversation?.customer.pictureUrl
                          ? <div role="img" aria-label={selectedApiConversation.customer.displayName} style={{ backgroundImage: `url(${selectedApiConversation.customer.pictureUrl})` }} className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center ring-1 ring-[var(--app-border)] shadow-[var(--app-shadow-card)]" />
                          : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] font-bold text-xs text-[var(--app-accent)] shadow-[var(--app-shadow-card)]">{(selectedApiConversation?.customer.displayName ?? selectedConversation.customer).slice(0, 2).toUpperCase()}</div>
                        }
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <h2 data-chat-detail-customer className="truncate text-base font-bold tracking-tight text-[var(--app-text-primary)]">
                              {selectedApiConversation?.customer.displayName ?? selectedConversation.customer}
                            </h2>
                            <span className="shrink-0 text-xs font-medium text-[var(--app-text-secondary)]">{selectedConversation.store}</span>
                            {selectedApiConversation?.customer.profileFetchStatus !== "SUCCESS" && <span className="shrink-0 text-xs text-[var(--app-warning)]">{text.profileUnavailable}</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-tabular">
                            {getBmCustomerSalesTags(selectedApiConversation?.customerSalesInformation ?? selectedConversation.customerSalesInformation).map((tag, index) => (
                              <span
                                key={`detail-bm-tag-${tag.kind}-${tag.label}-${index}`}
                                data-chat-detail-bm-tag={tag.kind}
                                className={`rounded-[var(--app-radius-sm)] px-1.5 py-0.5 text-[10px] ${getBmTagChipClass(tag)}`}
                              >
                                {tag.label}
                              </span>
                            ))}
                            <select
                              data-bm-reply-status-select
                              aria-label={text.bmReplyStatus}
                              disabled={isMutating || authUser?.role === "VIEWER"}
                              value={selectedConversationState.bmReplyStatus}
                              onChange={(e) => void updateBmReplyStatus(e.target.value as ApiBmReplyStatus)}
                              className={`rounded-[var(--app-radius-sm)] border border-[var(--app-border)] px-1.5 py-0.5 text-[10px] font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60 ${
                                selectedConversationState.bmReplyStatus === "REPLIED"
                                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                                  : selectedConversationState.bmReplyStatus === "NOTIFIED_BM"
                                    ? "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200"
                                    : "bg-[var(--app-surface)] text-[var(--app-text-primary)]"
                              }`}
                            >
                              <option value="NOT_REPLIED">{bmReplyStatusLabels[language].NOT_REPLIED}</option>
                              <option value="NOTIFIED_BM">{bmReplyStatusLabels[language].NOTIFIED_BM}</option>
                              <option value="REPLIED">{bmReplyStatusLabels[language].REPLIED}</option>
                            </select>
                            <span className="app-muted text-[10px] text-[var(--app-text-tertiary)] font-mono">{formatRelativeTime(selectedConversation.time, language)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          data-chat-detail-secondary-action
                          disabled={chatLoading}
                          onClick={() => void refreshProfile()}
                          title={text.refreshLineProfile}
                          className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)]"
                        >
                          ↻
                        </button>
                        <button
                          type="button"
                          data-chat-details-toggle
                          onClick={() => setShowDetailsDrawer((v) => !v)}
                          aria-expanded={showDetailsDrawer}
                          className={`rounded-[var(--app-radius-sm)] border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)] ${
                            showDetailsDrawer
                              ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-accent)]/30 font-semibold"
                              : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-subtle)] hover:text-[var(--app-text-primary)]"
                          }`}
                          title={showDetailsDrawer ? text.hideDetails : text.details}
                        >
                          {text.details}
                        </button>
                        <button
                          data-chat-detail-primary-action
                          type="button"
                          onClick={() => void openSelectedConversationInLineOa()}
                          className="app-button-primary inline-flex shrink-0 items-center gap-1.5 rounded-[var(--app-radius-sm)] bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white px-3 py-1.5 text-xs font-semibold shadow-[var(--app-shadow-card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/50"
                          aria-label="เปิดใน LINE OA Manager"
                        >
                          เปิดใน LINE OA <span aria-hidden="true">↗</span>
                        </button>
                      </div>
                    </header>

                    {/* ── 2. DETAIL WORKSPACE BODY (DOMINANT CHAT + DRAWER) ── */}
                    <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
                      {/* ── PRIMARY CHAT COLUMN ── */}
                      <div className="flex flex-1 min-h-0 min-w-0 flex-col bg-[var(--app-surface)]">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-1.5">
                          <p className="app-muted text-xs font-tabular text-[var(--app-text-tertiary)] font-mono">{chatHistory.total} {text.messagesToday}</p>
                          <button
                            data-chat-detail-secondary-action
                            onClick={() => setShowTranslation(!showTranslation)}
                            className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)]"
                          >
                            🌐 {showTranslation ? text.showOriginal : text.translateMessage}
                          </button>
                        </div>
                        <div data-chat-message-scroll className="flex-1 min-h-0 space-y-2.5 overflow-y-auto overscroll-contain bg-[var(--app-surface-subtle)]/40 px-4 py-3">
                          {chatHistory.hasEarlier && <div className="pb-2 text-center"><button disabled={chatLoading} onClick={() => void loadEarlierMessages()} className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] px-3 py-1 text-xs shadow-[var(--app-shadow-card)] transition-colors">{text.loadEarlierMessages}</button></div>}
                          {chatHistory.items.map((message, index) => { const previous = chatHistory.items[index - 1]; const date = new Date(message.sentAt); const showDate = !previous || new Date(previous.sentAt).toDateString() !== date.toDateString(); const translated = language === "th" ? message.translatedThai : language === "en" ? message.translatedEnglish : message.translatedChinese; const content = showTranslation ? translated ?? message.originalText : message.originalText; const inbound = message.direction === "INBOUND"; return <div key={message.id}>{showDate && <div data-chat-date-separator className="my-3 text-center text-xs text-[var(--app-text-tertiary)] font-tabular font-mono">{new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(date)}</div>}<div className={`flex items-end gap-2 ${message.direction === "SYSTEM" ? "justify-center" : inbound ? "justify-start" : "justify-end"}`}>{inbound && <div style={selectedApiConversation?.customer.pictureUrl ? { backgroundImage: `url(${selectedApiConversation.customer.pictureUrl})` } : undefined} className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] border border-[var(--app-border)] bg-cover bg-center text-xs font-medium text-[var(--app-text-secondary)]">{selectedApiConversation?.customer.pictureUrl ? "" : (selectedApiConversation?.customer.displayName ?? "L").slice(0, 1)}</div>}<div className={`max-w-[72%] ${message.direction === "SYSTEM" ? "bg-transparent text-xs text-[var(--app-text-tertiary)] font-tabular" : inbound ? "rounded-2xl rounded-bl-xs bg-[var(--app-surface)] border border-[var(--app-border)] px-4 py-2.5 shadow-[var(--app-shadow-card)] text-[var(--app-text-primary)]" : "rounded-2xl rounded-br-xs bg-[var(--app-accent-soft)]/60 border border-[var(--app-accent)]/20 px-4 py-2.5 text-[var(--app-text-primary)]"}`}>{message.messageType === "IMAGE" ? <MessageImage messageId={message.id} media={message.media} alt={text.customerImage} unavailableLabel={text.imageUnavailable} errorLabel={text.imageLoadError} retryLabel={text.retryImage} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>}{message.fileName && <p className="mt-1 text-xs font-medium">📎 {message.fileName}</p>}<MessageTranslationAction message={message} userRole={authUser.role} onTranslated={(translatedText) => updateMessageEnglishTranslation(message.id, translatedText)} /><p className={`mt-1 text-[10px] text-[var(--app-text-tertiary)] font-tabular font-mono ${inbound ? "" : "text-right"}`}>{new Intl.DateTimeFormat(language, { timeStyle: "short" }).format(date)}</p></div></div></div>; })}
                          {chatHistory.items.length === 0 && <p className="py-16 text-center text-sm text-[var(--app-text-tertiary)]">{text.noMessages}</p>}
                          <div ref={chatEndRef} />
                        </div>
                        <div data-chat-reply-composer className="shrink-0 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
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
                              className="app-input max-h-32 min-h-11 flex-1 resize-none rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)] outline-none focus:border-[var(--app-accent)] focus:ring-1 focus:ring-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <button
                              type="button"
                              disabled={!replyText.trim() || replySending || authUser.role === "VIEWER"}
                              onClick={() => void sendReply()}
                              className="h-11 shrink-0 rounded-[var(--app-radius-md)] bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white px-4 text-xs font-semibold shadow-[var(--app-shadow-card)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {replySending ? "กำลังส่ง..." : "ส่ง"}
                            </button>
                          </div>
                          {replyError && <p role="alert" className="mt-2 text-xs text-[var(--app-danger)]">{replyError}</p>}
                          <p className="app-muted mt-1 text-right text-[10px] font-tabular text-[var(--app-text-tertiary)] font-mono">{replyText.length.toLocaleString()}/5,000 · Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่</p>
                        </div>
                        <p data-line-oa-manager-notice className="shrink-0 flex items-start gap-2 border-t border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)]/50 px-4 py-1.5 text-xs text-[var(--app-text-tertiary)]"><span aria-hidden="true">ⓘ</span><span>{text.repliesMayNotAppear}</span></p>
                      </div>

                      {/* ── 3. COLLAPSIBLE DETAILS DRAWER ── */}
                      {showDetailsDrawer && (
                        <aside
                          data-chat-details-drawer
                          className="w-80 lg:w-[22rem] shrink-0 border-l border-[var(--app-border)] bg-[var(--app-surface)] flex flex-col h-full min-h-0 z-10 shadow-lg"
                        >
                          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-2.5 shrink-0 bg-[var(--app-surface)]">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-primary)]">
                              {text.details}
                            </h3>
                            <button
                              type="button"
                              onClick={() => setShowDetailsDrawer(false)}
                              className="rounded-[var(--app-radius-sm)] p-1 text-xs text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-subtle)] hover:text-[var(--app-text-primary)] transition-colors"
                              aria-label={text.hideDetails}
                            >
                              ✕
                            </button>
                          </div>

                          <div data-chat-detail-scroll className="min-h-0 flex-1 overflow-y-auto p-3.5 space-y-3">
                            <div data-chat-detail-lower className="chat-detail-lower grid gap-3">
                              <section data-product-intent-card data-insights-section className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 shadow-[var(--app-shadow-card)] chat-detail-insights">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-primary)]">{text.aiInsight}</h3>
                                  <button data-chat-detail-secondary-action disabled={chatLoading} onClick={() => void reanalyzeConversation()} className="rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)]">{text.reanalyzeConversation}</button>
                                </div>
                                {selectedApiConversation?.aiInsight?.mentionedProducts.length ? (
                                  <div className="mb-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">{text.mentionedProduct}</h4><p className="mt-0.5 text-xs font-medium text-[var(--app-text-primary)]">{selectedApiConversation.aiInsight.mentionedProducts.map(({ model, confidence }) => `${model.seriesName ? `${model.seriesName} · ` : ""}${model.name}${confidence == null ? "" : ` (${Math.round(confidence * 100)}%)`}`).join(", ")}</p></div>
                                ) : (
                                  <p className="text-xs text-[var(--app-text-tertiary)]">{text.noInsightAvailable}</p>
                                )}
                                <dl className="grid grid-cols-1 gap-x-4 gap-y-3">
                                  <div><dt className="text-xs text-[var(--app-text-tertiary)]">{text.customerRelationship}</dt><dd><span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-200">{selectedApiConversation?.aiInsight?.classification.productRelationship ?? selectedConversation.relationship}</span></dd></div>
                                  <div><dt className="text-xs text-[var(--app-text-tertiary)]">{text.purchaseIntent}</dt><dd><span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-200 font-semibold">{selectedApiConversation?.aiInsight?.classification.purchaseIntent ?? selectedConversation.purchaseIntent}</span></dd></div>
                                </dl>
                                <div className="mt-3 border-t border-[var(--app-border-subtle)] pt-3">
                                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">{text.conversationTopics}</h4>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(selectedApiConversation?.aiInsight?.topics ?? selectedApiConversation?.topics.filter(({ source }) => source === "RULE") ?? [])
                                      .map((topic) => {
                                        const topicId = "topic" in topic ? topic.topic.id : topic.id;
                                        const topicName = "topic" in topic ? topic.topic.name : topic.name;
                                        return <span key={topicId} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">{topicName} <span className="text-[10px] opacity-70">{text.autoSource}</span></span>;
                                      })}
                                    {!selectedApiConversation?.aiInsight?.topics.length && !selectedApiConversation?.topics.some(({ source }) => source === "RULE") && <span className="text-xs text-[var(--app-text-tertiary)]">{text.noTopicDetected}</span>}
                                  </div>
                                </div>
                              </section>

                              <section data-topics-note-card data-internal-note-section className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 shadow-[var(--app-shadow-card)] chat-detail-note">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--app-text-primary)]">{text.internalNote}</label>
                                <textarea value={selectedConversationState.note} onChange={(event) => updateInternalNote(event.target.value)} onBlur={() => void saveInternalNote()} disabled={isMutating} placeholder={text.notePlaceholder} className="max-h-32 min-h-20 w-full resize-y rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-2.5 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)] outline-none focus:border-[var(--app-accent)] focus:ring-1 focus:ring-[var(--app-accent)]" />
                                <p className="app-muted mt-1.5 text-[11px] text-[var(--app-text-tertiary)] font-mono">{isMutating ? text.loadingData : text.noteSaveHint}</p>
                              </section>

                              <section data-activity-history className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 shadow-[var(--app-shadow-card)] chat-detail-activity">
                                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--app-text-primary)]">{text.activityHistory}</h3>
                                {selectedConversationState.activityHistory.length > 0 ? (
                                  <div className="space-y-2">
                                    {[...selectedConversationState.activityHistory]
                                      .reverse()
                                      .map((activity) => (
                                        <div
                                          key={activity.id}
                                          className="flex items-center justify-between gap-3 rounded-[var(--app-radius-sm)] bg-[var(--app-surface-subtle)] px-3 py-2 text-xs"
                                        >
                                          <p className="text-xs text-[var(--app-text-primary)]">
                                            {activity.actionType === "messageReceived" ? (
                                              text.messageReceivedActivity
                                            ) : activity.actionType === "bmReplyStatus" && activity.bmReplyStatus ? (
                                              <>
                                                {text.bmReplyStatusChangedTo}{" "}
                                                <span className="font-semibold text-[var(--app-text-primary)]">{bmReplyStatusLabels[language][activity.bmReplyStatus]}</span>
                                              </>
                                            ) : activity.status ? (
                                              <>
                                                {text.statusChangedTo}{" "}
                                                <span className="font-semibold text-[var(--app-text-primary)]">{getStatusLabel(language, activity.status)}</span>
                                              </>
                                            ) : null}
                                          </p>
                                          <time className="text-[10px] text-[var(--app-text-tertiary)] font-mono" dateTime={activity.timestamp}>
                                            {formatRelativeTime(activity.timestamp, language)}
                                          </time>
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-[var(--app-text-tertiary)]">{text.noActivity}</p>
                                )}
                              </section>
                            </div>
                          </div>
                        </aside>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    data-chat-detail-empty-state
                    className="flex h-full min-h-0 flex-1 flex-col items-center justify-center p-8 text-center select-none bg-[var(--app-surface-subtle)]/20"
                  >
                    <div className="flex flex-col items-center max-w-sm">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-surface)] border border-[var(--app-border)] text-lg text-[var(--app-text-tertiary)] shadow-2xs">
                        💬
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-[var(--app-text-primary)]">
                        {text.selectConversationTitle || "Select a conversation"}
                      </h3>
                      <p className="mt-1.5 text-xs text-[var(--app-text-tertiary)] leading-relaxed">
                        {text.selectConversationDescription ||
                          "Choose a conversation from the list to view messages and customer details."}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="remove-store-title" className="w-full max-w-lg rounded-[var(--app-radius-xl)] bg-[var(--app-surface)] border border-[var(--app-border)] p-6 shadow-[var(--app-shadow-modal)] text-[var(--app-text-primary)]">
            <h2 id="remove-store-title" className="text-xl font-bold">{text.removeStore}</h2>
            <p className="mt-2 text-sm text-[var(--app-text-secondary)]">{text.removeStoreQuestion.replace("{storeName}", storeRemovalPreview.storeName)}</p>
            <dl className="mt-5 grid grid-cols-4 gap-3">
              {[[text.lineOaAccountsCount, storeRemovalPreview.lineOfficialAccountCount], [text.conversationCountLabel, storeRemovalPreview.conversationCount], [text.messageCountLabel, storeRemovalPreview.messageCount], [text.noteActivityCountLabel, storeRemovalPreview.noteCount + storeRemovalPreview.activityCount]].map(([label, value]) => <div key={String(label)} className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-3 text-center"><dt className="text-xs text-[var(--app-text-tertiary)]">{label}</dt><dd className="mt-1 text-xl font-bold text-[var(--app-text-primary)]">{value}</dd></div>)}
            </dl>
            {!permanentDeleteStep ? <div className="mt-4 space-y-2 text-sm"><p className="rounded-[var(--app-radius-md)] border border-red-200 bg-red-50 p-3 text-red-800 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300">{text.permanentDeleteDescription}</p><p className="rounded-[var(--app-radius-md)] border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300">{text.archiveDescription}</p></div> : <div className="mt-4"><p className="rounded-[var(--app-radius-md)] border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300">{text.irreversibleWarning}</p><label className="mt-3 block text-sm">{text.typeStoreName}<input autoFocus value={permanentDeleteConfirmation} onChange={(event) => setPermanentDeleteConfirmation(event.target.value)} className="mt-1 w-full rounded-[var(--app-radius-md)] border border-red-300 dark:border-red-800 bg-[var(--app-surface)] p-2 text-sm" /></label></div>}
            {storeRemovalMessage && <p role="alert" className="mt-4 rounded-[var(--app-radius-md)] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{storeRemovalMessage}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-3"><button disabled={storeRemovalLoading} onClick={() => { setStoreRemovalPreview(null); setPermanentDeleteStep(false); }} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] px-4 py-2 text-sm">{text.cancel}</button>{!permanentDeleteStep ? <><button disabled={storeRemovalLoading} onClick={() => setPermanentDeleteStep(true)} className="rounded-[var(--app-radius-md)] bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800">{text.deletePermanently}</button><button disabled={storeRemovalLoading} onClick={() => void archiveSelectedStore()} className="rounded-[var(--app-radius-md)] bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700">{text.archiveStore}</button></> : <button disabled={storeRemovalLoading || permanentDeleteConfirmation !== storeRemovalPreview.storeName} onClick={() => void deleteStorePermanently()} className="rounded-[var(--app-radius-md)] bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{storeRemovalLoading ? text.loadingData : text.deletePermanently}</button>}</div>
          </div>
        </div>
      )}
      {bulkConfirmState && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-[var(--app-radius-xl)] bg-[var(--app-surface)] border border-[var(--app-border)] p-6 shadow-[var(--app-shadow-modal)] space-y-4 text-[var(--app-text-primary)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-base">
                ✓
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="bulk-confirm-title" className="text-base font-bold text-[var(--app-text-primary)] truncate">
                  {language === "th"
                    ? "ยืนยันเปลี่ยนสถานะ"
                    : language === "zh"
                      ? "确认更改状态"
                      : "Confirm Status Change"}
                </h3>
                {bulkConfirmState.storeName && (
                  <p className="text-xs text-[var(--app-text-tertiary)] truncate">
                    {bulkConfirmState.storeName}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-4 text-xs text-[var(--app-text-primary)] leading-relaxed">
              <p>
                {language === "th" ? (
                  <>
                    คุณกำลังเปลี่ยน <strong>{bulkConfirmState.affectedCount}</strong> บทสนทนาเป็น{" "}
                    <strong className="text-[var(--app-success)]">
                      &ldquo;ตอบแล้ว&rdquo;
                    </strong>
                  </>
                ) : language === "zh" ? (
                  <>
                    您正在将 <strong>{bulkConfirmState.affectedCount}</strong> 条对话更改为{" "}
                    <strong className="text-[var(--app-success)]">
                      &ldquo;已回复&rdquo;
                    </strong>
                  </>
                ) : (
                  <>
                    You are changing <strong>{bulkConfirmState.affectedCount}</strong> conversations to{" "}
                    <strong className="text-[var(--app-success)]">
                      &ldquo;Replied&rdquo;
                    </strong>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isBulkUpdating}
                onClick={() => setBulkConfirmState(null)}
                className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-subtle)] px-4 py-2 text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors disabled:opacity-50"
              >
                {language === "th" ? "ยกเลิก" : language === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={isBulkUpdating || bulkConfirmState.affectedCount === 0}
                onClick={() => void handleExecuteBulkUpdate()}
                className="rounded-[var(--app-radius-md)] bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--app-shadow-card)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50 disabled:opacity-50 flex items-center gap-2"
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
