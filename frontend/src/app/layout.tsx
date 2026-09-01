import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./theme";
import { LanguageProvider } from "./language";

export const metadata: Metadata = {
  title: "OPPO LINE OA Monitor",
  description: "Monitor and follow up LINE OA customer conversations",
};

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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
