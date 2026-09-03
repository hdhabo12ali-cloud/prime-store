# Prime Store — دليل التشغيل

## 🆕 إضافات جديدة (اقرأ هذا الجزء الأول)
1. **الخطط (Plans)** — قسم جديد بالموقع فيه 3 خطط اشتراك بأسعار، تدار من لوحة التحكم -> "الخطط (Plans)".
2. **الشعارات (Banners)** — شريط بنرات ترويجية تحت الهيدر مباشرة، يدار من لوحة التحكم -> "الشعارات (Banners)".
3. **صفحة /docs** — صفحة عامة (`https://yourdomain.com/docs`) مخصصة لأصحاب الخطط: يدخل العميل مفتاح API (تولّده له من لوحة التحكم -> "API والبوت") ويشوف توثيق الـ endpoints مع أمثلة كود جاهزة.
4. **حماية "خاص بالبرنامج فقط" (Edge Function)** — لو حطيت `DESKTOP_APP_SECRET` بمتغيرات البيئة، الموقع يرفض أي طلب يجي من متصفح عادي (يطلع 403)، ويشتغل بس لما يجي الطلب من برنامج سطح المكتب (لأنه يرسل نفس السر بهيدر `x-app-key` مع كل طلب — شوف `main.js` بمشروع prime-store-desktop). لو تركته فاضي، الموقع يشتغل عادي بالمتصفح بدون هالحماية.

**قبل ما تشتغل، شغّل ملف `supabase-migration-plans-banners.sql` مرة وحدة من Supabase Dashboard -> SQL Editor** عشان يضيف جدولي `plans` و`banners` (فيهم 3 خطط تجريبية جاهزة تقدر تعدلها).

⚠️ **أداة بناء المواقع بدون كود (Website Builder) مو موجودة بهذي النسخة** — اتفقنا نأجلها كمرحلة منفصلة لضخامتها.

---

# Prime Store — دليل التشغيل

المشروع كامل: موقع رئيسي + لوحة تحكم + باك إند حقيقي (Netlify Functions + Supabase).

## 1) تجهيز Supabase
مشروع Supabase جاهز فعلًا (اسمه `prime-store`) وقاعدة البيانات مبنية بكل الجداول.

روح لوحة Supabase → مشروعك → **Project Settings → API** وخذ:
- **Project URL** (تحطه في `SUPABASE_URL`)
- **service_role key** (سري جدًا — لا ترفعه لأي مكان عام، تحطه في `SUPABASE_SERVICE_ROLE_KEY`)

## 2) تجهيز تطبيق Discord (لتسجيل دخول الأدمن)
1. روح [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**.
2. من تبويب **OAuth2 → General** خذ **Client ID** و **Client Secret** — حطهم بـ `DISCORD_CLIENT_ID` و `DISCORD_CLIENT_SECRET`.
3. بنفس الصفحة تحت **Redirects** ضيف **الرابطين** (لوكل + الدومين الحقيقي)، لأن السيرفر يبني رابط الرجوع تلقائيًا من نفس الدومين اللي تفتح منه لوحة التحكم:
   - `http://localhost:3000/admin/api/auth/discord/callback`
   - `https://yourdomain.com/admin/api/auth/discord/callback` (بدّل بدومينك الحقيقي)
4. عشان تعرف آيدي حسابك بديسكورد: فعّل **Developer Mode** من إعدادات ديسكورد → المظهر المتقدم، بعدين يمين كليك على اسمك → **Copy User ID**.
5. حط آيديك (وأي أدمن ثاني) بمتغير `ADMIN_DISCORD_IDS`، افصل بينهم بفاصلة لو أكثر من وحد:
   ```
   ADMIN_DISCORD_IDS=123456789012345678,987654321098765432
   ```
   فقط هالحسابات تقدر تسجّل دخول للوحة التحكم — أي حساب ديسكورد ثاني يرفضه السيرفر حتى لو سجّل دخول ناجح بديسكورد نفسه.

## 3) مفتاح Gemini (لتشغيل المساعد الذكي AI)
روح [aistudio.google.com/apikey](https://aistudio.google.com/apikey) وسوي مفتاح، وحطه في `GEMINI_API_KEY`.
`GEMINI_MODEL` اختياري (افتراضيًا `gemini-3.7-flash`) — غيّره لو تبي موديل ثاني متاح لحسابك.

## 4) تجهيز متغيرات البيئة محليًا
```bash
cp .env.example .env   # أو استخدم .env الموجود
```
عبّي القيم داخل `.env`:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` — أي نص عشوائي طويل، مثلاً شغّل: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`
- `ADMIN_DISCORD_IDS`
- `GEMINI_API_KEY` (و`GEMINI_MODEL` اختياري)

## 5) تشغيل محلي
```bash
npm install
npm start
```
افتح `http://localhost:3000/admin` واضغط **تسجيل الدخول عبر Discord**.

## 6) الرفع على Netlify
- اربط المستودع (أو اسحب مجلد المشروع) بـ Netlify، أو استخدم Netlify CLI:
  ```bash
  npm install -g netlify-cli
  netlify deploy --prod
  ```
- من **Site settings → Environment variables** حط بالضبط نفس متغيرات `.env` (بدون رفع ملف `.env` نفسه — هو موجود بـ `.gitignore`).
- Netlify يقرأ `netlify.toml` تلقائيًا (فيه إعداد الـ publish directory والـ functions والـ redirects).
- تأكد إن رابط `https://yourdomain.com/admin/api/auth/discord/callback` مضاف بتطبيق Discord (خطوة 2).

## 7) الدخول للوحة التحكم
افتح `https://yourdomain.com/admin` وسجّل دخول بحساب الديسكورد المضاف بـ `ADMIN_DISCORD_IDS`.

من فيها تقدر:
- تضيف/تعدّل/تحذف **باكجات** و**منتجات** — تنعكس فورًا على الموقع الرئيسي (`catalog.js` صار يتولّد حي من قاعدة البيانات).
- تدير قسم **مجاني (Free)** — بوتات مجانية بصور، فيديو، ورابط تحميل مباشر، تظهر تلقائيًا بقسم جديد بالموقع.
- تولّد/تلغي **مفاتيح API** لبوتات خارجية (endpoints: `GET /api/bot/catalog`, `/api/bot/settings`, `/api/bot/free` مع هيدر `x-api-key`).
- تفعّل **المساعد الذكي (AI)** — حدد رمز وصول وتعليمات النظام، والمساعد يرد فعليًا عبر Gemini API (endpoint: `POST /api/ai/chat`).
- تغيّر اسم الموقع ورابط الديسكورد.

## بنية المشروع
```
public/                 → كل ما ينشر على Netlify (الموقع + لوحة التحكم)
  index.html/app.js/styles.css   → الموقع الرئيسي
  admin/                          → لوحة التحكم
netlify/functions/       → الباك إند (Node.js)
  admin-api.js            → كل عمليات لوحة التحكم + تسجيل الدخول عبر Discord OAuth
  public-api.js            → بيانات عامة للموقع + endpoints البوتات (بمفتاح API)
  catalog-js.js            → يولّد /catalog.js حي من قاعدة البيانات
  ai-chat.js                → المساعد البرمجي الذكي (Gemini)
  lib/auth.js               → جلسات الأدمن (JWT بكوكيز httpOnly) + كوكيز الحماية أثناء OAuth
```

## ملاحظات أمان
- تسجيل الدخول عبر Discord OAuth فقط — ما فيه كلمات مرور تُخزّن أو تُسرّب.
- الدخول محصور بقائمة `ADMIN_DISCORD_IDS` — أي حساب ديسكورد مو بالقائمة يرفضه السيرفر حتى لو سجّل دخول بنجاح بديسكورد.
- الجلسة محمية بكوكيز `httpOnly` موقّعة بـ JWT — ما تقدر تُسرق من الـ JS بالمتصفح، و`secure` تلقائيًا فوق https بالإنتاج بينما تشتغل بدونها محليًا على http.
- `service_role key` و`DISCORD_CLIENT_SECRET` و`GEMINI_API_KEY` لازم يبقون بس بمتغيرات بيئة Netlify — أبدًا ما يُكتبون بأي ملف يترفع.
- ودّي أذكرك: المساعد الذكي (AI) لو فعّلته بدون رمز وصول، أي شخص بالإنترنت يقدر يستخدمه ويستهلك رصيد Gemini API — يفضل تحط رمز وصول وتعطيه بس لعملائك بعد الشراء.
