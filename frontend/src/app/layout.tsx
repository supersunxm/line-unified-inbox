import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import "./public-branding.css";
import { ThemeProvider } from "./theme";
import { LanguageProvider } from "./language";
import { AuthUnauthorizedListener } from "./auth-unauthorized-listener";

export const metadata: Metadata = {
  title: {
    default: "OPPO Brand Shop · ค้นหาสาขา & ช่องทางติดต่อ",
    template: "%s | OPPO Brand Shop",
  },
  description: "ค้นหาข้อมูลสาขาและช่องทางติดต่อ LINE Official Account, TikTok ของ OPPO Brand Shop ทั่วประเทศไทย",
  icons: {
    icon: [{ url: "/images/LOGO_OBS.png", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/images/LOGO_OBS.png", type: "image/png", sizes: "1024x1024" }],
  },
};

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-ibm-plex-sans-thai",
});

const themeInitializationScript = `
(() => {
  try {
    const saved = localStorage.getItem("oppo-line-oa-theme");
    const preference = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    const resolved = preference === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  } catch {
    const resolved = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${ibmPlexSansThai.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LanguageProvider>
            <AuthUnauthorizedListener />
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
