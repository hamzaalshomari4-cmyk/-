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

## Run locally

```bash
node server.js     # http://localhost:3000
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

### مهم

الفورمات **واجهة فقط** — ما بتبعت بيانات لأي مكان، وأزرار Google و Github ما بتعمل شي.
لما تجهز للتسجيل الحقيقي بدّو:

- backend يخزّن المستخدمين (قاعدة بيانات على Railway)
- تشفير كلمات السر (bcrypt أو argon2) — لا تخزّنها نص عادي أبداً
- جلسات أو JWT، وتحقق من صحة المدخلات على السيرفر مو بس بالمتصفح

قلي لما تجهز وبعملها.

> ملاحظة: في كمان نسخة React + Tailwind v4 من صفحة التسجيل (بملف `aurora-sign-up.zip`)، بس هي بدها build. النسخة يلي هون نفس التصميم بالضبط وبتشتغل بدون build.
