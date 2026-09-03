"use strict";
(() => {
  const $ = (sel) => document.querySelector(sel);
  const PROVIDER_LABELS = { discord: "Discord", google: "Gmail" };

  async function init() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      $("[data-loading]").hidden = true;
      if (!data || !data.user) {
        $("[data-logged-out]").hidden = false;
        return;
      }
      const user = data.user;
      $("[data-account-panel]").hidden = false;
      $("[data-avatar]").src = user.avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png";
      $("[data-username]").textContent = user.displayName || user.username || "عضو";
      $("[data-provider-line]").textContent = `مسجّل عبر ${PROVIDER_LABELS[user.provider] || user.provider}${user.email ? " · " + user.email : ""}`;
      $("[data-display-name-input]").value = user.displayName || "";
    } catch {
      $("[data-loading]").textContent = "حدث خطأ، حدّث الصفحة.";
    }
  }

  $("[data-save-btn]").addEventListener("click", async () => {
    const btn = $("[data-save-btn]");
    const msg = $("[data-saved-msg]");
    btn.disabled = true;
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: $("[data-display-name-input]").value.trim() }),
      });
      if (!res.ok) throw new Error();
      msg.textContent = "تم الحفظ ✓";
      $("[data-username]").textContent = $("[data-display-name-input]").value.trim() || "عضو";
      setTimeout(() => (msg.textContent = ""), 2500);
    } catch {
      msg.textContent = "تعذّر الحفظ، جرّب مرة ثانية.";
      msg.style.color = "#ff5c5c";
    } finally {
      btn.disabled = false;
    }
  });

  init();
})();
