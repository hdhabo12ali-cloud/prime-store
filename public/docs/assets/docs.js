"use strict";
(() => {
  const $ = (sel) => document.querySelector(sel);
  const STORAGE_KEY = "prime_store_api_key";

  const gateShell = $("#gateShell");
  const docsShell = $("#docsShell");
  const gateForm = $("#gateForm");
  const keyInput = $("#keyInput");
  const gateError = $("#gateError");

  async function verifyKey(key) {
    const res = await fetch("/api/keys/verify", {
      headers: { "x-api-key": key },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || "مفتاح غير صالح");
    return data;
  }

  function showDocs(key, label) {
    gateShell.style.display = "none";
    docsShell.classList.add("active");
    $("#keyLabel").textContent = label ? `مرحبًا، ${label}` : "متصل";

    const origin = window.location.origin;
    $("#curlCatalog").textContent = `curl "${origin}/api/bot/catalog" \\\n  -H "x-api-key: ${key}"`;
    $("#curlSettings").textContent = `curl "${origin}/api/bot/settings" \\\n  -H "x-api-key: ${key}"`;
    $("#curlFree").textContent = `curl "${origin}/api/bot/free" \\\n  -H "x-api-key: ${key}"`;
    $("#pySnippet").textContent =
      `import requests\n\n` +
      `res = requests.get(\n    "${origin}/api/bot/catalog",\n    headers={"x-api-key": "${key}"},\n)\n` +
      `print(res.json())`;
  }

  async function tryStoredKey() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const data = await verifyKey(stored);
      showDocs(stored, data.label);
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  gateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    gateError.textContent = "";
    const key = keyInput.value.trim();
    if (!key) return;
    const btn = gateForm.querySelector("button");
    btn.disabled = true;
    btn.textContent = "جارِ التحقق...";
    try {
      const data = await verifyKey(key);
      localStorage.setItem(STORAGE_KEY, key);
      showDocs(key, data.label);
    } catch (err) {
      gateError.textContent = err.message || "تعذّر التحقق من المفتاح.";
    } finally {
      btn.disabled = false;
      btn.textContent = "تحقق من المفتاح";
    }
  });

  $("#signOutBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    docsShell.classList.remove("active");
    gateShell.style.display = "flex";
    keyInput.value = "";
    keyInput.focus();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-copy-endpoint]");
    if (!btn) return;
    navigator.clipboard.writeText(window.location.origin + btn.dataset.copyEndpoint).then(() => {
      const original = btn.textContent;
      btn.textContent = "تم النسخ ✓";
      setTimeout(() => (btn.textContent = original), 1500);
    });
  });

  tryStoredKey();
})();
