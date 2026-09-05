"use strict";
(() => {
  const $ = (sel) => document.querySelector(sel);
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
    $("[data-redeem-box]").hidden = !isLoggedIn;
  }

  async function loadMyLicenses() {
    if (!isLoggedIn) return;
    try {
      const res = await fetch("/api/member/my-licenses");
      if (!res.ok) return;
      const licenses = await res.json();
      const wrap = $("[data-my-licenses-wrap]");
      if (!licenses.length) {
        wrap.hidden = true;
        return;
      }
      wrap.hidden = false;
      $("#myLicensesList").innerHTML = licenses
        .map(
          (l) => `
        <div class="license-row">
          <span>${escapeHtml(l.itemName)}</span>
          <span class="key">${escapeHtml(l.keyCode)}</span>
        </div>`
        )
        .join("");
    } catch {
      /* silent */
    }
  }

  $("[data-redeem-btn]").addEventListener("click", async () => {
    const msgEl = $("[data-redeem-msg]");
    const keyCode = $("[data-key-input]").value.trim();
    if (!keyCode) return;
    msgEl.className = "redeem-msg";
    msgEl.textContent = "جارٍ التحقق...";
    try {
      const res = await fetch("/api/member/redeem-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر التفعيل");
      msgEl.className = "redeem-msg ok";
      msgEl.textContent = data.alreadyYours ? `عندك هذا المنتج مفعّل أصلاً: ${data.itemName}` : `تم تفعيل: ${data.itemName} ✓`;
      $("[data-key-input]").value = "";
      loadMyLicenses();
    } catch (err) {
      msgEl.className = "redeem-msg error";
      msgEl.textContent = err.message;
    }
  });

  checkLogin().then(loadMyLicenses);
})();
