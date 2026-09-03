"use strict";
const { getSupabase } = require("./lib/supabase");

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign(
      {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=30",
      },
      extraHeaders || {}
    ),
    body: JSON.stringify(body),
  };
}

function getPath(event) {
  let p = event.path || "/";
  p = p.replace(/^\/\.netlify\/functions\/public-api/, "");
  p = p.replace(/^\/api/, "");
  if (!p) p = "/";
  return p;
}

async function requireApiKey(event, supabase) {
  const key = event.headers["x-api-key"] || event.headers["X-Api-Key"];
  if (!key) return false;
  const { data } = await supabase.from("api_keys").select("id").eq("key", key).maybeSingle();
  if (!data) return false;
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key", key).then(() => {});
  return true;
}

function mapPackageOut(p) {
  return {
    id: p.id,
    sourceName: p.source_name,
    lifetime: p.lifetime,
    monthly: p.monthly,
    openSource: p.open_source,
    price: p.price,
    details: p.details,
    features: p.features,
    images: p.images,
  };
}
function mapProductOut(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    lifetime: p.lifetime,
    monthly: p.monthly,
    openSource: p.open_source,
    details: p.details,
    features: p.features,
    images: p.images,
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
  };
}
function mapBannerOut(b) {
  return {
    id: b.id,
    title: b.title,
    imageUrl: b.image_url,
    linkUrl: b.link_url,
  };
}

async function loadCatalog(supabase) {
  const [{ data: packages }, { data: products }, { data: free }, { data: settings }, { data: plans }, { data: banners }] = await Promise.all([
    supabase.from("packages").select("*").order("sort_order").order("created_at"),
    supabase.from("products").select("*").order("sort_order").order("created_at"),
    supabase.from("free_bots").select("*").order("sort_order").order("created_at"),
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("plans").select("*").order("sort_order").order("created_at"),
    supabase.from("banners").select("*").eq("active", true).order("sort_order").order("created_at"),
  ]);
  return {
    packages: (packages || []).map(mapPackageOut),
    products: (products || []).map(mapProductOut),
    free: (free || []).map(mapFreeOut),
    plans: (plans || []).map(mapPlanOut),
    banners: (banners || []).map(mapBannerOut),
    settings: {
      siteName: settings ? settings.site_name : "",
      discordInvite: settings ? settings.discord_invite : "",
    },
  };
}

exports.handler = async (event) => {
  const path = getPath(event);
  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    return json(500, { error: e.message });
  }

  try {
    // Public, unauthenticated: used by the storefront itself
    if (path === "/catalog" && event.httpMethod === "GET") {
      const data = await loadCatalog(supabase);
      return json(200, data);
    }

    // Used by the public /docs page: customer pastes the key their plan came with,
    // this confirms it's a real, currently-active key issued from the admin panel.
    if (path === "/keys/verify" && event.httpMethod === "GET") {
      const key = event.headers["x-api-key"] || event.headers["X-Api-Key"];
      if (!key) return json(401, { error: "مفتاح API مطلوب" });
      const { data } = await supabase.from("api_keys").select("label,created_at").eq("key", key).maybeSingle();
      if (!data) return json(401, { error: "مفتاح غير صالح" });
      supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key", key).then(() => {});
      return json(200, { valid: true, label: data.label, createdAt: data.created_at });
    }

    // Authenticated bot-facing endpoints (require x-api-key)
    if (path.startsWith("/bot/")) {
      const okKey = await requireApiKey(event, supabase);
      if (!okKey) return json(401, { error: "مفتاح API غير صالح" });

      if (path === "/bot/catalog" && event.httpMethod === "GET") {
        const data = await loadCatalog(supabase);
        return json(200, { packages: data.packages, products: data.products });
      }
      if (path === "/bot/settings" && event.httpMethod === "GET") {
        const data = await loadCatalog(supabase);
        return json(200, data.settings);
      }
      if (path === "/bot/free" && event.httpMethod === "GET") {
        const data = await loadCatalog(supabase);
        return json(200, data.free);
      }
    }

    return json(404, { error: "not found" });
  } catch (err) {
    return json(500, { error: err.message || "خطأ في السيرفر" });
  }
};
