const assert = require('node:assert/strict');
const { randomBytes, randomUUID, createHash, createHmac } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { openSync, closeSync } = require('node:fs');
const { PrismaClient } = require('@prisma/client');

// Real compiled application and sessions. This script refuses non-local databases.
async function run() {
  const url = new URL(process.env.SECRETARY_SETTINGS_TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.ok(['/ci', '/sunn_owner_credentials_test_20261008'].includes(url.pathname));
  const portCheck = createServer();
  await new Promise((resolve, reject) => portCheck.once('error', reject).listen(3001, resolve));
  await new Promise(resolve => portCheck.close(resolve));
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const recordId = '5778f384-6abd-4df8-b5db-5c5635f742cd';
  const ownerId = randomUUID(), storeId = randomUUID(), users = [], tokens = [];
  const log = openSync('/tmp/sunn-secretary-http.log', 'w', 0o600);
  const encryptionKey = randomBytes(32).toString('base64');
  let child;
  let createdRecord = false;
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM'); await exited;
  };
  const start = async (configured = true, inboundEnabled = false) => {
    child = spawn(process.execPath, ['dist/main.js'], {
      env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test', PORT: '3001', FRONTEND_URL: 'http://localhost:3000',
        EMAIL_PROVIDER: 'none', LINE_CREDENTIAL_ENCRYPTION_KEY: encryptionKey, CREDENTIAL_ENCRYPTION_KEY: encryptionKey,
        SUNN_SECRETARY_OWNER_HQ_USER_ID: configured ? ownerId : '', SUNN_SECRETARY_WEBHOOK_ENABLED: inboundEnabled ? 'true' : 'false',
        SUNN_SECRETARY_ALLOWED_USER_IDS: 'U' + 'a'.repeat(32), SUNN_SECRETARY_STORE_SCOPE_BY_USER: '{}', SUNN_SECRETARY_BOT_USER_ID: 'U' + '0'.repeat(32), SUNN_SECRETARY_CHANNEL_SECRET: 'intentionally-different-env-secret',
        LINE_WEBHOOK_ENABLED: 'false', PILOT_MODE: 'false' }, stdio: ['ignore', log, log],
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error('Nest startup failed; inspect /tmp/sunn-secretary-http.log');
      try { if ((await fetch('http://127.0.0.1:3001/health')).ok) return; } catch { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Nest health check timed out');
  };
  const request = (token, path = 'status', method = 'GET', body, extra = {}) => fetch(`http://127.0.0.1:3001/sunn-secretary/owner/${path}`, {
    method, headers: { ...(token ? { Cookie: `oppo_session=${token}` } : {}), Origin: 'http://localhost:3000',
      'Content-Type': 'application/json', 'X-Sunn-Secretary-Settings': '1', ...extra },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.equal(await db.lineOfficialAccount.findUnique({ where: { id: recordId } }), null);
    await db.store.create({ data: { id: storeId, name: 'Isolated secretary HTTP fixture' } });
    for (const [index, role, status] of [[0, 'ADMIN', 'ACTIVE'], [1, 'ADMIN', 'ACTIVE'], [2, 'ASSISTANT', 'ACTIVE'], [3, 'ADMIN', 'SUSPENDED']]) {
      const id = index === 0 ? ownerId : randomUUID(); users.push(id);
      await db.user.create({ data: { id, email: `${id}@example.test`, normalizedEmail: `${id}@example.test`, displayName: 'Local HTTP fixture', role, status, canAccessHq: true, canAccessAllStores: true } });
      const token = randomBytes(32).toString('base64url'); tokens.push(token);
      await db.session.create({ data: { userId: id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 600000) } });
    }
    await start();
    for (const [token, code] of [[tokens[0], 200], [tokens[1], 403], [tokens[2], 403], [tokens[3], 401], [undefined, 401]]) assert.equal((await request(token)).status, code);
    assert.equal((await request(tokens[0], 'status', 'GET', undefined, { 'X-Act-As-Store-Id': storeId })).status, 403);
    assert.equal((await request(tokens[0], 'test-connection', 'POST', {})).status, 400);
    const values = { channelId: '1234567890', channelSecret: 'f'.repeat(32), accessToken: 'syntheticLocalOnlyToken'.repeat(3), botUserId: 'U' + 'f'.repeat(32) };
    for (const [token, path, body, extra, code] of [
      [tokens[1], 'credentials', values, {}, 403],
      [tokens[0], 'credentials', values, { Origin: 'https://evil.example' }, 403],
      [tokens[0], 'credentials', values, { 'X-Sunn-Secretary-Settings': '' }, 403],
      [tokens[0], 'credentials?accessToken=forbidden', values, {}, 400],
      [tokens[0], 'credentials', { accessToken: 'x'.repeat(8200) }, {}, 400],
    ]) assert.equal((await request(token, path, 'PATCH', body, extra)).status, code);
    const saved = await request(tokens[0], 'credentials', 'PATCH', values); assert.equal(saved.status, 200);
    createdRecord = true;
    const safeBody = await saved.text(); assert.ok(!safeBody.includes(values.accessToken) && !safeBody.includes(values.channelSecret));
    const row = await db.lineOfficialAccount.findUniqueOrThrow({ where: { id: recordId } });
    assert.ok(row.encryptedChannelAccessToken.startsWith('v1:')); assert.equal(row.isActive, false); assert.ok(row.archivedAt);
    assert.equal((await fetch('http://127.0.0.1:3001/sunn-secretary/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
    await stop(); await start(false); assert.equal((await request(tokens[0])).status, 403);
    await stop(); await start();
    const reloaded = await request(tokens[0]); assert.equal(reloaded.status, 200);
    const state = await reloaded.json(); assert.equal(state.accessTokenConfigured, true); assert.equal(state.validationState, 'NOT_VALIDATED'); assert.equal(state.webhookEnabled, false);
    await stop();
    // Local fixture only: no official LINE API call is made to validate these synthetic credentials.
    await db.lineOfficialAccount.update({ where: { id: recordId }, data: { lastConnectionTestAt: new Date(), lastConnectionError: null } });
    const eventId = 'http-inbound-' + randomUUID();
    const payload = JSON.stringify({ destination: values.botUserId, events: [{ type: 'message', timestamp: Date.now(), webhookEventId: eventId,
      source: { type: 'group', groupId: 'C' + 'a'.repeat(32), userId: 'U' + 'a'.repeat(32) },
      message: { type: 'text', text: '@เลขาซันน์ เดือนตุลาคม ปี 2026 LINE OA ค้างตอบ', mention: { mentionees: [{ type: 'user', userId: values.botUserId }] } } }] });
    const send = (raw, signature = createHmac('sha256', values.channelSecret).update(raw).digest('base64')) => fetch('http://127.0.0.1:3001/sunn-secretary/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-signature': signature }, body: raw });
    try {
      await start(true, true);
      assert.equal((await send(payload, 'invalid')).status, 401);
      assert.equal((await send(JSON.stringify({ destination: 'U' + '0'.repeat(32), events: [] }))).status, 400);
      assert.equal((await send(JSON.stringify({ destination: values.botUserId, events: [] }))).status, 200);
      assert.equal((await send(payload)).status, 200);
      await stop(); await start(true, true);
      assert.equal((await send(payload)).status, 200);
      // New process automatically recovers the durable accepted event after restart.
      let recovered = false;
      for (let attempt = 0; attempt < 150; attempt++) {
        const work = await db.webhookEvent.findFirst({ where: { destination: values.botUserId, eventType: 'SUNN_SECRETARY_INBOUND_BLOCKED_SCOPE' } });
        if (work) { recovered = true; break; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.equal(recovered, true, 'scheduled recovery must run in the restarted compiled application');
      const receipts = await db.webhookEvent.findMany({ where: { destination: values.botUserId, externalWebhookEventId: { startsWith: 'sunn-secretary:v1:' } } });
      assert.equal(receipts.length, 1); assert.equal(receipts[0].processingStatus, 'IGNORED');
      assert.ok(!receipts[0].errorMessage.includes('ค้างตอบ'));
    } finally {
      await stop();
      await db.webhookEvent.deleteMany({ where: { destination: values.botUserId, externalWebhookEventId: { startsWith: 'sunn-secretary:v1:' } } });
    }
    console.log('PASS: real Nest HTTP authorization, CSRF, encrypted credential precedence, signed ingress, restart deduplication and disabled webhook');
  } finally {
    await stop(); closeSync(log);
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.authRateLimitBucket.deleteMany({ where: { key: { startsWith: `sunn-secretary:${ownerId}:` } } });
    if (createdRecord) await db.lineOfficialAccount.deleteMany({ where: { id: recordId, webhookKey: 'sunn-secretary-credentials-v1' } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.store.deleteMany({ where: { id: storeId } }); await db.$disconnect();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
