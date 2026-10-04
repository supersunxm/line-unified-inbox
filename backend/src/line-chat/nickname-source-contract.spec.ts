import assert from "node:assert/strict";
import test from "node:test";
import { classifyNickname, parseNicknameSource, SOURCE_TAGS } from "./nickname-source-contract";
import { discoveryIdentityFingerprint, mergeNicknameDuplicate, parseLineChatListResponse } from "./line-chat-chat-discovery";
import { handleNicknameSourceAudit } from "./nickname-source-audit-route";
import { NicknameSourceObserverService } from "./nickname-source-observer.service";
import type { PrismaService } from "../prisma.service";
import type { LineChatSessionService } from "./line-chat-session.service";

for (const tag of SOURCE_TAGS) {
  test(`source v2 exact ${tag} syntax is stable across allowed casing/whitespace`, () => {
    for (const nickname of [`${tag} 09/26`, `  ${tag.toUpperCase()}   09/26  `, `${tag.toLowerCase()}\u00a009/26`]) {
      const a = parseNicknameSource(nickname, true);
      assert.equal(a.kind, "SIGNAL"); assert.equal(a.tag, tag);
      assert.deepEqual(a, parseNicknameSource(nickname, true));
    }
  });
}
test("IG aliases Instagram and dates must satisfy the existing exact grammar", () => {
  assert.equal(parseNicknameSource("IG 09/26", true).tag, "Instagram");
  for (const x of ["TikTok", "TikTok 9/26", "TikTok 13/26", "TikTok 00/26", "TikTok-09/26", "Facebook 09/2026"]) assert.equal(parseNicknameSource(x, true).kind, "NO_TAG_SIGNAL");
});
test("Unicode case-fold lookalikes cannot produce an undefined or guessed source Tag", () => {
  for (const nickname of ["Webſite 09/26", "TiKToK 09/26", "ＴｉｋＴｏｋ 09/26", "TikTok/Webſite 09/26"]) {
    assert.deepEqual(parseNicknameSource(nickname, true), {
      kind: "NO_TAG_SIGNAL", tag: null, ruleId: null, reason: "NO_SUPPORTED_SOURCE_PERIOD",
    });
  }
});
test("arbitrary names, Thai words and platform-like words never become source signals", () => {
  for (const x of ["Online", "", "สมชาย", "คุณ TikTok", "I love Facebook 09/26", "Website Developer 09/26", "Lemon88 09/26", "Film/LINE/09/26", "Facebook สด 09/26", "Other 09/26"]) {
    assert.equal(parseNicknameSource(x, true).kind, "NO_TAG_SIGNAL", x);
  }
  assert.equal(parseNicknameSource(null, true).kind, "NO_TAG_SIGNAL");
  assert.equal(parseNicknameSource(null, false).kind, "UNKNOWN");
  assert.equal(parseNicknameSource("TikTok\u0000 09/26", true).kind, "UNKNOWN");
});
test("multiple and even repeated same-source signals are held, never guessed", () => {
  for (const x of ["TikTok/Facebook 09/26", "TikTok 09/26 Facebook 09/26", "IG;Instagram 09/26", "LINE + Website 09/26", "TikTok 09/26,TikTok 09/26"]) assert.equal(parseNicknameSource(x, true).kind, "AMBIGUOUS", x);
});
const destination = { id: "c", storeId: "s", lineOfficialAccountId: "oa", lineChatUserId: "chat", tag: null };
const input = { storeId: "s", lineOfficialAccountId: "oa", lineChatUserId: "chat", nickname: "TikTok 09/26", readable: true };
test("exact identity is OA scoped; neither same nickname nor same chat ID in another OA grants identity", () => {
  assert.equal(classifyNickname({ ...input, destinations: [destination] }).classification, "TAG_NEEDS_UPDATE");
  assert.equal(classifyNickname({ ...input, destinations: [{ ...destination, lineOfficialAccountId: "other" }] }).classification, "IDENTITY_CONFLICT");
  assert.equal(classifyNickname({ ...input, destinations: [{ ...destination, lineChatUserId: "another" }] }).classification, "IDENTITY_CONFLICT");
  assert.equal(classifyNickname({ ...input, destinations: [destination, { ...destination, id: "duplicate" }] }).classification, "IDENTITY_CONFLICT");
  assert.equal(classifyNickname({ ...input, destinations: [{ ...destination, storeId: "wrong" }] }).classification, "IDENTITY_CONFLICT");
});
test("already-correct and changed nicknames classify against independent state", () => {
  assert.equal(classifyNickname({ ...input, destinations: [{ ...destination, tag: "TikTok" }] }).classification, "TAG_MAPPED");
  assert.equal(classifyNickname({ ...input, destinations: [{ ...destination, tag: "Facebook" }] }).classification, "TAG_NEEDS_UPDATE");
  for (const [nickname, status] of [["Alice", "NO_TAG_SIGNAL"], ["LINE/Facebook 09/26", "AMBIGUOUS"]]) {
    const outcome = classifyNickname({ ...input, nickname, destinations: [{ ...destination, tag: "TikTok" }] });
    assert.equal(outcome.classification, status); assert.equal(outcome.previousTag, "TikTok");
  }
});
test("capture uses explicit Manager nickname, preserves customer name, distinguishes missing and empty", () => {
  const chatId = `U${"a".repeat(32)}`;
  const parse = (profile: unknown) => parseLineChatListResponse({ list: [{ chatId, chatType: "USER", profile }], next: null }, "bot", "endpoint").chats[0];
  const a = parse({ name: "Customer LINE name", nickname: "TikTok 09/26" });
  assert.equal(a.displayName, "Customer LINE name"); assert.equal(a.managerNickname, "TikTok 09/26"); assert.equal(a.managerNicknameReadStatus, "READ");
  assert.equal(parse({ name: "TikTok 09/26" }).managerNicknameReadStatus, undefined);
  assert.equal(parse({ nickname: null }).managerNicknameReadStatus, "READ");
  assert.equal(parse({ nickname: {} }).managerNicknameReadStatus, "INVALID");
  const b = { ...a, managerNickname: "Facebook 09/26" };
  assert.equal(discoveryIdentityFingerprint(a), discoveryIdentityFingerprint(b));
  assert.equal(mergeNicknameDuplicate(a, b).managerNicknameReadStatus, "INVALID");
  assert.notEqual(discoveryIdentityFingerprint(a), discoveryIdentityFingerprint({ ...a, displayName: "Changed customer" }));
});
test("observer immediately yields without DB work while Mirror owns its cycle", async () => {
  let reads = 0;
  const db = { $transaction: () => { reads++; throw new Error("DB must not be called"); } } as unknown as PrismaService;
  const sessions = { isMirrorCycleActive: () => true } as unknown as LineChatSessionService;
  const observer = new NicknameSourceObserverService(db, sessions);
  observer.enqueue({ storeId: "s", lineOfficialAccountId: "oa", observedAt: new Date(), coverage: "BOUNDED_RECENT", chats: [] });
  await observer.flush(); assert.equal(reads, 0);
});
test("audit endpoint requires secret, rejects writes and returns aggregates only", async () => {
  const service = { audit: async () => ({ report: { observedChats: 1 }, rows: [{ nickname: "PRIVATE" }] }) };
  const input = { method: "GET", pathname: "/internal/line-chat/nickname-source/audit", since: "2026-01-01T00:00:00Z", expectedSecret: "fixture", receivedSecret: "wrong", service };
  assert.equal((await handleNicknameSourceAudit(input as never))?.statusCode, 401);
  assert.equal((await handleNicknameSourceAudit({ ...input, receivedSecret: "fixture", method: "POST" } as never))?.statusCode, 405);
  assert.equal((await handleNicknameSourceAudit({ ...input, receivedSecret: "fixture", since: null } as never))?.statusCode, 400);
  const result = await handleNicknameSourceAudit({ ...input, receivedSecret: "fixture" } as never);
  assert.equal(result?.statusCode, 200); assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
});
