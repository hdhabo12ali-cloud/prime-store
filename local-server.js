"use strict";
/**
 * سيرفر محلي يشغّل نفس منطق الباك إند (Netlify Functions) لكن على جهازك مباشرة.
 * تشغيل: npm install && npm start
 * بعدها افتح: http://localhost:3000/admin
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
app.use(express.json({ limit: "2mb" }));

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
