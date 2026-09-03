"use strict";
const { getSupabase } = require("./lib/supabase");

function mapPackageOut(p) {
  return {
    id: p.id,
    key: p.source_name,
    sourceName: p.source_name,
    lifetime: p.lifetime,
    openSource: p.open_source,
    monthly: p.monthly,
    price: p.price,
    details: p.details,
    features: p.features,
    images: p.images,
    videos: [],
  };
}
function mapProductOut(p) {
  return {
    id: p.id,
    name: p.name,
    lifetime: p.lifetime,
    openSource: p.open_source,
    monthly: p.monthly,
    price: p.price,
    summary: Array.isArray(p.details) ? p.details[0] || "" : "",
    details: p.details,
    features: p.features,
    images: p.images,
    videos: [],
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

exports.handler = async () => {
  try {
    const supabase = getSupabase();
    const [{ data: packages }, { data: products }, { data: free }, { data: settings }, { data: plans }, { data: banners }] = await Promise.all([
      supabase.from("packages").select("*").order("sort_order").order("created_at"),
      supabase.from("products").select("*").order("sort_order").order("created_at"),
      supabase.from("free_bots").select("*").order("sort_order").order("created_at"),
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("plans").select("*").order("sort_order").order("created_at"),
      supabase.from("banners").select("*").eq("active", true).order("sort_order").order("created_at"),
    ]);

    const payload = {
      packages: (packages || []).map(mapPackageOut),
      products: (products || []).map(mapProductOut),
      free: (free || []).map(mapFreeOut),
      plans: (plans || []).map(mapPlanOut),
      banners: (banners || []).map(mapBannerOut),
      settings: {
        siteName: settings ? settings.site_name : "Prime Store",
        discordInvite: settings ? settings.discord_invite : "",
      },
    };

    const js = `window.PRIME_CATALOG = ${JSON.stringify(payload)};\nwindow.PRIME_SETTINGS = ${JSON.stringify(payload.settings)};\n`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
      body: js,
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
      body: `window.PRIME_CATALOG = { packages: [], products: [], free: [], plans: [], banners: [] };\nconsole.error(${JSON.stringify(
        "catalog load failed: " + (err.message || String(err))
      )});\n`,
    };
  }
};
