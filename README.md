# Aurora — landing + sign up + log in

One site, one repo, one Railway service. **No build step, no dependencies.**

```
index.html    landing page (hero + features)
signup.html   Aurora sign-up screen
login.html    Aurora log-in screen
auth.css      shared styles for signup + login
auth.js       password visibility toggle + form guard
server.js     static server, Node built-ins only
package.json  start script only
railway.json  Railway config
```

All files sit at the top level — no folders.

## How the pages connect

```
index.html  ──  "Start Free"  ──▶  signup.html
            ──  "Log in"      ──▶  login.html

signup.html ──  "Log in"           ──▶  login.html
login.html  ──  "Create an account"──▶  signup.html
both        ──  logo / Back        ──▶  index.html
```

Clean URLs work too: `/signup` and `/login` resolve to the right page.

## Connecting the chat to OpenAI

The composer on the landing page is live. The browser posts to `/api/chat`, and **the server** calls OpenAI
and streams the reply back word by word. The API key never reaches the browser.

Set these in **Railway → your service → Variables**:

| Variable | Required | Default | What it does |
|---|---|---|---|
| `OPENAI_API_KEY` | yes | — | Your key from platform.openai.com. Server-side only. |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Any chat-completions model your account can use. |
| `SYSTEM_PROMPT` | no | Aurora's default | How the assistant should behave. |
| `RATE_LIMIT` | no | `20` | Max messages per IP per 10 minutes. |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` | For an OpenAI-compatible provider. |

After adding the key, Railway redeploys automatically. Check `/api/health` — it reports
`{"chatConfigured": true}` when the key is loaded.

Without a key the site still works; the chat just answers
"The chat is not configured yet — OPENAI_API_KEY is missing."

### ⚠️ This costs money and the page is public

Anyone who opens your site can send messages that bill your OpenAI account. Before sharing the link:

- Set a **monthly spend limit** in the OpenAI dashboard (Settings → Limits). This is the real protection.
- Keep `RATE_LIMIT` low. It is per IP and resets when the server restarts, so it slows abuse but does not stop a determined attacker.
- Replies are capped at 600 tokens and history at the last 12 messages, to bound the cost per request.
- Never paste the key into any HTML/JS file, and never commit it to GitHub.

## Run locally

```bash
node server.js                          # http://localhost:3000, chat disabled
OPENAI_API_KEY=sk-... node server.js    # with the chat live
```

## Deploy on Railway

1. Upload **all 9 files** to one GitHub repo (top level, no folders).
2. Railway → **New Project → Deploy from GitHub repo**.
3. It runs `node server.js` — no `npm install`, no build, so the deploy cannot fail on dependencies.
4. **Settings → Networking → Generate Domain**.

---

## بالعربي

موقع واحد فيه ٣ صفحات: الصفحة الرئيسية + إنشاء حساب + تسجيل دخول. كلهن مربوطين ببعض.

### النشر

1. ارفع **الملفات التسعة** على ريبو واحد جديد — كلها بمستوى واحد بدون مجلدات.
2. Railway → New Project → Deploy from GitHub repo.
3. Generate Domain من Settings → Networking.

ما في build ولا npm install، فما في احتمال يفشل مثل قبل.

### تعديلات سريعة

- **ألوان صفحات الدخول**: `--brand-gray` بأول `auth.css`.
- **رابط الفيديو**: بملف `signup.html` و `login.html` جوّا وسم `<video>`.
- **نصوص الصفحة الرئيسية**: بـ `index.html` تحت تعليقات `SECTION 1` و `SECTION 2`.
- **الخطوات الثلاث**: `<div class="step ...">` — الخطوة الفعّالة كلاسها `active`.

### تشغيل الشات (OpenAI)

من Railway → الخدمة → **Variables** ضيف:

```
OPENAI_API_KEY = sk-...        (إلزامي)
OPENAI_MODEL   = gpt-4o-mini   (اختياري)
RATE_LIMIT     = 20            (اختياري — رسائل لكل IP كل ١٠ دقايق)
SYSTEM_PROMPT  = ...           (اختياري — شخصية المساعد)
```

Railway بيعيد النشر لحالو. افتح `/api/health` — إذا طلع `"chatConfigured": true` يعني المفتاح انقرأ.

**المفتاح بيضل بالسيرفر بس** — ما بينزل للمتصفح أبداً. لا تحطو بأي ملف HTML أو JS ولا ترفعو على GitHub.

> ⚠️ **الموقع عام وأي حدا بيفتحو بيقدر يستهلك من رصيدك.** قبل ما تنشر الرابط، حدد **سقف صرف شهري** من لوحة OpenAI (Settings → Limits) — هاي الحماية الحقيقية. الـ `RATE_LIMIT` بيبطّئ الاستهلاك بس ما بيمنعو، لأنو بينحسب لكل IP وبينمسح لما السيرفر يعيد التشغيل.

### مهم

الفورمات **واجهة فقط** — ما بتبعت بيانات لأي مكان، وأزرار Google و Github ما بتعمل شي.
لما تجهز للتسجيل الحقيقي بدّو:

- backend يخزّن المستخدمين (قاعدة بيانات على Railway)
- تشفير كلمات السر (bcrypt أو argon2) — لا تخزّنها نص عادي أبداً
- جلسات أو JWT، وتحقق من صحة المدخلات على السيرفر مو بس بالمتصفح

قلي لما تجهز وبعملها.

> ملاحظة: في كمان نسخة React + Tailwind v4 من صفحة التسجيل (بملف `aurora-sign-up.zip`)، بس هي بدها build. النسخة يلي هون نفس التصميم بالضبط وبتشتغل بدون build.
