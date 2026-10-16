'use strict';

const https = require('node:https');
const path = require('node:path');
const { createRequire } = require('node:module');
const { URL } = require('node:url');

const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']);
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

function validateProxyUrl(value) {
  let proxy;
  try { proxy = new URL(value); }
  catch { throw new Error('AGENT_CI_GOOGLE_FONTS_PROXY_INVALID'); }
  if (proxy.protocol !== 'http:' || proxy.hostname !== 'agent-ci-proxy' || proxy.port !== '3128'
    || proxy.username || proxy.password || proxy.pathname !== '/' || proxy.search || proxy.hash) {
    throw new Error('AGENT_CI_GOOGLE_FONTS_PROXY_INVALID');
  }
  return proxy.toString();
}

function isAllowedAssetUrl(url) {
  if (url.hostname === 'fonts.googleapis.com') return ['/css', '/css2'].includes(url.pathname);
  if (url.hostname === 'fonts.gstatic.com') return url.pathname.startsWith('/s/') && /\.(?:woff2?|ttf|otf)$/iu.test(url.pathname);
  if (url.hostname === 'cdn.jsdelivr.net') {
    return !url.search && /^\/gh\/twitter\/twemoji@14\.0\.2\/assets\/svg\/[0-9a-f-]{1,64}\.svg$/u.test(url.pathname);
  }
  return false;
}

function requestParts(input, init) {
  const requestLike = input && typeof input === 'object' && typeof input.url === 'string' ? input : null;
  const rawUrl = requestLike ? requestLike.url : input;
  let url;
  try { url = new URL(rawUrl); }
  catch { throw new TypeError('AGENT_CI_FETCH_URL_INVALID'); }
  const method = String(init.method ?? requestLike?.method ?? 'GET').toUpperCase();
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || !isAllowedAssetUrl(url) || url.username || url.password
    || !['GET', 'HEAD'].includes(method) || init.body != null) {
    throw new TypeError('AGENT_CI_FETCH_ORIGIN_OR_METHOD_BLOCKED');
  }
  const headers = new Headers(init.headers ?? requestLike?.headers);
  return { url, method, headers, redirect: init.redirect ?? requestLike?.redirect ?? 'follow', signal: init.signal ?? requestLike?.signal };
}

function readResponse(response, { method, maxBytes = MAX_RESPONSE_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const status = Number(response.statusCode);
    const headers = new Headers(response.headers ?? {});
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(value);
    };
    response.on('data', (chunk) => {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        const error = new Error('AGENT_CI_FETCH_RESPONSE_TOO_LARGE');
        response.destroy(error);
        finish(error);
        return;
      }
      chunks.push(buffer);
    });
    response.once('error', (error) => finish(error));
    response.once('end', () => {
      if (!Number.isInteger(status) || status < 200 || status > 599) {
        finish(new Error('AGENT_CI_FETCH_RESPONSE_INVALID'));
        return;
      }
      const bodylessStatus = [204, 205, 304].includes(status);
      const body = method === 'HEAD' || bodylessStatus ? null : Buffer.concat(chunks);
      finish(null, new Response(body, { status, statusText: response.statusMessage, headers }));
    });
  });
}

function createGoogleFontsFetch({ proxyUrl, HttpsProxyAgent, httpsRequest = https.request, maxResponseBytes = MAX_RESPONSE_BYTES, requestTimeoutMs = REQUEST_TIMEOUT_MS }) {
  const safeProxyUrl = validateProxyUrl(proxyUrl);
  if (typeof HttpsProxyAgent !== 'function'
    || !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1024 || maxResponseBytes > MAX_RESPONSE_BYTES
    || !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1000 || requestTimeoutMs > REQUEST_TIMEOUT_MS) {
    throw new Error('AGENT_CI_GOOGLE_FONTS_PROXY_CONFIG_INVALID');
  }
  const agent = new HttpsProxyAgent(safeProxyUrl);

  const perform = async (url, method, headers, signal, redirect, redirects = 0) => {
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError');
    const response = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value);
      };
      const request = httpsRequest(url, {
        method,
        headers: Object.fromEntries(headers.entries()),
        agent,
      }, (incoming) => { void readResponse(incoming, { method, maxBytes: maxResponseBytes }).then((value) => finish(null, value), (error) => finish(error)); });
      const abort = () => request.destroy(new DOMException('The operation was aborted', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      request.setTimeout(requestTimeoutMs, () => request.destroy(new Error('AGENT_CI_FETCH_TIMEOUT')));
      request.once('error', (error) => finish(error));
      request.end();
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirect === 'manual') return response;
      if (redirect === 'error' || redirects >= MAX_REDIRECTS) {
        throw new TypeError('AGENT_CI_FETCH_REDIRECT_BLOCKED');
      }
      const nextUrl = new URL(location, url);
      if (nextUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(nextUrl.hostname) || !isAllowedAssetUrl(nextUrl) || nextUrl.username || nextUrl.password) {
        throw new TypeError('AGENT_CI_FETCH_REDIRECT_ORIGIN_BLOCKED');
      }
      return perform(nextUrl, method, headers, signal, redirect, redirects + 1);
    }
    return response;
  };

  return async function restrictedGoogleFontsFetch(input, init = {}) {
    const { url, method, headers, redirect, signal } = requestParts(input, init);
    return perform(url, method, headers, signal, redirect);
  };
}

function installGoogleFontsFetchProxy({ env = process.env, globalObject = globalThis } = {}) {
  const proxyUrl = validateProxyUrl(env.HTTPS_PROXY ?? '');
  let packageRequire;
  try { packageRequire = createRequire(path.join(process.cwd(), 'package.json')); }
  catch { throw new Error('AGENT_CI_GOOGLE_FONTS_PROXY_DEPENDENCY_UNAVAILABLE'); }
  let exported;
  try { exported = packageRequire('https-proxy-agent'); }
  catch { throw new Error('AGENT_CI_GOOGLE_FONTS_PROXY_DEPENDENCY_UNAVAILABLE'); }
  const HttpsProxyAgent = exported.HttpsProxyAgent ?? exported;
  globalObject.fetch = createGoogleFontsFetch({ proxyUrl, HttpsProxyAgent });
}

module.exports = { ALLOWED_HOSTS, createGoogleFontsFetch, installGoogleFontsFetchProxy, isAllowedAssetUrl, validateProxyUrl };

if (process.env.CODEX_AGENT_CI_BUILD_ASSET_PROXY === '1') installGoogleFontsFetchProxy();
