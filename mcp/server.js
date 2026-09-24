#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const FormData = require('form-data');
const { io } = require('socket.io-client');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const SERVER_MAX_BYTES = 100 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_RECEIVERS = 32;
const RECEIVE_LEASE_MS = 30 * 60 * 1000;
const parsedBaseUrl = new URL(process.env.FILESENDER_URL || 'http://localhost:3000');
if (!['http:', 'https:'].includes(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password || parsedBaseUrl.pathname !== '/' || parsedBaseUrl.search || parsedBaseUrl.hash) {
  throw new Error('FILESENDER_URL must be an HTTP or HTTPS origin without a path, query, or credentials');
}
const BASE_URL = parsedBaseUrl.origin;
const MAX_BYTES = Number(process.env.FILESENDER_MAX_TOTAL_BYTES || SERVER_MAX_BYTES);
if (!Number.isSafeInteger(MAX_BYTES) || MAX_BYTES < 1 || MAX_BYTES > SERVER_MAX_BYTES) {
  throw new Error(`FILESENDER_MAX_TOTAL_BYTES must be an integer from 1 to ${SERVER_MAX_BYTES}`);
}
const READ_ROOTS = rootsFromEnv('FILESENDER_READ_DIRS');
const WRITE_ROOTS = rootsFromEnv('FILESENDER_WRITE_DIRS');
const receivers = new Map();
let pendingReceives = 0;

function rootsFromEnv(name) {
  return (process.env[name] || '').split(path.delimiter).map((p) => p.trim()).filter(Boolean).map((p) => path.resolve(p));
}

function within(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function assertAllowedExisting(input, roots, kind) {
  if (!roots.length) throw new Error(`${kind} directories are not configured`);
  const resolved = await fsp.realpath(path.resolve(input));
  const allowed = await Promise.all(roots.map(async (root) => {
    try { return within(resolved, await fsp.realpath(root)); } catch { return false; }
  }));
  if (!allowed.some(Boolean)) throw new Error(`Path is outside configured ${kind} directories`);
  return resolved;
}

async function outputDirectory(input) {
  if (!WRITE_ROOTS.length) throw new Error('FILESENDER_WRITE_DIRS is not configured');
  const requested = path.resolve(input || WRITE_ROOTS[0]);
  const rootPaths = await Promise.all(WRITE_ROOTS.map(async (root) => {
    const real = await fsp.realpath(root);
    const stat = await fsp.stat(real);
    if (!stat.isDirectory()) throw new Error(`Configured write root is not a directory: ${root}`);
    return real;
  }));
  const lexicalRoots = WRITE_ROOTS.map((root) => path.resolve(root));
  if (!lexicalRoots.some((root) => within(requested, root))) throw new Error('Output directory is outside configured write directories');

  // Check the nearest existing ancestor before mkdir(recursive) can follow any
  // existing symlink in the requested path.
  let ancestor = requested;
  while (true) {
    try {
      const actualAncestor = await fsp.realpath(ancestor);
      if (!rootPaths.some((root) => within(actualAncestor, root))) {
        throw new Error('Output directory resolves outside configured write directories');
      }
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw new Error('Could not validate output directory path');
      ancestor = parent;
    }
  }
  await fsp.mkdir(requested, { recursive: true });
  const actual = await fsp.realpath(requested);
  if (!rootPaths.some((root) => within(actual, root))) throw new Error('Output directory resolves outside configured write directories');
  return actual;
}

function socketConnect(url) {
  return new Promise((resolve, reject) => {
    // A free Render service can take about a minute to wake. Retry failed
    // handshakes until it is ready, but keep the overall wait bounded.
    const socket = io(url, { autoConnect: false, reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, timeout: 15000, transports: ['websocket', 'polling'] });
    let lastError;
    const onConnectError = (err) => { lastError = err; };
    const timer = setTimeout(() => { socket.off('connect_error', onConnectError); socket.close(); reject(new Error(`Socket connection timed out${lastError ? `: ${lastError.message}` : ''}`)); }, 90000);
    socket.once('connect', () => { clearTimeout(timer); socket.off('connect_error', onConnectError); resolve(socket); });
    socket.on('connect_error', onConnectError);
    socket.connect();
  });
}

function awaitSocketEvent(socket, eventName, timeoutMs = 15000, failEvent = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { clean(); reject(new Error(`Timed out waiting for ${eventName}`)); }, timeoutMs);
    const onError = (data) => { clean(); reject(new Error(data && data.message || 'FileSender transfer failed')); };
    const onDisconnect = () => { clean(); reject(new Error('Socket disconnected during transfer')); };
    const onFailure = () => { clean(); reject(new Error('Emoji verification failed')); };
    function clean() { clearTimeout(timer); socket.off(eventName, onEvent); socket.off('error', onError); socket.off('connect_error', onError); socket.off('disconnect', onDisconnect); if (failEvent) socket.off(failEvent, onFailure); }
    function onEvent(data) { clean(); resolve(data); }
    socket.once(eventName, onEvent);
    socket.once('error', onError);
    socket.once('connect_error', onError);
    socket.once('disconnect', onDisconnect);
    if (failEvent) socket.once(failEvent, onFailure);
  });
}

async function readLimitedText(stream, maxBytes = MAX_RESPONSE_BYTES) {
  if (!stream) return '';
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('FileSender response exceeds size limit');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, bytes).toString('utf8');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: options.signal || AbortSignal.timeout(30000) });
  const body = await readLimitedText(response.body);
  if (!response.ok) throw new Error(`FileSender returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  return JSON.parse(body);
}

async function upload(fields, files = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const streams = [];
  let uploadedBytes = 0;
  for (const file of files) {
    const source = file.handle.createReadStream({ autoClose: false });
    const limit = new Transform({ transform(chunk, encoding, callback) {
      uploadedBytes += chunk.length;
      callback(uploadedBytes > MAX_BYTES ? new Error('Selected files exceed transfer size limit') : null, chunk);
    } });
    streams.push(source, limit);
    form.append('files', source.pipe(limit), { filename: path.basename(file.path), knownLength: file.size });
  }
  const target = new URL('/upload', BASE_URL);
  const transport = target.protocol === 'https:' ? https : http;
  let request;
  try {
    const response = await new Promise((resolve, reject) => {
      const req = transport.request(target, { method: 'POST', headers: form.getHeaders() }, (res) => resolve(res));
      request = req;
      req.setTimeout(120000, () => req.destroy(new Error('Upload timed out')));
      req.once('error', reject);
      form.once('error', (error) => req.destroy(error));
      for (const stream of streams) stream.once('error', (error) => req.destroy(error));
      form.pipe(req);
    });
    const data = await readLimitedText(response);
    if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`FileSender returned HTTP ${response.statusCode}: ${data.slice(0, 500)}`);
    const result = JSON.parse(data);
    if (!/^\d{4}$/.test(result.code) || !/^[A-Za-z0-9_-]{43}$/.test(result.senderToken) || typeof result.emoji !== 'string' || !result.emoji || result.emoji.length > 32) {
      throw new Error('Upload response is missing a valid code, emoji, or senderToken');
    }
    return result;
  } finally {
    request?.destroy();
    for (const stream of streams) stream.destroy();
  }
}

function textResult(value) { return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] }; }

const server = new McpServer({ name: 'filesender', version: '0.1.0' }, {
  instructions: 'FileSender send tools return a four-digit code and emoji; share both with the intended receiver. The receiver must claim within 5 minutes. receive_transfer returns text or saved file paths plus a receiverHandle. After confirming receipt, call finish_transfer with that handle. Finish within 30 minutes of claiming. File paths must stay inside the configured read or write directories.'
});

server.tool('send_text', 'Send text through FileSender. Share the returned code and emoji with the receiver within 5 minutes.', {
  text: z.string().min(1).max(1000000)
}, async ({ text }) => {
  if (Buffer.byteLength(text) > Math.min(MAX_BYTES, MAX_TEXT_BYTES)) throw new Error('Text exceeds configured transfer size limit');
  const result = await upload({ type: 'text', text });
  return textResult({ code: result.code, emoji: result.emoji, expiresAt: result.expiresAt });
});

server.tool('send_files', 'Send local files inside FILESENDER_READ_DIRS. Share the returned code and emoji with the receiver within 5 minutes.', {
  paths: z.array(z.string().min(1)).min(1).max(100)
}, async ({ paths }) => {
  const files = [];
  let total = 0;
  try {
    for (const input of paths) {
      const fullPath = await assertAllowedExisting(input, READ_ROOTS, 'read');
      const handle = await fsp.open(fullPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) throw new Error(`Not a regular file: ${input}`);
        // Recheck the path and inode after opening so a changed file is rejected.
        const currentPath = await assertAllowedExisting(fullPath, READ_ROOTS, 'read');
        const currentStat = await fsp.stat(currentPath);
        if (stat.dev !== currentStat.dev || stat.ino !== currentStat.ino) throw new Error(`File changed during validation: ${input}`);
        total += stat.size;
        if (total > MAX_BYTES) throw new Error(`Selected files exceed the ${MAX_BYTES} byte transfer limit`);
        files.push({ path: fullPath, size: stat.size, handle });
      } catch (error) {
        await handle.close();
        throw error;
      }
    }
    const result = await upload({ type: 'file' }, files);
    return textResult({ code: result.code, emoji: result.emoji, expiresAt: result.expiresAt });
  } finally {
    await Promise.all(files.map((file) => file.handle.close().catch(() => {})));
  }
});

server.tool('receive_transfer', 'Claim a transfer with its code and matching emoji. Return text or save files in FILESENDER_WRITE_DIRS, then call finish_transfer with the returned receiverHandle.', {
  code: z.string().regex(/^\d{4}$/),
  emoji: z.string().min(1).max(32),
  outputDirectory: z.string().optional()
}, async ({ code, emoji, outputDirectory: outputInput }) => {
  if (receivers.size + pendingReceives >= MAX_RECEIVERS) throw new Error('Too many active receives');
  pendingReceives += 1;
  let socket;
  const createdPaths = [];
  try {
    socket = await socketConnect(BASE_URL);
    const verification = awaitSocketEvent(socket, 'verification-options');
    socket.emit('join-receiver', code);
    await verification;
    const approval = awaitSocketEvent(socket, 'transfer-approved', 15000, 'verification-failed');
    socket.emit('verify-emoji', { code, emoji });
    const grant = await approval;
    if (!grant || typeof grant.receiverToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(grant.receiverToken)) throw new Error('Approval response is missing a valid receiverToken');
    const leaseExpiresAt = Number(grant.expiresAt);
    if (!Number.isFinite(leaseExpiresAt) || leaseExpiresAt <= Date.now()) throw new Error('Approval response has no valid expiry');
    const expiresAt = Math.min(leaseExpiresAt, Date.now() + RECEIVE_LEASE_MS);
    const headers = { Authorization: `Bearer ${grant.receiverToken}` };
    const metadata = await requestJson(new URL(`/session/${encodeURIComponent(code)}/metadata`, BASE_URL), { headers });
    let savedPaths = [];
    let text = undefined;
    if (metadata.type === 'text') {
      text = metadata.text;
      if (typeof text !== 'string') throw new Error('Text transfer metadata is missing text');
      if (Buffer.byteLength(text) > Math.min(MAX_BYTES, MAX_TEXT_BYTES)) throw new Error('Text exceeds configured transfer size limit');
    } else if (metadata.type === 'file') {
      const destination = await outputDirectory(outputInput);
      if (!Array.isArray(metadata.files) || metadata.files.length === 0 || metadata.files.length > 100) throw new Error('Transfer has an invalid file count');
      if (!metadata.files.every((file) => file && Number.isSafeInteger(file.size) && file.size >= 0 && Number.isSafeInteger(file.index) && file.index >= 0)) {
        throw new Error('Transfer has invalid file metadata');
      }
      const totalSize = metadata.files.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > MAX_BYTES) throw new Error('Transfer exceeds configured size limit');
      const used = new Set();
      let downloadedBytes = 0;
      for (const file of metadata.files) {
        const safeName = safeDownloadName(file.name);
        let name = safeName;
        let suffix = 1;
        while (used.has(name) || await exists(path.join(destination, name))) {
          const ext = path.extname(safeName);
          name = `${path.basename(safeName, ext)}-${suffix++}${ext}`;
        }
        used.add(name);
        const target = path.join(destination, name);
        downloadedBytes += await downloadToFile(new URL(`/download/${encodeURIComponent(code)}?index=${encodeURIComponent(file.index)}`, BASE_URL), headers, target, MAX_BYTES - downloadedBytes, expiresAt);
        savedPaths.push(target);
        createdPaths.push(target);
      }
    } else throw new Error(`Unsupported transfer type: ${metadata.type}`);
    const receiverHandle = crypto.randomBytes(24).toString('base64url');
    const timeout = setTimeout(() => closeReceiver(receiverHandle), Math.max(0, expiresAt - Date.now()));
    timeout.unref?.();
    receivers.set(receiverHandle, { code, socket, timeout });
    return textResult({ receiverHandle, savedPaths, ...(text !== undefined ? { text } : {}) });
  } catch (error) {
    socket?.close();
    await Promise.all(createdPaths.map((file) => fsp.rm(file, { force: true }).catch(() => {})));
    throw error;
  } finally {
    pendingReceives -= 1;
  }
});

server.tool('finish_transfer', 'Confirm receipt with the receiverHandle from receive_transfer after reading the text or saving the files.', {
  receiverHandle: z.string().min(1)
}, async ({ receiverHandle }) => {
  const receiver = receivers.get(receiverHandle);
  if (!receiver) throw new Error('Unknown or expired receiverHandle');
  try {
    const acknowledgement = await receiver.socket.timeout(10000).emitWithAck('complete-session', receiver.code);
    if (!acknowledgement || acknowledgement.finished !== true) {
      throw new Error(acknowledgement && acknowledgement.error || 'Transfer unavailable');
    }
  } catch (error) {
    throw new Error(`Could not confirm transfer completion: ${error.message}`);
  }
  closeReceiver(receiverHandle);
  return textResult({ finished: true });
});

async function exists(file) { try { await fsp.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }

function safeDownloadName(value) {
  const raw = String(value || 'file').replace(/\\/g, '/');
  const name = path.posix.basename(raw).replace(/[<>:"|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '_').replace(/[. ]+$/g, '_');
  if (!name || name === '.' || name === '..') return 'file';
  let safe = '';
  for (const character of name) {
    if (Buffer.byteLength(safe + character) > 200) break;
    safe += character;
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = `_${safe}`;
  return safe || 'file';
}

async function downloadToFile(url, headers, destination, maxBytes, expiresAt) {
  const deadline = Number(expiresAt);
  const timeoutMs = Number.isFinite(deadline) ? Math.max(1000, deadline - Date.now()) : 30 * 60 * 1000;
  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}: ${(await readLimitedText(response.body)).slice(0, 300)}`);
  const headerSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(headerSize) && headerSize > maxBytes) throw new Error('Downloaded file exceeds configured size limit');
  const temp = path.join(path.dirname(destination), `.filesender-${crypto.randomBytes(12).toString('hex')}.tmp`);
  let bytes = 0;
  let linked = false;
  const limit = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    callback(bytes > maxBytes ? new Error('Downloaded file exceeds configured size limit') : null, chunk);
  } });
  try {
    await pipeline(response.body, limit, fs.createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
    await fsp.link(temp, destination);
    linked = true;
    await fsp.rm(temp, { force: true });
    return bytes;
  } catch (error) {
    await fsp.rm(temp, { force: true }).catch(() => {});
    if (linked) await fsp.rm(destination, { force: true }).catch(() => {});
    throw error;
  }
}

function closeReceiver(handle) {
  const receiver = receivers.get(handle);
  if (!receiver) return;
  receivers.delete(handle);
  clearTimeout(receiver.timeout);
  receiver.socket.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
async function shutdown() {
  for (const handle of receivers.keys()) closeReceiver(handle);
  await server.close().catch(() => {});
  process.exit(0);
}

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})().catch((error) => {
  // MCP stdio reserves stdout for protocol traffic.
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
