"use strict";
(() => {
  const $ = (sel) => document.querySelector(sel);
  const REPO = "hdhabo12ali-cloud/prime-store";

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function loadLatestRelease() {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
      if (!res.ok) throw new Error("تعذّر جلب آخر إصدار");
      const release = await res.json();

      $("[data-version-badge]").textContent = `آخر إصدار: ${release.tag_name || release.name || "—"}`;
      $("[data-changelog-body]").textContent = release.body || "لا يوجد تفاصيل لهذا الإصدار.";

      const setupAsset = (release.assets || []).find((a) => a.name === "PrimeStore-Setup.exe");
      const portableAsset = (release.assets || []).find((a) => a.name === "PrimeStore-Portable.exe");
      if (setupAsset) $("[data-dl-setup]").href = setupAsset.browser_download_url;
      if (portableAsset) $("[data-dl-portable]").href = portableAsset.browser_download_url;
    } catch (err) {
      $("[data-version-badge]").textContent = "تعذّر التحقق من آخر إصدار — جرّب رابط GitHub مباشرة";
      $("[data-changelog-body]").textContent = "—";
      $("[data-dl-setup]").href = `https://github.com/${REPO}/releases/latest`;
      $("[data-dl-portable]").href = `https://github.com/${REPO}/releases/latest`;
    }
  }

  loadLatestRelease();
})();
