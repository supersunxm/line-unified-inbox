import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { synchronizeNicknameDerivedObservations } from "./nickname-derived-metadata-sync";
import { NicknameSourceObserverService } from "./nickname-source-observer.service";

type Observation = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  nickname: string | null;
  nicknameReadStatus: string;
  observedAt: Date;
};

type Destination = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  customer: { displayName: string };
  customerSalesStatus: string | null;
  onlineSource: string | null;
  paymentMethod: string | null;
  purchaseIntent: string | null;
  ownerUserId: string | null;
  bmReplyStatus: string;
  followUpStatus: string;
  store: { id: string; isActive: boolean; archivedAt: Date | null };
  lineOfficialAccount: { id: string; storeId: string; isActive: boolean; archivedAt: Date | null };
};

function fixture() {
  const observations: Observation[] = [];
  const destinations: Destination[] = [];
  const states = new Map<string, Record<string, unknown>>();
  const receipts = new Map<string, Record<string, unknown>>();
  let stateWrites = 0;
  let applicationWrites = 0;
  const products = [{ id: "product-reno", name: "Reno16Pro", classificationLevel: "MODEL" }];
  const observationKey = (id: string, version: string) => `${id}:${version}`;
  const stateForConversation = (conversationId: string) => {
    const state = states.get(conversationId);
    if (!state) return null;
    const sourceObservation = observations.find(({ id }) => id === state.sourceObservationId);
    return {
      ...state,
      productModel: products.find(({ id }) => id === state.productModelId) ?? null,
      sourceObservation: sourceObservation ? {
        id: sourceObservation.id,
        storeId: sourceObservation.storeId,
        lineOfficialAccountId: sourceObservation.lineOfficialAccountId,
        lineChatUserId: sourceObservation.lineChatUserId,
        nickname: sourceObservation.nickname,
        nicknameReadStatus: sourceObservation.nicknameReadStatus,
      } : null,
    };
  };
  const tx = {
    async $queryRaw() {
      const latest = new Map<string, Observation>();
      for (const row of [...observations].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime() || b.id.localeCompare(a.id))) {
        const key = `${row.lineOfficialAccountId}:${row.lineChatUserId}`;
        if (!latest.has(key)) latest.set(key, row);
      }
      return [...latest.values()];
    },
    nicknameSourceObservation: {
      async findFirst(args: { where: { lineOfficialAccountId: string; lineChatUserId: string; id?: { not?: string } } }) {
        return observations
          .filter((row) => row.lineOfficialAccountId === args.where.lineOfficialAccountId && row.lineChatUserId === args.where.lineChatUserId && row.id !== args.where.id?.not)
          .sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime() || right.id.localeCompare(left.id))[0] ?? null;
      },
    },
    conversation: {
      async findMany(args: { where: { OR: { lineOfficialAccountId: string; lineChatUserId: string }[] } }) {
        return destinations.filter((row) => args.where.OR.some((identity) => row.lineOfficialAccountId === identity.lineOfficialAccountId && row.lineChatUserId === identity.lineChatUserId));
      },
    },
    productModel: {
      async findMany(_args: unknown) { return products; },
    },
    productAlias: {
      async findMany(_args: unknown) { return []; },
    },
    nicknameDerivedMetadataState: {
      async findMany(args: { where: { conversationId: { in: string[] } } }) {
        return args.where.conversationId.in.map(stateForConversation).filter(Boolean);
      },
      async findUnique(args: { where: { conversationId: string } }) { return stateForConversation(args.where.conversationId); },
      async upsert(args: { where: { conversationId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) {
        stateWrites++;
        const previous = states.get(args.where.conversationId);
        const next = { ...(previous ?? args.create), ...args.update };
        states.set(args.where.conversationId, next);
        return next;
      },
      async deleteMany(args: { where: { conversationId: string } }) {
        const removed = states.delete(args.where.conversationId);
        if (removed) stateWrites++;
        return { count: removed ? 1 : 0 };
      },
    },
    nicknameDerivedMetadataApplication: {
      async findMany(args: { where: { sourceObservationId: { in?: string[]; notIn?: string[] }; conversationId?: { in: string[] }; parserVersion: string } }) {
        return [...receipts.values()].filter((row) =>
          row.parserVersion === args.where.parserVersion &&
          (!args.where.sourceObservationId.in || args.where.sourceObservationId.in.includes(String(row.sourceObservationId))) &&
          (!args.where.sourceObservationId.notIn || !args.where.sourceObservationId.notIn.includes(String(row.sourceObservationId))) &&
          (!args.where.conversationId || args.where.conversationId.in.includes(String(row.conversationId)))
        ).reverse().map((row) => ({ ...row, sourceObservation: observations.find((observation) => observation.id === row.sourceObservationId) }));
      },
      async createMany(args: { data: Record<string, unknown>[] }) {
        for (const row of args.data) {
          applicationWrites++;
          const data: Record<string, unknown> = { ...row, previousValues: row.previousValues === Prisma.JsonNull ? null : row.previousValues, resultingValues: row.resultingValues === Prisma.JsonNull ? null : row.resultingValues };
          receipts.set(observationKey(String(data.sourceObservationId), String(data.parserVersion)), data);
        }
        return { count: args.data.length };
      },
      async findUnique(args: { where: { sourceObservationId_parserVersion: { sourceObservationId: string; parserVersion: string } } }) {
        return receipts.get(observationKey(args.where.sourceObservationId_parserVersion.sourceObservationId, args.where.sourceObservationId_parserVersion.parserVersion)) ?? null;
      },
      async create(args: { data: Record<string, unknown> }) {
        applicationWrites++;
        const data = args.data;
        receipts.set(observationKey(String(data.sourceObservationId), String(data.parserVersion)), data);
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;

  const addDestination = (oa = "oa-1", store = "store-1", chat = "chat-1") => {
    const destination: Destination = {
      id: `conversation-${destinations.length + 1}`,
      storeId: store,
      lineOfficialAccountId: oa,
      lineChatUserId: chat,
      customer: { displayName: "Original black-app customer name" },
      customerSalesStatus: "PURCHASED",
      onlineSource: "Website",
      paymentMethod: "INSTALLMENT",
      purchaseIntent: "BUY",
      ownerUserId: "owner-fixture",
      bmReplyStatus: "REPLIED",
      followUpStatus: "COMPLETED",
      store: { id: store, isActive: true, archivedAt: null },
      lineOfficialAccount: { id: oa, storeId: store, isActive: true, archivedAt: null },
    };
    destinations.push(destination);
    return destination;
  };
  const addObservation = (id: string, nickname: string | null, observedAt: number, options: Partial<Observation> = {}) => {
    const observation: Observation = {
      id,
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      nickname,
      nicknameReadStatus: "READ",
      observedAt: new Date(observedAt),
      ...options,
    };
    observations.push(observation);
    return observation;
  };

  return {
    tx,
    observations,
    destinations,
    states,
    receipts,
    addDestination,
    addObservation,
    get stateWrites() { return stateWrites; },
    get applicationWrites() { return applicationWrites; },
    getState(conversationId: string): Record<string, unknown> | null { return stateForConversation(conversationId); },
    getCustomerAndCrmSnapshot(destination: Destination) {
      return {
        displayName: destination.customer.displayName,
        customerSalesStatus: destination.customerSalesStatus,
        onlineSource: destination.onlineSource,
        paymentMethod: destination.paymentMethod,
        purchaseIntent: destination.purchaseIntent,
        ownerUserId: destination.ownerUserId,
        bmReplyStatus: destination.bmReplyStatus,
        followUpStatus: destination.followUpStatus,
      };
    },
  };
}

test("passive deterministic application keeps customer name and CRM fields unchanged", async () => {
  const data = fixture();
  const destination = data.addDestination();
  const before = data.getCustomerAndCrmSnapshot(destination);
  const observation = data.addObservation("obs-online", "Online", 1);

  const result = await synchronizeNicknameDerivedObservations(data.tx, [observation]);

  assert.equal(result.deterministicUpdates, 1);
  assert.equal(data.getState(destination.id)?.customerType, "ONLINE");
  assert.deepEqual(data.getCustomerAndCrmSnapshot(destination), before);
  assert.equal(data.applicationWrites, 1);
  assert.equal(data.receipts.size, 1);
});

test("new deterministic nickname replaces absent dimensions and no-signal safely clears with history", async () => {
  const data = fixture();
  const destination = data.addDestination();
  const online = data.addObservation("obs-online", "Online", 1);
  await synchronizeNicknameDerivedObservations(data.tx, [online]);

  const product = data.addObservation("obs-product", "Reno16Pro SG 09/26", 2);
  const updated = await synchronizeNicknameDerivedObservations(data.tx, [product]);
  const productState = data.getState(destination.id);
  assert.equal(updated.deterministicUpdates, 1, JSON.stringify(updated));
  assert.equal(productState?.customerType, null, "ONLINE is removed when absent from the new readable nickname");
  assert.equal(productState?.productModelId, "product-reno");
  assert.equal(productState?.financeProvider, "SG_FINANCE");
  assert.equal(productState?.periodYear, 2026);
  assert.equal(productState?.periodMonth, 9);

  const noSignal = data.addObservation("obs-free-text", "Somchai", 3);
  const cleared = await synchronizeNicknameDerivedObservations(data.tx, [noSignal]);
  assert.equal(cleared.noSignalClears, 1);
  assert.equal(data.getState(destination.id), null);
  const receipt = data.receipts.get("obs-free-text:nickname-parser-v3.0.1");
  assert.ok(receipt);
  assert.equal((receipt.previousValues as { sourceObservationId?: string }).sourceObservationId, "obs-product");
  assert.equal(receipt.resultingValues, null, "the immutable receipt records the clear while retaining the previous interpretation");

  const writesAfterClear = data.applicationWrites;
  const repeatedNoSignal = data.addObservation("obs-free-text-repeat", "Somchai", 4);
  const unchanged = await synchronizeNicknameDerivedObservations(data.tx, [repeatedNoSignal]);
  assert.equal(unchanged.unchangedSkips, 1);
  assert.equal(data.applicationWrites, writesAfterClear, "an unchanged nickname creates no new Tag application receipt");
});

test("missing and parser-review observations hold the prior metadata", async () => {
  const data = fixture();
  const destination = data.addDestination();
  const initial = data.addObservation("obs-online", "Online", 1);
  await synchronizeNicknameDerivedObservations(data.tx, [initial]);
  const prior = structuredClone(data.getState(destination.id));
  const receiptsBefore = data.receipts.size;

  const missing = data.addObservation("obs-missing", null, 2, { nicknameReadStatus: "MISSING" });
  const missingResult = await synchronizeNicknameDerivedObservations(data.tx, [missing]);
  assert.equal(missingResult.heldUnreadable, 1);
  assert.deepEqual(data.getState(destination.id), prior);

  const review = data.addObservation("obs-review", "Reno16 SG 13/26", 3);
  const reviewResult = await synchronizeNicknameDerivedObservations(data.tx, [review]);
  assert.equal(reviewResult.heldReview, 1);
  assert.deepEqual(data.getState(destination.id), prior);
  assert.equal(data.receipts.size, receiptsBefore, "held observations do not append false application receipts");
});

test("stale, wrong-scope, and conflicting identities produce zero metadata writes", async () => {
  const staleData = fixture();
  const staleDestination = staleData.addDestination();
  const old = staleData.addObservation("obs-old", "Online", 1);
  staleData.addObservation("obs-newer", "Somchai", 2);
  const staleResult = await synchronizeNicknameDerivedObservations(staleData.tx, [old]);
  assert.equal(staleResult.stale, 1);
  assert.equal(staleData.stateWrites, 0);
  assert.equal(staleData.applicationWrites, 0);
  assert.equal(staleData.getState(staleDestination.id), null);

  const wrongScopeData = fixture();
  wrongScopeData.addDestination("oa-1", "store-2", "chat-1");
  const wrongScope = wrongScopeData.addObservation("obs-wrong-store", "Online", 1);
  const wrongScopeResult = await synchronizeNicknameDerivedObservations(wrongScopeData.tx, [wrongScope]);
  assert.equal(wrongScopeResult.identityConflicts, 1);
  assert.equal(wrongScopeData.stateWrites, 0);
  assert.equal(wrongScopeData.applicationWrites, 0);

  const conflictData = fixture();
  const conflict = conflictData.addDestination();
  conflictData.addDestination();
  const conflictObservation = conflictData.addObservation("obs-conflict", "Online", 1);
  const conflictResult = await synchronizeNicknameDerivedObservations(conflictData.tx, [conflictObservation]);
  assert.equal(conflictResult.identityConflicts, 1);
  assert.equal(conflictData.stateWrites, 0);
  assert.equal(conflictData.applicationWrites, 0);
  assert.equal(conflictData.getState(conflict.id), null);
});

test("same chat ID under another OA does not redirect the exact identity", async () => {
  const data = fixture();
  const otherOa = data.addDestination("oa-2", "store-2", "chat-1");
  const exact = data.addDestination("oa-1", "store-1", "chat-1");
  const observation = data.addObservation("obs-exact-oa", "Online", 1);

  const result = await synchronizeNicknameDerivedObservations(data.tx, [observation]);

  assert.equal(result.deterministicUpdates, 1);
  assert.equal(data.getState(exact.id)?.customerType, "ONLINE");
  assert.equal(data.getState(otherOa.id), null);
});

test("replaying the same observation performs no second state or history write", async () => {
  const data = fixture();
  const destination = data.addDestination();
  const observation = data.addObservation("obs-replay", "Online", 1);
  await synchronizeNicknameDerivedObservations(data.tx, [observation]);
  const stateBefore = structuredClone(data.getState(destination.id));
  const stateWritesBefore = data.stateWrites;
  const applicationWritesBefore = data.applicationWrites;

  const replay = await synchronizeNicknameDerivedObservations(data.tx, [observation]);

  assert.equal(replay.duplicateReplays, 1);
  assert.equal(data.stateWrites, stateWritesBefore);
  assert.equal(data.applicationWrites, applicationWritesBefore);
  assert.deepEqual(data.getState(destination.id), stateBefore);
});

test("a new passive observation with unchanged readable nickname performs no Tag action", async () => {
  const data = fixture();
  const destination = data.addDestination();
  const first = data.addObservation("obs-online-first", "Online", 1);
  await synchronizeNicknameDerivedObservations(data.tx, [first]);
  const stateBefore = structuredClone(data.getState(destination.id));
  const stateWritesBefore = data.stateWrites;
  const applicationWritesBefore = data.applicationWrites;
  const sameNickname = data.addObservation("obs-online-same", "Online", 2);

  const result = await synchronizeNicknameDerivedObservations(data.tx, [sameNickname]);

  assert.equal(result.unchangedSkips, 1);
  assert.equal(data.stateWrites, stateWritesBefore);
  assert.equal(data.applicationWrites, applicationWritesBefore);
  assert.deepEqual(data.getState(destination.id), stateBefore);
});

test("nickname capture yields immediately while Live Mirror owns the shared profile", async () => {
  let mirrorCycleActive = true;
  let captured = 0;
  const observer = new NicknameSourceObserverService(
    {} as never,
    { isMirrorCycleActive: () => mirrorCycleActive } as never,
  );
  observer.enqueue({
    storeId: "store-1",
    lineOfficialAccountId: "oa-1",
    observedAt: new Date(1),
    coverage: "COMPLETE",
    chats: [],
  });
  const internals = observer as unknown as {
    queue: unknown[];
    capture: (snapshot: unknown) => Promise<void>;
  };
  internals.capture = async () => { captured++; };

  await observer.flush();
  assert.equal(captured, 0);
  assert.equal(internals.queue.length, 1);

  mirrorCycleActive = false;
  await observer.flush();
  assert.equal(captured, 1);
  assert.equal(internals.queue.length, 0);
});
