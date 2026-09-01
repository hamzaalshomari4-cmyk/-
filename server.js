/**
 * Aurora — static server + OpenAI chat proxy.
 * Node built-ins only: no npm install, no build step.
 * Railway runs: node server.js
 *
 * Environment variables (set these in Railway → Variables):
 *   OPENAI_API_KEY   required for the chat to work. Never goes to the browser.
 *   OPENAI_MODEL     optional, default "gpt-4o-mini"
 *   OPENAI_BASE_URL  optional, default "https://api.openai.com/v1"
 *   SYSTEM_PROMPT    optional, how the assistant should behave
 *   RATE_LIMIT       optional, max messages per IP per 10 minutes (default 20)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  'You are Aurora, an AI workspace that structures reasoning. Be concise and concrete. ' +
    'When a question involves a decision or trade-off, lay out the dimensions that matter before giving a view. ' +
    'Answer in the language the user writes in.';

/* --------------------------------------------------------------- limits */
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 20); // messages per IP
const RATE_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes
const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGES = 12;
const MAX_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 600;

const hits = new Map(); // ip -> { count, resetAt }

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) if (now > entry.resetAt) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

/* ---------------------------------------------------------- static files */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res, urlPath) {
  let filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) filePath = path.join(ROOT, 'index.html');

  if (urlPath === '/') {
    filePath = path.join(ROOT, 'index.html');
  } else if (!path.extname(filePath)) {
    const withHtml = filePath.replace(/\/+$/, '') + '.html';
    filePath = fs.existsSync(withHtml) ? withHtml : path.join(ROOT, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (e2, fallback) => {
        if (e2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': TYPES['.html'] });
        res.end(fallback);
      });
      return;
    }

    const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

/* ------------------------------------------------------------- chat API */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return null;

  const cleaned = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .filter((m) => m.content.trim().length > 0);

  return cleaned.length ? cleaned : null;
}

async function handleChat(req, res) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  if (rateLimited(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Too many messages. Try again in a few minutes.' }));
    return;
  }

  if (!OPENAI_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'The chat is not configured yet — OPENAI_API_KEY is missing.' }));
    return;
  }

  let messages;
  try {
    const body = JSON.parse(await readBody(req));
    messages = sanitizeMessages(body.messages);
  } catch {
    messages = null;
  }

  if (!messages) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Invalid request.' }));
    return;
  }

  let upstream;
  try {
    upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    });
  } catch (err) {
    console.error('OpenAI request failed:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Could not reach the model.' }));
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('OpenAI error', upstream.status, detail.slice(0, 500));
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error:
          upstream.status === 401
            ? 'The API key was rejected.'
            : upstream.status === 429
              ? 'The model is rate limited or out of quota.'
              : `The model returned an error (${upstream.status}).`,
      })
    );
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let closed = false;

  req.on('close', () => {
    closed = true;
    reader.cancel().catch(() => {});
  });

  try {
    while (!closed) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let index;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);

        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) sseWrite(res, { t: text });
        } catch {
          /* ignore keep-alive or partial frames */
        }
      }
    }
  } catch (err) {
    console.error('Stream error:', err.message);
    if (!closed) sseWrite(res, { error: 'The reply was interrupted.' });
  }

  if (!closed) {
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

/* ---------------------------------------------------------------- server */
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (urlPath === '/api/chat') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Use POST.' }));
      return;
    }
    handleChat(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Server error.' }));
      } else {
        res.end();
      }
    });
    return;
  }

  if (urlPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, chatConfigured: Boolean(OPENAI_API_KEY), model: OPENAI_MODEL }));
    return;
  }

  serveStatic(req, res, urlPath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving on http://0.0.0.0:${PORT}`);
  console.log(`Chat: ${OPENAI_API_KEY ? `enabled (${OPENAI_MODEL})` : 'disabled — set OPENAI_API_KEY'}`);
});
