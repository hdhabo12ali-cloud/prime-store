"use strict";
const crypto = require("crypto");
const { getSupabase } = require("./lib/supabase");
const {
  signMemberSession,
  getMemberSessionFromEvent,
  getMemberStateFromEvent,
  isSecureRequest,
  buildMemberSessionCookie,
  buildMemberClearCookie,
  buildMemberStateCookie,
} = require("./lib/auth");

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extraHeaders || {}),
    body: JSON.stringify(body),
  };
}
function redirect(location, extraHeaders) {
  return { statusCode: 302, headers: Object.assign({ Location: location }, extraHeaders || {}), body: "" };
}
function getPath(event) {
  let p = event.path || "/";
  p = p.replace(/^\/\.netlify\/functions\/user-auth/, "");
  p = p.replace(/^\/api\/auth/, "");
  if (!p) p = "/";
  return p;
}
function getOrigin(event) {
  const headers = event.headers || {};
  const host = headers.host || headers.Host || "localhost:3000";
  const protocol = isSecureRequest(event) ? "https" : "http";
  return `${protocol}://${host}`;
}
function mapMemberOut(m) {
  return {
    id: m.id,
    provider: m.provider,
    username: m.username,
    displayName: m.display_name,
    email: m.email,
    avatarUrl: m.avatar_url,
  };
}

async function upsertMember(supabase, { provider, providerId, email, username, avatarUrl }) {
  const { data, error } = await supabase
    .from("members")
    .upsert(
      {
        provider,
        provider_id: providerId,
        email,
        username,
        avatar_url: avatarUrl,
        last_login_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_id" }
    )
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const path = getPath(event);
    const method = event.httpMethod;
    const secure = isSecureRequest(event);
    const origin = getOrigin(event);
    const query = event.queryStringParameters || {};

    // ---- من أنا؟ ----
    if (path === "/me" && method === "GET") {
      const session = getMemberSessionFromEvent(event);
      if (!session) return json(200, { user: null });
      const { data } = await supabase.from("members").select("*").eq("id", session.sub).maybeSingle();
      if (!data) return json(200, { user: null });
      return json(200, { user: mapMemberOut(data) });
    }

    if (path === "/me" && method === "PUT") {
      const session = getMemberSessionFromEvent(event);
      if (!session) return json(401, { error: "لازم تسجّل دخول أول" });
      const body = JSON.parse(event.body || "{}");
      const displayName = (body.displayName || "").trim().slice(0, 40) || null;
      const { data, error } = await supabase
        .from("members")
        .update({ display_name: displayName })
        .eq("id", session.sub)
        .select()
        .maybeSingle();
      if (error) return json(400, { error: error.message });
      return json(200, { user: mapMemberOut(data) });
    }

    if (path === "/logout" && (method === "POST" || method === "GET")) {
      return redirect(`${origin}/`, { "Set-Cookie": buildMemberClearCookie(secure) });
    }

    // ---- Discord ----
    if (path === "/discord" && method === "GET") {
      const clientId = process.env.DISCORD_CLIENT_ID;
      if (!clientId) return json(500, { error: "DISCORD_CLIENT_ID غير مضبوط" });
      const state = crypto.randomBytes(20).toString("hex");
      const redirectUri = `${origin}/api/auth/discord/callback`;
      const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
      authorizeUrl.searchParams.set("client_id", clientId);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("scope", "identify email");
      authorizeUrl.searchParams.set("state", state);
      return redirect(authorizeUrl.toString(), { "Set-Cookie": buildMemberStateCookie(state, secure) });
    }

    if (path === "/discord/callback" && method === "GET") {
      const expectedState = getMemberStateFromEvent(event);
      if (!query.code || !query.state || !expectedState || query.state !== expectedState) {
        return redirect(`${origin}/?login_error=state`, { "Set-Cookie": buildMemberClearCookie(secure) });
      }
      const redirectUri = `${origin}/api/auth/discord/callback`;
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code: query.code,
          redirect_uri: redirectUri,
        }),
      });
      if (!tokenRes.ok) return redirect(`${origin}/?login_error=discord_token`);
      const tokenData = await tokenRes.json();

      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) return redirect(`${origin}/?login_error=discord_user`);
      const discordUser = await userRes.json();

      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

      const member = await upsertMember(supabase, {
        provider: "discord",
        providerId: discordUser.id,
        email: discordUser.email || null,
        username: discordUser.username,
        avatarUrl,
      });

      const session = signMemberSession({ sub: member.id, provider: "discord" });
      return redirect(`${origin}/`, { "Set-Cookie": buildMemberSessionCookie(session, secure) });
    }

    // ---- Google (يشتغل بعد ما تُضاف GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET بمتغيرات البيئة) ----
    if (path === "/google" && method === "GET") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return redirect(`${origin}/?login_error=google_not_configured`);
      const state = crypto.randomBytes(20).toString("hex");
      const redirectUri = `${origin}/api/auth/google/callback`;
      const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authorizeUrl.searchParams.set("client_id", clientId);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("scope", "openid email profile");
      authorizeUrl.searchParams.set("state", state);
      return redirect(authorizeUrl.toString(), { "Set-Cookie": buildMemberStateCookie(state, secure) });
    }

    if (path === "/google/callback" && method === "GET") {
      const expectedState = getMemberStateFromEvent(event);
      if (!query.code || !query.state || !expectedState || query.state !== expectedState) {
        return redirect(`${origin}/?login_error=state`, { "Set-Cookie": buildMemberClearCookie(secure) });
      }
      const redirectUri = `${origin}/api/auth/google/callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: "authorization_code",
          code: query.code,
          redirect_uri: redirectUri,
        }),
      });
      if (!tokenRes.ok) return redirect(`${origin}/?login_error=google_token`);
      const tokenData = await tokenRes.json();

      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) return redirect(`${origin}/?login_error=google_user`);
      const googleUser = await userRes.json();

      const member = await upsertMember(supabase, {
        provider: "google",
        providerId: googleUser.sub,
        email: googleUser.email || null,
        username: googleUser.name || googleUser.email,
        avatarUrl: googleUser.picture || null,
      });

      const session = signMemberSession({ sub: member.id, provider: "google" });
      return redirect(`${origin}/`, { "Set-Cookie": buildMemberSessionCookie(session, secure) });
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    return json(500, { error: err.message || "Server error" });
  }
};
