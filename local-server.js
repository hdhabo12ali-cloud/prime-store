"use strict";
/**
 * سيرفر يشغّل نفس منطق الباك إند (نفس الكود المستخدم بـ Netlify Functions)
 * يشتغل محليًا على جهازك (npm start) أو مستضاف على Render.com بدون أي تعديل إضافي.
 */
require("dotenv").config();
const path = require("path");
const express = require("express");

const adminApi = require("./netlify/functions/admin-api");
const publicApi = require("./netlify/functions/public-api");
const catalogJs = require("./netlify/functions/catalog-js");
const aiChat = require("./netlify/functions/ai-chat");
const userAuth = require("./netlify/functions/user-auth");
const memberApi = require("./netlify/functions/member-api");

const app = express();
app.set("trust proxy", true); // ضروري خلف بروكسي Render عشان https/الكوكيز يشتغلوا صح
app.use(express.json({ limit: "2mb" }));

// ============================================================
// حماية "خاص بالبرنامج فقط" — نفس فكرة app-gate.js لكن كـ Express middleware
// (على Netlify كانت Edge Function، وهنا نسويها بنفس المنطق).
// ============================================================
app.use((req, res, next) => {
  const secret = process.env.DESKTOP_APP_SECRET;
  if (!secret) return next(); // ما فيه سر مضبوط = الموقع مفتوح عادي
  if (req.headers["x-app-key"] === secret) return next();
  res
    .status(403)
    .type("html")
    .send(
      `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>غير متاح</title>
      <meta name="robots" content="noindex, nofollow">
      <style>body{background:#0a0a0b;color:#9c9a96;font-family:system-ui,sans-serif;height:100vh;margin:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}</style>
      </head><body><p>هذا المحتوى متاح فقط عبر تطبيق سطح المكتب الرسمي.</p></body></html>`
    );
});

function toEvent(req) {
  return {
    path: req.path,
    httpMethod: req.method,
    headers: req.headers,
    queryStringParameters: req.query && Object.keys(req.query).length ? req.query : null,
    body: req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined,
  };
}

function wrap(handler) {
  return async (req, res) => {
    try {
      const event = toEvent(req);
      const result = await handler(event);
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          if (key.toLowerCase() === "set-cookie") res.append("Set-Cookie", value);
          else res.setHeader(key, value);
        }
      }
      res.status(result.statusCode).send(result.body);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "server error" });
    }
  };
}

// Order matters: specific routes before general ones
app.all("/api/ai/chat", wrap(aiChat.handler));
app.get("/catalog.js", wrap(catalogJs.handler));
app.all("/admin/api/*", wrap(adminApi.handler));
app.all("/api/auth/*", wrap(userAuth.handler));
app.all("/api/member/*", wrap(memberApi.handler));
app.all("/api/*", wrap(publicApi.handler));

// Static files (storefront + admin panel UI)
app.use(express.static(path.join(__dirname, "public")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public/admin/index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Prime Store شغال على: http://localhost:${PORT}`);
  console.log(`   لوحة التحكم: http://localhost:${PORT}/admin\n`);
});
