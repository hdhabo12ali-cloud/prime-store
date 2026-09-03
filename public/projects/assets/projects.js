"use strict";
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let isLoggedIn = false;

  async function checkLogin() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      isLoggedIn = !!(data && data.user);
    } catch {
      isLoggedIn = false;
    }
    $("[data-login-hint]").hidden = isLoggedIn;
    $("[data-add-project-btn]").hidden = !isLoggedIn;
  }

  async function loadProjects() {
    const grid = $("[data-projects-grid]");
    try {
      const res = await fetch("/api/member/projects");
      const projects = await res.json();
      if (!Array.isArray(projects) || !projects.length) {
        $("[data-empty-state]").hidden = false;
        grid.innerHTML = "";
        return;
      }
      $("[data-empty-state]").hidden = true;
      grid.innerHTML = projects
        .map(
          (p) => `
        <article class="project-card">
          ${p.imageUrl ? `<img alt="" class="thumb" src="${escapeHtml(p.imageUrl)}"/>` : ""}
          <div class="body">
            <h3>${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.description || "")}</p>
            <div class="author">
              ${p.memberAvatar ? `<img alt="" src="${escapeHtml(p.memberAvatar)}"/>` : ""}
              <span>${escapeHtml(p.memberName || "عضو")}</span>
            </div>
            ${p.linkUrl ? `<a class="link" href="${escapeHtml(p.linkUrl)}" rel="noreferrer noopener" target="_blank">فتح المشروع →</a>` : ""}
          </div>
        </article>`
        )
        .join("");
    } catch {
      grid.innerHTML = "";
    }
  }

  const modal = $("#addProjectModal");
  $("[data-add-project-btn]").addEventListener("click", () => {
    $("#pTitle").value = "";
    $("#pDescription").value = "";
    $("#pImage").value = "";
    $("#pLink").value = "";
    $("#addProjectError").textContent = "";
    modal.classList.add("active");
  });
  $("#addProjectCancel").addEventListener("click", () => modal.classList.remove("active"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });

  $("#addProjectSave").addEventListener("click", async () => {
    const errorEl = $("#addProjectError");
    const title = $("#pTitle").value.trim();
    if (!title) {
      errorEl.textContent = "اسم المشروع مطلوب.";
      return;
    }
    try {
      const res = await fetch("/api/member/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: $("#pDescription").value.trim(),
          imageUrl: $("#pImage").value.trim(),
          linkUrl: $("#pLink").value.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر النشر");
      modal.classList.remove("active");
      loadProjects();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  checkLogin().then(loadProjects);
})();
