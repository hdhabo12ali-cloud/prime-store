"use strict";
const jwt = require("jsonwebtoken");
const cookie = require("cookie");

const COOKIE_NAME = "prime_admin_session";
const STATE_COOKIE_NAME = "prime_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 ساعات
const STATE_TTL_SECONDS = 60 * 10; // 10 دقائق، تكفي لإكمال رحلة تسجيل الدخول عبر Discord

// جلسة منفصلة تمامًا لحسابات الأعضاء العاديين (مو الأدمن) — بريكوكي وستيت خاصين فيها
// عشان شخص يقدر يكون مسجّل أدمن وعضو بنفس الوقت بنفس المتصفح بدون تعارض.
const MEMBER_COOKIE_NAME = "prime_member_session";
const MEMBER_STATE_COOKIE_NAME = "prime_member_oauth_state";
const MEMBER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 يوم

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET غير مضبوط في متغيرات البيئة");
  return secret;
}

function signSession(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_TTL_SECONDS });
}

function verifySession(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch (e) {
    return null;
  }
}

function readCookies(event) {
  const rawCookie = (event.headers && (event.headers.cookie || event.headers.Cookie)) || "";
  return cookie.parse(rawCookie);
}

function getSessionFromEvent(event) {
  const token = readCookies(event)[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

function getStateFromEvent(event) {
  return readCookies(event)[STATE_COOKIE_NAME] || null;
}

// السيرفر محليًا يشتغل على http بدون شهادة SSL — كوكيز secure ما ترجع أبدًا على http.
// فوق Netlify الطلب دايمًا https، فنفعّل secure هناك تلقائيًا بالاعتماد على هيدر x-forwarded-proto.
function isSecureRequest(event) {
  const headers = event.headers || {};
  const proto = headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"] || "";
  if (proto) return proto.split(",")[0].trim() === "https";
  const host = headers.host || headers.Host || "";
  return !/^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(host);
}

function buildSessionCookie(token, secure) {
  return cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: !!secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

function buildClearCookie(secure) {
  return cookie.serialize(COOKIE_NAME, "", {
    httpOnly: true,
    secure: !!secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function buildStateCookie(state, secure) {
  return cookie.serialize(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: !!secure,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
}

// ---- Member (public user) session helpers ----
function signMemberSession(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: MEMBER_SESSION_TTL_SECONDS });
}
function verifyMemberSession(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch (e) {
    return null;
  }
}
function getMemberSessionFromEvent(event) {
  const token = readCookies(event)[MEMBER_COOKIE_NAME];
  if (!token) return null;
  return verifyMemberSession(token);
}
function getMemberStateFromEvent(event) {
  return readCookies(event)[MEMBER_STATE_COOKIE_NAME] || null;
}
function buildMemberSessionCookie(token, secure) {
  return cookie.serialize(MEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: !!secure,
    sameSite: "lax",
    path: "/",
    maxAge: MEMBER_SESSION_TTL_SECONDS,
  });
}
function buildMemberClearCookie(secure) {
  return cookie.serialize(MEMBER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: !!secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
function buildMemberStateCookie(state, secure) {
  return cookie.serialize(MEMBER_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: !!secure,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
}

module.exports = {
  COOKIE_NAME,
  signSession,
  verifySession,
  getSessionFromEvent,
  getStateFromEvent,
  isSecureRequest,
  buildSessionCookie,
  buildClearCookie,
  buildStateCookie,
  signMemberSession,
  verifyMemberSession,
  getMemberSessionFromEvent,
  getMemberStateFromEvent,
  buildMemberSessionCookie,
  buildMemberClearCookie,
  buildMemberStateCookie,
};
