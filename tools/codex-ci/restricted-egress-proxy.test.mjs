import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { CI_EGRESS_HOSTS, createRestrictedEgressProxyServer, parseConnectTarget, validateReviewedUpstream } from './restricted-egress-proxy.mjs';
import googleFontsProxy from './google-font-fetch-proxy.cjs';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

function connect(port, host) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let response = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('synthetic proxy test timed out'));
    }, 2000);
    socket.on('error', (error) => { clearTimeout(timer); reject(error); });
    socket.on('data', (chunk) => {
      response = Buffer.concat([response, chunk]);
      if (response.includes('\r\n\r\n')) {
        clearTimeout(timer);
        resolve({ socket, response: response.toString('latin1') });
      }
    });
    socket.once('connect', () => socket.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n\r\n`));
  });
}

test('CONNECT target parser accepts only exact DNS hostnames on port 443', () => {
  assert.deepEqual(parseConnectTarget('registry.npmjs.org:443'), { host: 'registry.npmjs.org', port: 443 });
  assert.deepEqual(parseConnectTarget('CDN.PLAYWRIGHT.DEV.:443'), { host: 'cdn.playwright.dev', port: 443 });
  assert.deepEqual(parseConnectTarget('example.com:443'), { host: 'example.com', port: 443 });
  for (const target of [
    '127.0.0.1:443', '[::1]:443', 'registry.npmjs.org:80',
    'registry.npmjs.org:444', 'registry.npmjs.org:443/path', 'user@registry.npmjs.org:443',
    'registry..npmjs.org:443', 'registry.npmjs.org.:443/path',
  ]) assert.equal(parseConnectTarget(target), null, target);
});

test('reviewed Docker upstream is exact and credential-free', () => {
  assert.deepEqual(validateReviewedUpstream('http.docker.internal:3128'), { host: 'http.docker.internal', port: 3128 });
  for (const upstream of ['proxy.example:3128', 'http.docker.internal:80', 'user@http.docker.internal:3128']) {
    assert.throws(() => validateReviewedUpstream(upstream), /reviewed endpoint/);
  }
});

test('build asset fetches are limited to the exact font and Twemoji CDN hosts', () => {
  assert.ok(CI_EGRESS_HOSTS.includes('fonts.googleapis.com'));
  assert.ok(CI_EGRESS_HOSTS.includes('fonts.gstatic.com'));
  assert.ok(CI_EGRESS_HOSTS.includes('cdn.jsdelivr.net'));
  assert.ok(CI_EGRESS_HOSTS.every((host) => !host.includes('*')));
  assert.equal(CI_EGRESS_HOSTS.includes('googleapis.com'), false);
  assert.equal(CI_EGRESS_HOSTS.includes('gstatic.com'), false);
  assert.equal(CI_EGRESS_HOSTS.includes('jsdelivr.net'), false);
});

function syntheticResponse({ status = 200, headers = {}, body = 'synthetic-font-response' } = {}) {
  const response = new EventEmitter();
  response.statusCode = status;
  response.statusMessage = 'Synthetic';
  response.headers = headers;
  response.destroy = (error) => response.emit('error', error);
  response.deliver = () => {
    if (body) response.emit('data', Buffer.from(body));
    response.emit('end');
  };
  return response;
}

function syntheticHttpsRequest(responses, captured = []) {
  return (url, options, callback) => {
    captured.push({ url: new URL(url), options });
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.destroy = (error) => queueMicrotask(() => request.emit('error', error));
    request.end = () => queueMicrotask(() => {
      const response = responses.shift() ?? syntheticResponse();
      callback(response);
      response.deliver();
    });
    return request;
  };
}

class SyntheticHttpsProxyAgent {
  constructor(proxyUrl) { this.proxyUrl = proxyUrl; }
}

test('Google Fonts adapter sends only exact HTTPS font requests through the reviewed proxy', async () => {
  const captured = [];
  const fetch = googleFontsProxy.createGoogleFontsFetch({
    proxyUrl: 'http://agent-ci-proxy:3128',
    HttpsProxyAgent: SyntheticHttpsProxyAgent,
    httpsRequest: syntheticHttpsRequest([syntheticResponse()], captured),
  });
  const response = await fetch('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'synthetic-font-response');
  assert.equal(captured.length, 1);
  assert.equal(captured[0].options.agent.proxyUrl, 'http://agent-ci-proxy:3128/');
  assert.equal(captured[0].url.hostname, 'fonts.googleapis.com');
  await assert.rejects(fetch('https://example.com/'), /ORIGIN_OR_METHOD_BLOCKED/u);
  await assert.rejects(fetch('http://fonts.googleapis.com/css2'), /ORIGIN_OR_METHOD_BLOCKED/u);
  await assert.rejects(fetch('https://fonts.gstatic.com/file.woff2', { method: 'POST' }), /ORIGIN_OR_METHOD_BLOCKED/u);
  assert.equal(captured.length, 1);
});

test('Google Fonts adapter follows only bounded redirects within the exact font host allowlist', async () => {
  const captured = [];
  const fetch = googleFontsProxy.createGoogleFontsFetch({
    proxyUrl: 'http://agent-ci-proxy:3128',
    HttpsProxyAgent: SyntheticHttpsProxyAgent,
    httpsRequest: syntheticHttpsRequest([
      syntheticResponse({ status: 302, headers: { location: 'https://fonts.gstatic.com/s/font.woff2' }, body: '' }),
      syntheticResponse({ body: 'font' }),
    ], captured),
  });
  const response = await fetch('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai');
  assert.equal(await response.text(), 'font');
  assert.deepEqual(captured.map(({ url }) => url.hostname), ['fonts.googleapis.com', 'fonts.gstatic.com']);

  const blocked = googleFontsProxy.createGoogleFontsFetch({
    proxyUrl: 'http://agent-ci-proxy:3128',
    HttpsProxyAgent: SyntheticHttpsProxyAgent,
    httpsRequest: syntheticHttpsRequest([syntheticResponse({ status: 302, headers: { location: 'https://example.com/' }, body: '' })]),
  });
  await assert.rejects(blocked('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai'), /REDIRECT_ORIGIN_BLOCKED/u);
});

test('Google Fonts adapter bounds response size and validates proxy identity', async () => {
  const fetch = googleFontsProxy.createGoogleFontsFetch({
    proxyUrl: 'http://agent-ci-proxy:3128',
    HttpsProxyAgent: SyntheticHttpsProxyAgent,
    maxResponseBytes: 1024,
    httpsRequest: syntheticHttpsRequest([syntheticResponse({ body: 'x'.repeat(2048) })]),
  });
  await assert.rejects(fetch('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai'), /RESPONSE_TOO_LARGE/u);
  for (const proxyUrl of ['http://example.com:3128', 'https://agent-ci-proxy:3128', 'http://user@agent-ci-proxy:3128']) {
    assert.throws(() => googleFontsProxy.createGoogleFontsFetch({ proxyUrl, HttpsProxyAgent: SyntheticHttpsProxyAgent, httpsRequest: syntheticHttpsRequest([]) }), /PROXY_INVALID/u);
  }
});

test('build asset adapter permits only the pinned Twemoji SVG path on jsDelivr', async () => {
  const captured = [];
  const fetch = googleFontsProxy.createGoogleFontsFetch({
    proxyUrl: 'http://agent-ci-proxy:3128',
    HttpsProxyAgent: SyntheticHttpsProxyAgent,
    httpsRequest: syntheticHttpsRequest([syntheticResponse({ body: '<svg />' })], captured),
  });
  const response = await fetch('https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a1.svg');
  assert.equal(await response.text(), '<svg />');
  assert.equal(captured.length, 1);
  assert.equal(captured[0].url.hostname, 'cdn.jsdelivr.net');
  for (const url of [
    'https://cdn.jsdelivr.net/npm/any-package/file.js',
    'https://cdn.jsdelivr.net/gh/other-owner/repo@1.0.0/assets/svg/26a1.svg',
    'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/26a1.png',
    'https://fonts.gstatic.com/anything.woff2',
  ]) await assert.rejects(fetch(url), /ORIGIN_OR_METHOD_BLOCKED/u);
  assert.equal(captured.length, 1);
});

test('disallowed CONNECT is refused before opening an upstream socket', async () => {
  let upstreamConnections = 0;
  const upstream = net.createServer(() => { upstreamConnections += 1; });
  const upstreamPort = await listen(upstream);
  const proxy = createRestrictedEgressProxyServer({ allowedHosts: ['registry.npmjs.org'], upstreamHost: '127.0.0.1', upstreamPort });
  const proxyPort = await listen(proxy);
  try {
    const result = await connect(proxyPort, 'example.com');
    assert.match(result.response, /^HTTP\/1\.1 403 Forbidden/);
    result.socket.destroy();
    assert.equal(upstreamConnections, 0);
    assert.deepEqual(proxy.metrics(), { allowed: 0, denied: 1, upstreamFailure: 0, clientReset: 0, active: 0 });
  } finally {
    await close(proxy);
    await close(upstream);
  }
});

test('allowlisted CONNECT tunnels bytes without logging or rewriting payloads', async () => {
  const upstream = net.createServer((socket) => {
    let handshake = Buffer.alloc(0);
    const onHandshake = (chunk) => {
      handshake = Buffer.concat([handshake, chunk]);
      const end = handshake.indexOf('\r\n\r\n');
      if (end < 0) return;
      socket.removeListener('data', onHandshake);
      assert.match(handshake.subarray(0, end).toString('latin1'), /^CONNECT registry\.npmjs\.org:443 HTTP\/1\.1/);
      const extra = handshake.subarray(end + 4);
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (extra.length) socket.write(extra);
      socket.on('data', (data) => socket.write(data));
    };
    socket.on('data', onHandshake);
  });
  const upstreamPort = await listen(upstream);
  const proxy = createRestrictedEgressProxyServer({ allowedHosts: ['registry.npmjs.org'], upstreamHost: '127.0.0.1', upstreamPort });
  const proxyPort = await listen(proxy);
  try {
    const result = await connect(proxyPort, 'registry.npmjs.org');
    assert.match(result.response, /^HTTP\/1\.1 200 Connection Established/);
    const reply = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('tunnel response timed out')), 2000);
      result.socket.on('data', (chunk) => {
        const value = chunk.toString('utf8');
        if (value.includes('synthetic')) {
          clearTimeout(timer);
          resolve(value);
        }
      });
    });
    result.socket.write('synthetic');
    assert.equal(await reply, 'synthetic');
    const socketClosed = new Promise((resolve) => result.socket.once('close', resolve));
    result.socket.destroy();
    await socketClosed;
    for (let attempt = 0; attempt < 20 && proxy.metrics().active !== 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(proxy.metrics().allowed, 1);
    assert.equal(proxy.metrics().active, 0);
  } finally {
    await close(proxy);
    await close(upstream);
  }
});

test('proxy survives an upstream ECONNRESET and continues serving allowlisted requests', async () => {
  let accepted = 0;
  const upstream = net.createServer((socket) => {
    socket.once('data', (data) => {
      accepted += 1;
      assert.match(data.toString('latin1'), /^CONNECT registry\.npmjs\.org:443 HTTP\/1\.1/u);
      if (accepted === 1) {
        socket.destroy();
        return;
      }
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      socket.on('data', (value) => socket.write(value));
    });
  });
  const upstreamPort = await listen(upstream);
  const proxy = createRestrictedEgressProxyServer({ allowedHosts: ['registry.npmjs.org'], upstreamHost: '127.0.0.1', upstreamPort, connectTimeoutMs: 1000 });
  const proxyPort = await listen(proxy);
  try {
    const failed = await connect(proxyPort, 'registry.npmjs.org');
    assert.match(failed.response, /^HTTP\/1\.1 502 Bad Gateway/u);
    failed.socket.destroy();

    const recovered = await connect(proxyPort, 'registry.npmjs.org');
    assert.match(recovered.response, /^HTTP\/1\.1 200 Connection Established/u);
    const reply = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('recovered proxy tunnel timed out')), 2000);
      recovered.socket.on('data', (chunk) => {
        const value = chunk.toString('utf8');
        if (value.includes('after-reset')) {
          clearTimeout(timer);
          resolve(value);
        }
      });
    });
    recovered.socket.write('after-reset');
    assert.match(await reply, /after-reset/u);
    const socketClosed = new Promise((resolve) => recovered.socket.once('close', resolve));
    recovered.socket.destroy();
    await socketClosed;
    for (let attempt = 0; attempt < 20 && proxy.metrics().active !== 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(proxy.listening, true);
    assert.equal(proxy.metrics().upstreamFailure, 1);
    assert.equal(proxy.metrics().active, 0);
  } finally {
    await close(proxy);
    await close(upstream);
  }
});

test('proxy survives a client reset before a CONNECT request is parsed', async () => {
  const upstream = net.createServer((socket) => {
    socket.once('data', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      socket.on('data', (value) => socket.write(value));
    });
  });
  const upstreamPort = await listen(upstream);
  const proxy = createRestrictedEgressProxyServer({ allowedHosts: ['registry.npmjs.org'], upstreamHost: '127.0.0.1', upstreamPort });
  const proxyPort = await listen(proxy);
  try {
    const abandoned = net.connect({ host: '127.0.0.1', port: proxyPort });
    abandoned.on('error', () => {});
    await new Promise((resolve, reject) => {
      abandoned.once('connect', resolve);
      abandoned.once('error', reject);
    });
    const abandonedClosed = new Promise((resolve) => abandoned.once('close', resolve));
    abandoned.resetAndDestroy();
    await abandonedClosed;
    for (let attempt = 0; attempt < 20 && proxy.metrics().clientReset === 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(proxy.metrics().clientReset, 1);

    const recovered = await connect(proxyPort, 'registry.npmjs.org');
    assert.match(recovered.response, /^HTTP\/1\.1 200 Connection Established/u);
    const socketClosed = new Promise((resolve) => recovered.socket.once('close', resolve));
    recovered.socket.destroy();
    await socketClosed;
    for (let attempt = 0; attempt < 20 && proxy.metrics().active !== 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(proxy.listening, true);
    assert.equal(proxy.metrics().active, 0);
  } finally {
    await close(proxy);
    await close(upstream);
  }
});

test('non-CONNECT requests are rejected', async () => {
  const proxy = createRestrictedEgressProxyServer({ allowedHosts: ['registry.npmjs.org'] });
  const port = await listen(proxy);
  try {
    const response = await new Promise((resolve, reject) => {
      const request = net.connect({ host: '127.0.0.1', port }, () => request.write('GET https://registry.npmjs.org/ HTTP/1.1\r\nHost: registry.npmjs.org\r\n\r\n'));
      let value = '';
      request.on('data', (chunk) => { value += chunk.toString('latin1'); });
      request.on('end', () => resolve(value));
      request.on('error', reject);
    });
    assert.match(response, /^HTTP\/1\.1 405 Method Not Allowed/);
  } finally {
    await close(proxy);
  }
});
