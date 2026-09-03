"use strict";
const { getSupabase } = require("./lib/supabase");
const { getMemberSessionFromEvent } = require("./lib/auth");

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}
function getPath(event) {
  let p = event.path || "/";
  p = p.replace(/^\/\.netlify\/functions\/member-api/, "");
  p = p.replace(/^\/api\/member/, "");
  if (!p) p = "/";
  return p;
}
function mapOut(p, memberName, memberAvatar) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    imageUrl: p.image_url,
    linkUrl: p.link_url,
    createdAt: p.created_at,
    memberId: p.member_id,
    memberName: memberName || null,
    memberAvatar: memberAvatar || null,
  };
}

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const path = getPath(event);
    const method = event.httpMethod;

    // ---- قائمة عامة لكل المشاريع (يشوفها أي زائر) ----
    if (path === "/projects" && method === "GET") {
      const { data: projects, error } = await supabase
        .from("member_projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) return json(400, { error: error.message });

      const memberIds = [...new Set((projects || []).map((p) => p.member_id))];
      let membersById = {};
      if (memberIds.length) {
        const { data: members } = await supabase.from("members").select("id,username,avatar_url").in("id", memberIds);
        membersById = Object.fromEntries((members || []).map((m) => [m.id, m]));
      }
      const out = (projects || []).map((p) => {
        const m = membersById[p.member_id];
        return mapOut(p, m ? m.username : null, m ? m.avatar_url : null);
      });
      return json(200, out);
    }

    // من هنا وطالع، لازم يكون مسجّل دخول كعضو
    const session = getMemberSessionFromEvent(event);
    if (!session) return json(401, { error: "لازم تسجّل دخول أول" });

    // ---- مشاريعي أنا بس ----
    if (path === "/my-projects" && method === "GET") {
      const { data, error } = await supabase
        .from("member_projects")
        .select("*")
        .eq("member_id", session.sub)
        .order("created_at", { ascending: false });
      if (error) return json(400, { error: error.message });
      return json(200, (data || []).map((p) => mapOut(p)));
    }

    if (path === "/projects" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const title = (body.title || "").trim();
      const description = (body.description || "").trim();
      const imageUrl = (body.imageUrl || "").trim() || null;
      const linkUrl = (body.linkUrl || "").trim() || null;
      if (!title) return json(400, { error: "عنوان المشروع مطلوب" });

      const { data, error } = await supabase
        .from("member_projects")
        .insert({ member_id: session.sub, title, description, image_url: imageUrl, link_url: linkUrl })
        .select()
        .maybeSingle();
      if (error) return json(400, { error: error.message });
      return json(200, mapOut(data));
    }

    const delMatch = path.match(/^\/projects\/(.+)$/);
    if (delMatch && method === "DELETE") {
      const id = decodeURIComponent(delMatch[1]);
      const { error } = await supabase.from("member_projects").delete().eq("id", id).eq("member_id", session.sub);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }

    // ---- تقديمات الفرق ----
    const VALID_TEAMS = ["bot_developer", "bot_team", "designer_team", "marketing_team", "website_team"];

    if (path === "/my-applications" && method === "GET") {
      const { data, error } = await supabase
        .from("team_applications")
        .select("*")
        .eq("member_id", session.sub)
        .order("created_at", { ascending: false });
      if (error) return json(400, { error: error.message });
      return json(200, data || []);
    }

    if (path === "/applications" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const team = body.team;
      const message = (body.message || "").trim();
      if (!VALID_TEAMS.includes(team)) return json(400, { error: "فريق غير معروف" });

      const { data: existing } = await supabase
        .from("team_applications")
        .select("id,status")
        .eq("member_id", session.sub)
        .eq("team", team)
        .in("status", ["pending", "approved"])
        .maybeSingle();
      if (existing) return json(400, { error: "عندك تقديم سابق لنفس الفريق (قيد المراجعة أو مقبول)" });

      const { data, error } = await supabase
        .from("team_applications")
        .insert({ member_id: session.sub, team, message })
        .select()
        .maybeSingle();
      if (error) return json(400, { error: error.message });
      return json(200, data);
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    return json(500, { error: err.message || "Server error" });
  }
};
