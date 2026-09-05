"use strict";
(() => {
  const $ = (sel) => document.querySelector(sel);
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function loadPresets() {
    const grid = $("[data-presets-grid]");
    try {
      const res = await fetch("/api/member/presets");
      const presets = await res.json();
      if (!Array.isArray(presets) || !presets.length) {
        $("[data-empty-state]").hidden = false;
        grid.innerHTML = "";
        return;
      }
      $("[data-empty-state]").hidden = true;
      grid.innerHTML = presets
        .map(
          (p) => `
        <article class="project-card">
          <div class="body">
            ${p.category ? `<p style="color:var(--orange);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;">${escapeHtml(p.category)}</p>` : ""}
            <h3>${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.description || "")}</p>
            <a class="link" href="${escapeHtml(p.fileUrl)}" rel="noreferrer noopener" target="_blank">تحميل →</a>
          </div>
        </article>`
        )
        .join("");
    } catch {
      grid.innerHTML = "";
    }
  }

  loadPresets();
})();
