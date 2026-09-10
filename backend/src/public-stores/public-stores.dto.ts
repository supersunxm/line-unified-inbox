import type { StoreMaster } from "@prisma/client";
import { isValidLineOaUrl } from "../store-master/store-master.utils";

export interface PublicStoreLineInfo {
  url: string;
  basicId: string | null;
}

export interface PublicStoreTikTokInfo {
  username: string | null;
  profileUrl: string;
}

export interface PublicStoreLocationInfo {
  addressPreview: string;
  mapsUrl: string | null;
}

export interface PublicStoreDto {
  id: string;
  slug: string;
  name: string;
  province: string | null;
  region: string | null;
  location: PublicStoreLocationInfo;
  line: PublicStoreLineInfo | null;
  tiktok: PublicStoreTikTokInfo | null;
}

export interface PublicStoreListResponse {
  stores: PublicStoreDto[];
  total: number;
  filters: {
    provinces: string[];
    regions: string[];
  };
}

const THAI_PROVINCE_BY_KEY: Record<string, string> = {
  bangkok: "กรุงเทพมหานคร",
  "krung thep maha nakhon": "กรุงเทพมหานคร",
  "amnat charoen": "อำนาจเจริญ",
  "ang thong": "อ่างทอง",
  "bueng kan": "บึงกาฬ",
  buriram: "บุรีรัมย์",
  "buri ram": "บุรีรัมย์",
  chachoengsao: "ฉะเชิงเทรา",
  "chai nat": "ชัยนาท",
  chaiyaphum: "ชัยภูมิ",
  chanthaburi: "จันทบุรี",
  "chiang mai": "เชียงใหม่",
  "chiang rai": "เชียงราย",
  chonburi: "ชลบุรี",
  "chon buri": "ชลบุรี",
  chumphon: "ชุมพร",
  kalasin: "กาฬสินธุ์",
  "kamphaeng phet": "กำแพงเพชร",
  kanchanaburi: "กาญจนบุรี",
  "khon kaen": "ขอนแก่น",
  krabi: "กระบี่",
  lampang: "ลำปาง",
  lamphun: "ลำพูน",
  loei: "เลย",
  lopburi: "ลพบุรี",
  "lop buri": "ลพบุรี",
  "mae hong son": "แม่ฮ่องสอน",
  "maha sarakham": "มหาสารคาม",
  mukdahan: "มุกดาหาร",
  "nakhon nayok": "นครนายก",
  "nakhon pathom": "นครปฐม",
  "nakhon phanom": "นครพนม",
  "nakhon ratchasima": "นครราชสีมา",
  "nakhon sawan": "นครสวรรค์",
  "nakhon si thammarat": "นครศรีธรรมราช",
  nan: "น่าน",
  narathiwat: "นราธิวาส",
  "nong bua lam phu": "หนองบัวลำภู",
  "nong khai": "หนองคาย",
  nonthaburi: "นนทบุรี",
  "pathum thani": "ปทุมธานี",
  pattani: "ปัตตานี",
  "phang nga": "พังงา",
  phatthalung: "พัทลุง",
  phayao: "พะเยา",
  phetchabun: "เพชรบูรณ์",
  phetchaburi: "เพชรบุรี",
  phichit: "พิจิตร",
  phitsanulok: "พิษณุโลก",
  "phra nakhon si ayutthaya": "พระนครศรีอยุธยา",
  ayutthaya: "พระนครศรีอยุธยา",
  phrae: "แพร่",
  phuket: "ภูเก็ต",
  prachinburi: "ปราจีนบุรี",
  "prachin buri": "ปราจีนบุรี",
  "prachuap khiri khan": "ประจวบคีรีขันธ์",
  ranong: "ระนอง",
  ratchaburi: "ราชบุรี",
  rayong: "ระยอง",
  "roi et": "ร้อยเอ็ด",
  "sa kaeo": "สระแก้ว",
  "sakon nakhon": "สกลนคร",
  "samut prakan": "สมุทรปราการ",
  "samut sakhon": "สมุทรสาคร",
  "samut songkhram": "สมุทรสงคราม",
  saraburi: "สระบุรี",
  satun: "สตูล",
  singburi: "สิงห์บุรี",
  "sing buri": "สิงห์บุรี",
  sisaket: "ศรีสะเกษ",
  "si sa ket": "ศรีสะเกษ",
  songkhla: "สงขลา",
  sukhothai: "สุโขทัย",
  "suphan buri": "สุพรรณบุรี",
  "surat thani": "สุราษฎร์ธานี",
  surin: "สุรินทร์",
  tak: "ตาก",
  trang: "ตรัง",
  trat: "ตราด",
  "ubon ratchathani": "อุบลราชธานี",
  "udon thani": "อุดรธานี",
  "uthai thani": "อุทัยธานี",
  uttaradit: "อุตรดิตถ์",
  yala: "ยะลา",
  yasothon: "ยโสธร",
};

export function localizePublicProvince(province: string | null | undefined): string | null {
  const trimmed = province?.normalize("NFKC").trim();
  if (!trimmed) return null;

  return THAI_PROVINCE_BY_KEY[trimmed.toLocaleLowerCase()] ?? trimmed;
}

export function generatePublicStoreSlug(storeName: string, externalStoreId?: string | null): string {
  const base = storeName
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = externalStoreId ? `-${externalStoreId}` : "";
  if (!base) return `store${suffix}`;
  return `${base}${suffix}`;
}

export function serializePublicStore(store: StoreMaster): PublicStoreDto {
  const externalId = store.externalStoreId ?? "";
  const slug = generatePublicStoreSlug(store.storeName, store.externalStoreId);
  const province = localizePublicProvince(store.province);

  const lineUrl = store.lineOaLink?.trim() ?? null;
  const line: PublicStoreLineInfo | null = lineUrl && isValidLineOaUrl(lineUrl)
    ? {
        url: lineUrl,
        basicId: store.lineId ?? null,
      }
    : null;

  const tiktok: PublicStoreTikTokInfo | null =
    store.tiktokProfileUrl || store.tiktokUsername
      ? {
          username: store.tiktokUsername ?? null,
          profileUrl:
            store.tiktokProfileUrl ||
            (store.tiktokUsername ? `https://www.tiktok.com/@${store.tiktokUsername}` : ""),
        }
      : null;

  const addressParts: string[] = [store.storeName];
  if (province) addressParts.push(province);
  if (store.region && store.region !== store.province) addressParts.push(store.region);

  const location: PublicStoreLocationInfo = {
    addressPreview: addressParts.join(", "),
    mapsUrl: store.googleMapsUrl ?? null,
  };

  return {
    id: externalId,
    slug,
    name: store.storeName,
    province,
    region: store.region ?? null,
    location,
    line,
    tiktok,
  };
}
