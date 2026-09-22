export type ManagerNicknameSalesTag =
  | {
      status: "ONLINE";
      onlineSource: string | null;
      period: { month: number; year: number } | null;
    }
  | {
      status: "FILM";
      filmBrand: string;
      period: { month: number; year: number };
    }
  | {
      status: "PURCHASED";
      modelToken: string;
      paymentMethod: "CASH" | "INSTALLMENT" | "UFUND" | "SG_FINANCE";
      period: { month: number; year: number };
    };

const ONLINE_SOURCES = new Map<string, string>([
  ["tiktok", "TikTok"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["ig", "Instagram"],
  ["line", "LINE"],
  ["website", "Website"],
  ["lemon8", "Lemon8"],
]);

function parsePeriod(monthRaw: string, yearRaw: string): { month: number; year: number } | null {
  const month = Number(monthRaw);
  const shortYear = Number(yearRaw);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(shortYear) || shortYear < 0 || shortYear > 99) return null;
  return { month, year: 2000 + shortYear };
}

function clean(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/**
 * Reverse only nickname formats that our own LINE nickname automation emits.
 * Arbitrary customer names intentionally return null.
 */
export function parseManagerNicknameSalesTag(raw: string | null | undefined): ManagerNicknameSalesTag | null {
  const nickname = clean(raw ?? "");
  if (!nickname) return null;

  if (nickname.toLowerCase() === "online") {
    return { status: "ONLINE", onlineSource: null, period: null };
  }

  const film = /^Film\/(.+)\/(\d{2})\/(\d{2})$/iu.exec(nickname);
  if (film) {
    const filmBrand = clean(film[1]);
    const period = parsePeriod(film[2], film[3]);
    if (!filmBrand || !period) return null;
    return { status: "FILM", filmBrand, period };
  }

  const purchased = /^(.+?)\s+(สด|ผ่อน|Ufund|SG)\s+(\d{2})\/(\d{2})$/iu.exec(nickname);
  if (purchased) {
    const modelToken = clean(purchased[1]);
    const period = parsePeriod(purchased[3], purchased[4]);
    if (!modelToken || !period) return null;
    const label = purchased[2].toLowerCase();
    const paymentMethod =
      label === "สด"
        ? "CASH"
        : label === "ผ่อน"
          ? "INSTALLMENT"
          : label === "ufund"
            ? "UFUND"
            : "SG_FINANCE";
    return { status: "PURCHASED", modelToken, paymentMethod, period };
  }

  const online = /^(.+?)\s+(\d{2})\/(\d{2})$/u.exec(nickname);
  if (online) {
    const canonicalSource = ONLINE_SOURCES.get(clean(online[1]).toLowerCase());
    const period = parsePeriod(online[2], online[3]);
    if (!canonicalSource || !period) return null;
    return { status: "ONLINE", onlineSource: canonicalSource, period };
  }

  return null;
}

export function nicknamePeriodDate(period: { month: number; year: number }): Date {
  // Noon in Bangkok on the 15th keeps month/year stable when formatted by
  // buildLineChatNickname regardless of UTC runtime.
  return new Date(Date.UTC(period.year, period.month - 1, 15, 5, 0, 0));
}
