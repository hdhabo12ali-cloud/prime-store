"use strict";
(() => {
  const $ = (sel) => document.querySelector(sel);
  const TEAM_LABELS = {
    bot_developer: "Bot Developer",
    bot_team: "Bot Team",
    designer_team: "Designer Team",
    marketing_team: "Marketing Team",
    website_team: "Website Team",
  };
  const STATUS_LABELS = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let isLoggedIn = false;
  let currentTeam = null;
  let myApplications = [];

  async function checkLogin() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      isLoggedIn = !!(data && data.user);
    } catch {
      isLoggedIn = false;
    }
    $("[data-login-hint]").hidden = isLoggedIn;
  }

  async function loadMyApplications() {
    if (!isLoggedIn) return;
    try {
      const res = await fetch("/api/member/my-applications");
      if (!res.ok) return;
      myApplications = await res.json();
      renderMyApplications();
      markAppliedTeams();
    } catch {
      /* silent */
    }
  }

  function renderMyApplications() {
    const wrap = $("[data-my-applications-wrap]");
    if (!myApplications.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    $("#myApplicationsList").innerHTML = myApplications
      .map(
        (a) => `
      <div class="my-app-row">
        <span>${escapeHtml(TEAM_LABELS[a.team] || a.team)}</span>
        <span class="status-pill ${a.status}">${STATUS_LABELS[a.status] || a.status}</span>
      </div>`
      )
      .join("");
  }

  function markAppliedTeams() {
    const activeTeams = new Set(myApplications.filter((a) => a.status !== "rejected").map((a) => a.team));
    document.querySelectorAll("[data-team]").forEach((card) => {
      card.classList.toggle("is-applied", activeTeams.has(card.dataset.team));
    });
  }

  const modal = $("#applyModal");
  document.querySelectorAll("[data-apply-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isLoggedIn) {
        window.location.href = "/api/auth/discord";
        return;
      }
      currentTeam = btn.dataset.applyBtn;
      $("#applyModalTitle").textContent = `التقديم على ${TEAM_LABELS[currentTeam]}`;
      $("#applyMessage").value = "";
      $("#applyError").textContent = "";
      modal.classList.add("active");
    });
  });
  $("#applyCancel").addEventListener("click", () => modal.classList.remove("active"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });

  $("#applySubmit").addEventListener("click", async () => {
    const errorEl = $("#applyError");
    try {
      const res = await fetch("/api/member/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: currentTeam, message: $("#applyMessage").value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر الإرسال");
      modal.classList.remove("active");
      loadMyApplications();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  checkLogin().then(loadMyApplications);
})();
