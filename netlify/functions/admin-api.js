"use strict";
const crypto = require("crypto");
const { getSupabase } = require("./lib/supabase");
const {
  signSession,
  getSessionFromEvent,
  getStateFromEvent,
  isSecureRequest,
  buildSessionCookie,
  buildClearCookie,
  buildStateCookie,
} = require("./lib/auth");

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, extraHeaders || {}),
    body: JSON.stringify(body),
  };
}

function redirect(location, extraHeaders) {
  return {
    statusCode: 302,
    headers: Object.assign({ Location: location }, extraHeaders || {}),
    body: "",
  };
}

function getPath(event) {
  let p = event.path || "/";
  p = p.replace(/^\/\.netlify\/functions\/admin-api/, "");
  p = p.replace(/^\/admin\/api/, "");
  if (!p) p = "/";
  return p;
}

function getRedirectUri(event) {
  const headers = event.headers || {};
  const host = headers.host || headers.Host || "localhost:3000";
  const protocol = isSecureRequest(event) ? "https" : "http";
  return `${protocol}://${host}/admin/api/auth/discord/callback`;
}

function requireAuth(event) {
  return getSessionFromEvent(event);
}

// ---- mappers between DB rows (snake_case) and API shape (camelCase, matches original admin.js) ----
function mapPackageOut(p) {
  return {
    id: p.id,
    sourceName: p.source_name,
    key: p.source_name,
    lifetime: p.lifetime,
    monthly: p.monthly,
    openSource: p.open_source,
    price: p.price,
    details: p.details,
    features: p.features,
    images: p.images,
  };
}
function mapPackageIn(b) {
  return {
    id: b.id,
    source_name: b.sourceName || b.source_name || b.key || "",
    lifetime: b.lifetime || null,
    monthly: b.monthly || null,
    open_source: b.openSource || null,
    price: b.price || null,
    details: b.details || [],
    features: b.features || [],
    images: b.images || [],
  };
}
function mapProductOut(p) {
  return {
    id: p.id,
    name: p.name,
    sourceName: p.name,
    price: p.price,
    lifetime: p.lifetime,
    monthly: p.monthly,
    openSource: p.open_source,
    details: p.details,
    features: p.features,
    images: p.images,
  };
}
function mapProductIn(b) {
  return {
    id: b.id,
    name: b.name || b.sourceName || "",
    price: b.price || null,
    lifetime: b.lifetime || null,
    monthly: b.monthly || null,
    open_source: b.openSource || null,
    details: b.details || [],
    features: b.features || [],
    images: b.images || [],
  };
}
function mapFreeOut(f) {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    images: f.images,
    videoUrl: f.video_url,
    downloadUrl: f.download_url,
    tags: f.tags,
    createdAt: f.created_at,
  };
}
function mapFreeIn(b) {
  return {
    name: b.name || "",
    description: b.description || "",
    images: b.images || [],
    video_url: b.videoUrl || null,
    download_url: b.downloadUrl || "",
    tags: b.tags || [],
  };
}
function mapPlanOut(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    period: p.period,
    tagline: p.tagline,
    features: p.features,
    badge: p.badge,
    featured: p.featured,
    ctaUrl: p.cta_url,
    sortOrder: p.sort_order,
  };
}
function mapPlanIn(b) {
  return {
    id: b.id,
    name: b.name || "",
    price: b.price || "",
    period: b.period || "/mo",
    tagline: b.tagline || "",
    features: b.features || [],
    badge: b.badge || null,
    featured: !!b.featured,
    cta_url: b.ctaUrl || null,
    sort_order: Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
  };
}
function mapBannerOut(b) {
  return {
    id: b.id,
    title: b.title,
    imageUrl: b.image_url,
    linkUrl: b.link_url,
    active: b.active,
    sortOrder: b.sort_order,
    createdAt: b.created_at,
  };
}
function mapBannerIn(b) {
  return {
    title: b.title || "",
    image_url: b.imageUrl || "",
    link_url: b.linkUrl || null,
    active: b.active !== false,
    sort_order: Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
  };
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = getPath(event);
  const secure = isSecureRequest(event);

  try {
    // ---------------- Discord OAuth (no session required) ----------------
    if (path === "/auth/discord" && method === "GET") {
      const clientId = process.env.DISCORD_CLIENT_ID;
      if (!clientId) return json(500, { error: "DISCORD_CLIENT_ID غير مضبوط في متغيرات البيئة" });

      const state = crypto.randomBytes(20).toString("hex");
      const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
      authorizeUrl.searchParams.set("client_id", clientId);
      authorizeUrl.searchParams.set("redirect_uri", getRedirectUri(event));
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("scope", "identify");
      authorizeUrl.searchParams.set("state", state);
      authorizeUrl.searchParams.set("prompt", "consent");

      return redirect(authorizeUrl.toString(), { "Set-Cookie": buildStateCookie(state, secure) });
    }

    if (path === "/auth/discord/callback" && method === "GET") {
      const query = event.queryStringParameters || {};
      const failure = (reason) => redirect(`/admin?login_error=${encodeURIComponent(reason)}`);

      if (query.error) return failure("cancelled");

      const expectedState = getStateFromEvent(event);
      if (!query.code || !query.state || !expectedState || query.state !== expectedState) {
        return failure("state");
      }

      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      if (!clientId || !clientSecret) return failure("config");

      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: query.code,
          redirect_uri: getRedirectUri(event),
        }),
      });
      const tokenData = await tokenRes.json().catch(() => null);
      if (!tokenRes.ok || !tokenData || !tokenData.access_token) return failure("token");

      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const discordUser = await userRes.json().catch(() => null);
      if (!userRes.ok || !discordUser || !discordUser.id) return failure("token");

      const allowedIds = (process.env.ADMIN_DISCORD_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!allowedIds.includes(discordUser.id)) return failure("not_allowed");

      const username =
        discordUser.username + (discordUser.discriminator && discordUser.discriminator !== "0" ? "#" + discordUser.discriminator : "");
      const sessionToken = signSession({ sub: discordUser.id, username, avatar: discordUser.avatar || null });

      return redirect("/admin", { "Set-Cookie": buildSessionCookie(sessionToken, secure) });
    }

    if (path === "/logout" && method === "POST") {
      return json(200, { ok: true }, { "Set-Cookie": buildClearCookie(secure) });
    }

    if (path === "/me" && method === "GET") {
      const session = requireAuth(event);
      if (!session) return json(401, { error: "unauthorized" });
      return json(200, {
        username: session.username,
        discordId: session.sub,
        avatarUrl: session.avatar
          ? `https://cdn.discordapp.com/avatars/${session.sub}/${session.avatar}.png?size=64`
          : "https://cdn.discordapp.com/embed/avatars/0.png",
      });
    }

    // ---------------- Everything below requires a valid session ----------------
    const session = requireAuth(event);
    if (!session) return json(401, { error: "unauthorized" });

    let supabase;
    try {
      supabase = getSupabase();
    } catch (e) {
      return json(500, { error: e.message });
    }

    // ---- Team applications review ----
    if (path === "/applications" && method === "GET") {
      const { data: apps, error } = await supabase
        .from("team_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json(400, { error: error.message });
      const memberIds = [...new Set((apps || []).map((a) => a.member_id))];
      let membersById = {};
      if (memberIds.length) {
        const { data: members } = await supabase.from("members").select("id,username,avatar_url,email").in("id", memberIds);
        membersById = Object.fromEntries((members || []).map((m) => [m.id, m]));
      }
      return json(
        200,
        (apps || []).map((a) => ({
          id: a.id,
          team: a.team,
          message: a.message,
          status: a.status,
          createdAt: a.created_at,
          member: membersById[a.member_id] || null,
        }))
      );
    }

    let ma = path.match(/^\/applications\/([^/]+)\/(approve|reject)$/);
    if (ma && method === "POST") {
      const [, id, action] = ma;
      const { error } = await supabase
        .from("team_applications")
        .update({
          status: action === "approve" ? "approved" : "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.username || session.sub,
        })
        .eq("id", id);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }

    if (path === "/data" && method === "GET") {
      const [{ data: packages }, { data: products }, { data: settings }] = await Promise.all([
        supabase.from("packages").select("*").order("sort_order").order("created_at"),
        supabase.from("products").select("*").order("sort_order").order("created_at"),
        supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      return json(200, {
        packages: (packages || []).map(mapPackageOut),
        products: (products || []).map(mapProductOut),
        settings: {
          siteName: settings ? settings.site_name : "",
          discordInvite: settings ? settings.discord_invite : "",
        },
      });
    }

    // ---- Plans CRUD ----
    let mp = path.match(/^\/plans\/?(.*)$/);
    if (mp) {
      const id = decodeURIComponent(mp[1] || "");
      if (method === "GET" && !id) {
        const { data } = await supabase.from("plans").select("*").order("sort_order").order("created_at");
        return json(200, (data || []).map(mapPlanOut));
      }
      if (method === "POST") {
        const body = JSON.parse(event.body || "{}");
        const row = mapPlanIn(body);
        if (!row.id) return json(400, { error: "المعرف (id) مطلوب" });
        const { error } = await supabase.from("plans").insert(row);
        if (error) return json(400, { error: error.message.includes("duplicate") ? "المعرف مستخدم من قبل" : error.message });
        return json(200, { ok: true });
      }
      if (method === "PUT" && id) {
        const body = JSON.parse(event.body || "{}");
        const row = mapPlanIn(Object.assign({}, body, { id }));
        delete row.id;
        row.updated_at = new Date().toISOString();
        const { error } = await supabase.from("plans").update(row).eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
      if (method === "DELETE" && id) {
        const { error } = await supabase.from("plans").delete().eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
    }

    // ---- Banners CRUD ----
    let mb = path.match(/^\/banners\/?(.*)$/);
    if (mb) {
      const id = decodeURIComponent(mb[1] || "");
      if (method === "GET" && !id) {
        const { data } = await supabase.from("banners").select("*").order("sort_order").order("created_at");
        return json(200, (data || []).map(mapBannerOut));
      }
      if (method === "POST") {
        const body = JSON.parse(event.body || "{}");
        const row = mapBannerIn(body);
        if (!row.title || !row.image_url) return json(400, { error: "العنوان ورابط الصورة مطلوبين" });
        const { data, error } = await supabase.from("banners").insert(row).select().maybeSingle();
        if (error) return json(400, { error: error.message });
        return json(200, mapBannerOut(data));
      }
      if (method === "PUT" && id) {
        const body = JSON.parse(event.body || "{}");
        const row = mapBannerIn(body);
        const { error } = await supabase.from("banners").update(row).eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
      if (method === "DELETE" && id) {
        const { error } = await supabase.from("banners").delete().eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
    }

    // ---- Packages CRUD ----
    let m = path.match(/^\/packages\/?(.*)$/);
    if (m) {
      const id = decodeURIComponent(m[1] || "");
      if (method === "POST") {
        const body = JSON.parse(event.body || "{}");
        const row = mapPackageIn(body);
        if (!row.id) return json(400, { error: "المعرف (id) مطلوب" });
        const { error } = await supabase.from("packages").insert(row);
        if (error) return json(400, { error: error.message.includes("duplicate") ? "المعرف مستخدم من قبل" : error.message });
        return json(200, { ok: true });
      }
      if (method === "PUT" && id) {
        const body = JSON.parse(event.body || "{}");
        const row = mapPackageIn(Object.assign({}, body, { id }));
        delete row.id;
        row.updated_at = new Date().toISOString();
        const { error } = await supabase.from("packages").update(row).eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
      if (method === "DELETE" && id) {
        const { error } = await supabase.from("packages").delete().eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
    }

    // ---- Products CRUD ----
    m = path.match(/^\/products\/?(.*)$/);
    if (m) {
      const id = decodeURIComponent(m[1] || "");
      if (method === "POST") {
        const body = JSON.parse(event.body || "{}");
        const row = mapProductIn(body);
        if (!row.id) return json(400, { error: "المعرف (id) مطلوب" });
        const { error } = await supabase.from("products").insert(row);
        if (error) return json(400, { error: error.message.includes("duplicate") ? "المعرف مستخدم من قبل" : error.message });
        return json(200, { ok: true });
      }
      if (method === "PUT" && id) {
        const body = JSON.parse(event.body || "{}");
        const row = mapProductIn(Object.assign({}, body, { id }));
        delete row.id;
        row.updated_at = new Date().toISOString();
        const { error } = await supabase.from("products").update(row).eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
      if (method === "DELETE" && id) {
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
    }

    // ---- Free bots CRUD ----
    m = path.match(/^\/free\/?(.*)$/);
    if (m) {
      const id = decodeURIComponent(m[1] || "");
      if (method === "GET" && !id) {
        const { data } = await supabase.from("free_bots").select("*").order("sort_order").order("created_at");
        return json(200, (data || []).map(mapFreeOut));
      }
      if (method === "POST") {
        const body = JSON.parse(event.body || "{}");
        const row = mapFreeIn(body);
        if (!row.name || !row.download_url) return json(400, { error: "الاسم ورابط التحميل مطلوبين" });
        const { data, error } = await supabase.from("free_bots").insert(row).select().maybeSingle();
        if (error) return json(400, { error: error.message });
        return json(200, mapFreeOut(data));
      }
      if (method === "PUT" && id) {
        const body = JSON.parse(event.body || "{}");
        const row = mapFreeIn(body);
        row.updated_at = new Date().toISOString();
        const { error } = await supabase.from("free_bots").update(row).eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
      if (method === "DELETE" && id) {
        const { error } = await supabase.from("free_bots").delete().eq("id", id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
    }

    // ---- API keys ----
    m = path.match(/^\/apikeys\/?(.*)$/);
    if (m) {
      const key = decodeURIComponent(m[1] || "");
      if (method === "GET" && !key) {
        const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
        return json(200, (data || []).map((k) => ({ label: k.label, key: k.key, createdAt: k.created_at })));
      }
      if (method === "POST") {
        const body = JSON.parse(event.body || "{}");
        const newKey = "pk_" + crypto.randomBytes(24).toString("hex");
        const { error } = await supabase.from("api_keys").insert({ label: body.label || "مفتاح API", key: newKey });
        if (error) return json(400, { error: error.message });
        return json(200, { key: newKey });
      }
      if (method === "DELETE" && key) {
        const { error } = await supabase.from("api_keys").delete().eq("key", key);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }
    }

    // ---- Settings ----
    if (path === "/settings" && method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const { error } = await supabase
        .from("site_settings")
        .update({
          site_name: body.siteName || "",
          discord_invite: body.discordInvite || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }

    // ---- AI assistant config ----
    if (path === "/ai-config" && method === "GET") {
      const { data } = await supabase.from("ai_assistant_config").select("*").eq("id", 1).maybeSingle();
      return json(200, {
        enabled: !!(data && data.enabled),
        placement: data ? data.placement : "after_purchase",
        title: data ? data.title : "",
        systemPrompt: data ? data.system_prompt : "",
        accessCode: data ? data.access_code : "",
      });
    }
    if (path === "/ai-config" && method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const { error } = await supabase
        .from("ai_assistant_config")
        .update({
          enabled: !!body.enabled,
          placement: body.placement || "after_purchase",
          title: body.title || "",
          system_prompt: body.systemPrompt || "",
          access_code: body.accessCode || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }

    return json(404, { error: "not found" });
  } catch (err) {
    return json(500, { error: err.message || "خطأ في السيرفر" });
  }
};
