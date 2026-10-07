import type { AppLanguage } from "./language-utils";

export const sharedUiText = {
  th: {
    errorTitle: "เกิดข้อผิดพลาดในการโหลดข้อมูล",
    retry: "ลองใหม่อีกครั้ง",
    loading: "กำลังโหลด...",
    preparingMedia: "กำลังเตรียมไฟล์...",
    videoUnavailable: "วิดีโอไม่ได้ถูกจัดเก็บ",
    videoLoadFailed: "โหลดวิดีโอไม่สำเร็จ",
    fileUnavailable: "ไฟล์ไม่ได้ถูกจัดเก็บ",
    fileLoadFailed: "โหลดไฟล์ไม่สำเร็จ",
    attachment: "ไฟล์แนบ",
    downloadRetry: "ดาวน์โหลดไม่สำเร็จ ลองอีกครั้ง",
    downloading: "กำลังดาวน์โหลด...",
    clickToDownload: "กดเพื่อดาวน์โหลด",
    closeDialog: "ปิดกล่องโต้ตอบ",
  },
  en: {
    errorTitle: "An error occurred while loading data",
    retry: "Try again",
    loading: "Loading...",
    preparingMedia: "Preparing file...",
    videoUnavailable: "Video was not stored",
    videoLoadFailed: "Could not load video",
    fileUnavailable: "File was not stored",
    fileLoadFailed: "Could not load file",
    attachment: "Attachment",
    downloadRetry: "Download failed. Try again",
    downloading: "Downloading...",
    clickToDownload: "Click to download",
    closeDialog: "Close dialog",
  },
  zh: {
    errorTitle: "加载数据时发生错误",
    retry: "重试",
    loading: "正在加载...",
    preparingMedia: "正在准备文件...",
    videoUnavailable: "视频未存储",
    videoLoadFailed: "无法加载视频",
    fileUnavailable: "文件未存储",
    fileLoadFailed: "无法加载文件",
    attachment: "附件",
    downloadRetry: "下载失败，请重试",
    downloading: "正在下载...",
    clickToDownload: "点击下载",
    closeDialog: "关闭对话框",
  },
} satisfies Record<AppLanguage, Record<string, string>>;

export function getSharedUiText(language: AppLanguage) {
  return sharedUiText[language];
}
