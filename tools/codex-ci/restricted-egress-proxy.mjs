#!/usr/bin/env node
import http from 'node:http';
import net from 'node:net';
import { isIP } from 'node:net';

export const CI_EGRESS_HOSTS = Object.freeze([
  'registry.npmjs.org',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'binaries.prisma.sh',
  'cdn.playwright.dev',
  'playwright.download.prss.microsoft.com',
  'playwright-akamai.azureedge.net',
  'playwright-verizon.azureedge.net',
]);

export function parseConnectTarget(value) {
  if (typeof value !== 'string' || value.length > 255 || value.includes('@') || value.includes('/') || value.includes('\\')) return null;
  const match = /^([a-z0-9.-]+):([0-9]{1,5})$/i.exec(value);
  if (!match) return null;
  const host = match[1].toLowerCase().replace(/\.$/, '');
  const port = Number(match[2]);
  if (!host || isIP(host) || host.startsWith('.') || host.endsWith('.') || host.includes('..') || port !== 443) return null;
  return { host, port };
}

function parseUpstream(upstream) {
  if (typeof upstream !== 'string' || upstream.length > 255) throw new Error('Invalid CI upstream proxy');
  const match = /^([a-z0-9.-]+):([0-9]{1,5})$/i.exec(upstream);
  if (!match || match[1].toLowerCase() !== 'http.docker.internal' || Number(match[2]) !== 3128) {
    throw new Error('Docker upstream proxy identity is not the reviewed endpoint');
  }
  return { host: match[1], port: Number(match[2]) };
}

export function validateReviewedUpstream(upstream) {
  return parseUpstream(upstream);
}

export function createRestrictedEgressProxyServer({
  allowedHosts = CI_EGRESS_HOSTS,
  upstreamHost = 'http.docker.internal',
  upstreamPort = 3128,
  maxSockets = 32,
  connectTimeoutMs = 10_000,
  idleTimeoutMs = 60_000,
} = {}) {
  const allow = new Set(allowedHosts.map((host) => host.toLowerCase()));
  if (allow.size === 0 || [...allow].some((host) => isIP(host) || !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(host))) {
    throw new Error('Invalid CI egress host allowlist');
  }
  if (!Number.isInteger(maxSockets) || maxSockets < 1 || maxSockets > 128) throw new Error('Invalid CI egress socket bound');
  if (!Number.isInteger(connectTimeoutMs) || connectTimeoutMs < 1000 || connectTimeoutMs > 30_000) throw new Error('Invalid CI egress connect timeout');
  if (!Number.isInteger(idleTimeoutMs) || idleTimeoutMs < 1000 || idleTimeoutMs > 300_000) throw new Error('Invalid CI egress idle timeout');

  const counters = { allowed: 0, denied: 0, upstreamFailure: 0, clientReset: 0, active: 0 };
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/__health') {
      const payload = JSON.stringify({ ready: true, allowlistedHostCount: allow.size, active: counters.active });
      response.writeHead(200, { 'Connection': 'close', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
      response.end(payload);
      return;
    }
    response.writeHead(405, { 'Connection': 'close', 'Content-Length': '0' });
    response.end();
  });

  server.on('connect', (request, client, head) => {
    const target = parseConnectTarget(request.url);
    if (!target || !allow.has(target.host)) {
      counters.denied += 1;
      client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    if (counters.active >= maxSockets) {
      counters.denied += 1;
      client.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }

    counters.allowed += 1;
    counters.active += 1;
    let settled = false;
    let slotReleased = false;
    let responseBuffer = Buffer.alloc(0);
    const upstream = net.connect({ host: upstreamHost, port: upstreamPort });
    const releaseSlot = () => {
      if (slotReleased) return;
      slotReleased = true;
      counters.active = Math.max(0, counters.active - 1);
    };
    let upstreamFailureCounted = false;
    const countUpstreamFailure = () => {
      if (upstreamFailureCounted) return;
      upstreamFailureCounted = true;
      counters.upstreamFailure += 1;
    };
    const closeTunnel = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
      }
      releaseSlot();
      upstream.destroy();
      client.destroy();
    };
    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      releaseSlot();
      client.end(message);
      upstream.destroy();
    };
    const upstreamFailed = () => {
      countUpstreamFailure();
      if (settled) closeTunnel();
      else fail('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    };
    const timer = setTimeout(() => {
      upstreamFailed();
    }, connectTimeoutMs);
    timer.unref();
    upstream.setTimeout(idleTimeoutMs, closeTunnel);
    client.setTimeout(idleTimeoutMs, closeTunnel);
    upstream.on('error', upstreamFailed);
    upstream.once('close', () => {
      if (!settled) upstreamFailed();
      else closeTunnel();
    });
    upstream.once('connect', () => {
      upstream.write(`CONNECT ${target.host}:${target.port} HTTP/1.1\r\nHost: ${target.host}:${target.port}\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
    });
    function onUpstreamData(chunk) {
      if (settled) return;
      responseBuffer = Buffer.concat([responseBuffer, chunk]);
      if (responseBuffer.length > 8192) {
        counters.upstreamFailure += 1;
        fail('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        return;
      }
      const boundary = responseBuffer.indexOf('\r\n\r\n');
      if (boundary < 0) return;
      const statusLine = responseBuffer.subarray(0, boundary).toString('latin1').split('\r\n', 1)[0];
      const status = /^HTTP\/1\.[01] 200(?: |$)/.test(statusLine);
      settled = true;
      clearTimeout(timer);
      if (!status) {
        counters.upstreamFailure += 1;
        releaseSlot();
        client.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        upstream.destroy();
        return;
      }
      upstream.removeListener('data', onUpstreamData);
      client.write('HTTP/1.1 200 Connection Established\r\nProxy-Agent: Codex-Agent-CI\r\n\r\n');
      const extra = responseBuffer.subarray(boundary + 4);
      if (extra.length) client.write(extra);
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
      client.once('close', closeTunnel);
      upstream.once('close', closeTunnel);
    }
    upstream.on('data', onUpstreamData);
    client.on('error', closeTunnel);
    client.once('close', () => {
      if (!settled) closeTunnel();
    });
  });

  server.on('connection', (socket) => {
    socket.on('error', () => {
      counters.clientReset += 1;
      socket.destroy();
    });
    socket.setTimeout(idleTimeoutMs, () => socket.destroy());
  });
  server.on('clientError', (_error, socket) => {
    counters.denied += 1;
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  server.metrics = () => ({ ...counters });
  return server;
}

export function main() {
  const upstream = process.env.AGENT_CI_UPSTREAM_PROXY ?? 'http.docker.internal:3128';
  validateReviewedUpstream(upstream);
  const port = Number(process.env.AGENT_CI_PROXY_PORT ?? '3128');
  if (port !== 3128) throw new Error('Unexpected CI proxy port');
  const server = createRestrictedEgressProxyServer();
  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`${JSON.stringify({ event: 'egress_proxy_started', allowedHostCount: CI_EGRESS_HOSTS.length, port })}\n`);
  });
  const stop = () => {
    server.close(() => {
      process.stdout.write(`${JSON.stringify({ event: 'egress_proxy_stopped', ...server.metrics() })}\n`);
      process.exit(0);
    });
    setTimeout(() => process.exit(2), 5_000).unref();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) main();
