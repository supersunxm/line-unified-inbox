// Thai names for the English region and province values that StoreMaster stores
// (e.g. "Eastern" · "Chonburi"). Pure: node --test imports it. Unknown values pass
// through unchanged, so nothing is ever hidden or invented.

/** Lowercase letters only, so "Chon Buri", "chonburi" and "Chon-Buri" share one key. */
function geoKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

const REGIONS: Array<[string, string[]]> = [
  ["กรุงเทพฯ", ["Bangkok", "BKK", "Bangkok Metropolitan", "Bangkok Metropolitan Region"]],
  ["ภาคกลาง", ["Central", "Central Thailand", "Central Region"]],
  ["ภาคตะวันออก", ["Eastern", "East", "Eastern Region"]],
  ["ภาคตะวันตก", ["Western", "West", "Western Region"]],
  ["ภาคเหนือ", ["Northern", "North", "Northern Region"]],
  ["ภาคอีสาน", ["Northeastern", "North Eastern", "Northeast", "Isan", "Northeastern Region"]],
  ["ภาคใต้", ["Southern", "South", "Southern Region"]],
];

/** All 77 provinces: Thai name, then the English spellings seen in master data. */
export const THAI_PROVINCES: Array<[string, string[]]> = [
  ["กรุงเทพมหานคร", ["Bangkok", "Krung Thep Maha Nakhon", "Krung Thep"]],
  ["อำนาจเจริญ", ["Amnat Charoen"]],
  ["อ่างทอง", ["Ang Thong"]],
  ["บึงกาฬ", ["Bueng Kan", "Bueng Kal"]],
  ["บุรีรัมย์", ["Buriram"]],
  ["ฉะเชิงเทรา", ["Chachoengsao"]],
  ["ชัยนาท", ["Chai Nat"]],
  ["ชัยภูมิ", ["Chaiyaphum"]],
  ["จันทบุรี", ["Chanthaburi"]],
  ["เชียงใหม่", ["Chiang Mai"]],
  ["เชียงราย", ["Chiang Rai"]],
  ["ชลบุรี", ["Chonburi"]],
  ["ชุมพร", ["Chumphon"]],
  ["กาฬสินธุ์", ["Kalasin"]],
  ["กำแพงเพชร", ["Kamphaeng Phet"]],
  ["กาญจนบุรี", ["Kanchanaburi"]],
  ["ขอนแก่น", ["Khon Kaen"]],
  ["กระบี่", ["Krabi"]],
  ["ลำปาง", ["Lampang"]],
  ["ลำพูน", ["Lamphun"]],
  ["เลย", ["Loei"]],
  ["ลพบุรี", ["Lopburi"]],
  ["แม่ฮ่องสอน", ["Mae Hong Son"]],
  ["มหาสารคาม", ["Maha Sarakham"]],
  ["มุกดาหาร", ["Mukdahan"]],
  ["นครนายก", ["Nakhon Nayok"]],
  ["นครปฐม", ["Nakhon Pathom"]],
  ["นครพนม", ["Nakhon Phanom"]],
  ["นครราชสีมา", ["Nakhon Ratchasima", "Korat"]],
  ["นครสวรรค์", ["Nakhon Sawan"]],
  ["นครศรีธรรมราช", ["Nakhon Si Thammarat"]],
  ["น่าน", ["Nan"]],
  ["นราธิวาส", ["Narathiwat"]],
  ["หนองบัวลำภู", ["Nong Bua Lamphu"]],
  ["หนองคาย", ["Nong Khai"]],
  ["นนทบุรี", ["Nonthaburi"]],
  ["ปทุมธานี", ["Pathum Thani"]],
  ["ปัตตานี", ["Pattani"]],
  ["พังงา", ["Phang Nga"]],
  ["พัทลุง", ["Phatthalung"]],
  ["พะเยา", ["Phayao"]],
  ["เพชรบูรณ์", ["Phetchabun"]],
  ["เพชรบุรี", ["Phetchaburi"]],
  ["พิจิตร", ["Phichit"]],
  ["พิษณุโลก", ["Phitsanulok"]],
  ["พระนครศรีอยุธยา", ["Phra Nakhon Si Ayutthaya", "Ayutthaya"]],
  ["แพร่", ["Phrae"]],
  ["ภูเก็ต", ["Phuket"]],
  ["ปราจีนบุรี", ["Prachinburi"]],
  ["ประจวบคีรีขันธ์", ["Prachuap Khiri Khan"]],
  ["ระนอง", ["Ranong"]],
  ["ราชบุรี", ["Ratchaburi"]],
  ["ระยอง", ["Rayong"]],
  ["ร้อยเอ็ด", ["Roi Et"]],
  ["สระแก้ว", ["Sa Kaeo"]],
  ["สกลนคร", ["Sakon Nakhon"]],
  ["สมุทรปราการ", ["Samut Prakan", "Samut Prakarn"]],
  ["สมุทรสาคร", ["Samut Sakhon"]],
  ["สมุทรสงคราม", ["Samut Songkhram"]],
  ["สระบุรี", ["Saraburi"]],
  ["สตูล", ["Satun"]],
  ["สิงห์บุรี", ["Sing Buri"]],
  ["ศรีสะเกษ", ["Sisaket"]],
  ["สงขลา", ["Songkhla"]],
  ["สุโขทัย", ["Sukhothai"]],
  ["สุพรรณบุรี", ["Suphan Buri"]],
  ["สุราษฎร์ธานี", ["Surat Thani"]],
  ["สุรินทร์", ["Surin"]],
  ["ตาก", ["Tak"]],
  ["ตรัง", ["Trang"]],
  ["ตราด", ["Trat"]],
  ["อุบลราชธานี", ["Ubon Ratchathani"]],
  ["อุดรธานี", ["Udon Thani"]],
  ["อุทัยธานี", ["Uthai Thani"]],
  ["อุตรดิตถ์", ["Uttaradit"]],
  ["ยะลา", ["Yala"]],
  ["ยโสธร", ["Yasothon"]],
];

function lookup(table: Array<[string, string[]]>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [thai, english] of table) {
    map.set(thai, thai);
    for (const name of english) map.set(geoKey(name), thai);
  }
  return map;
}

const REGION_LOOKUP = lookup(REGIONS);
const PROVINCE_LOOKUP = lookup(THAI_PROVINCES);

function translate(map: Map<string, string>, value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return map.get(trimmed) ?? map.get(geoKey(trimmed)) ?? trimmed;
}

/** "Eastern" → "ภาคตะวันออก". Unknown values are returned unchanged; empty → null. */
export function thaiRegion(region: string | null | undefined): string | null {
  return translate(REGION_LOOKUP, region);
}

/** "Chonburi" / "Chon Buri" → "ชลบุรี". Unknown values are returned unchanged; empty → null. */
export function thaiProvince(province: string | null | undefined): string | null {
  return translate(PROVINCE_LOOKUP, province);
}

/** "ภาคตะวันออก · ชลบุรี"; Bangkok shows once ("กรุงเทพฯ"); null when both are empty. */
export function thaiLocationLabel(region: string | null | undefined, province: string | null | undefined): string | null {
  const thaiR = thaiRegion(region);
  const thaiP = thaiProvince(province);
  if (thaiR === "กรุงเทพฯ" && (thaiP === null || thaiP === "กรุงเทพมหานคร")) return "กรุงเทพฯ";
  const parts = [thaiR, thaiP].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? [...new Set(parts)].join(" · ") : null;
}
