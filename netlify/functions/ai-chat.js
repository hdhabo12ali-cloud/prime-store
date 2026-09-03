"use strict";
const { getSupabase } = require("./lib/supabase");

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  };
}

const MAX_HISTORY_MESSAGES = 20;
const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method not allowed" });

  let supabase;
  try {
    supabase = getSupabase();
  } catch (e) {
    return json(500, { error: e.message });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return json(500, { error: "GEMINI_API_KEY غير مضبوط في متغيرات البيئة" });
  const geminiModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "طلب غير صالح" });
  }

  const { accessCode, message, conversationId } = body;
  if (!message || !String(message).trim()) return json(400, { error: "الرسالة فارغة" });

  const { data: config } = await supabase.from("ai_assistant_config").select("*").eq("id", 1).maybeSingle();
  if (!config || !config.enabled) return json(403, { error: "المساعد الذكي غير مفعّل حاليًا" });
  if (config.access_code && config.access_code.trim()) {
    if (!accessCode || accessCode.trim() !== config.access_code.trim()) {
      return json(401, { error: "رمز الوصول غير صحيح" });
    }
  }

  // Load or create conversation
  let conversation = null;
  if (conversationId) {
    const { data } = await supabase.from("ai_conversations").select("*").eq("id", conversationId).maybeSingle();
    conversation = data || null;
  }
  const customerToken = (conversation && conversation.customer_token) || accessCode || "anonymous";
  let history = (conversation && conversation.messages) || [];

  history = history.concat([{ role: "user", content: String(message).slice(0, 6000) }]);
  if (history.length > MAX_HISTORY_MESSAGES) history = history.slice(history.length - MAX_HISTORY_MESSAGES);

  const systemPrompt =
    (config.system_prompt && config.system_prompt.trim()) ||
    "أنت مساعد برمجي متخصص تساعد عملاء متجر Prime Store بعد شرائهم لباكج أو منتج. أجب بشكل تقني دقيق وواضح، وبنفس لغة رسالة العميل.";

  let reply;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: history.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: 1500 },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return json(502, { error: (data && data.error && data.error.message) || "تعذّر الاتصال بمزود الذكاء الاصطناعي" });
    }
    const candidate = (data.candidates || [])[0];
    reply =
      candidate && candidate.content && candidate.content.parts
        ? candidate.content.parts
            .map((p) => p.text || "")
            .join("\n")
            .trim()
        : "";
    if (!reply) {
      const blocked = data.promptFeedback && data.promptFeedback.blockReason;
      reply = blocked ? "تعذّر الرد على هذه الرسالة." : "...";
    }
  } catch (err) {
    return json(502, { error: "تعذّر الاتصال بمزود الذكاء الاصطناعي" });
  }

  history = history.concat([{ role: "assistant", content: reply }]);

  let savedId = conversationId;
  if (conversation) {
    await supabase.from("ai_conversations").update({ messages: history, updated_at: new Date().toISOString() }).eq("id", conversation.id);
  } else {
    const { data: inserted } = await supabase
      .from("ai_conversations")
      .insert({ customer_token: customerToken, messages: history })
      .select()
      .maybeSingle();
    savedId = inserted ? inserted.id : null;
  }

  return json(200, { reply, conversationId: savedId });
};
