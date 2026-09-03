"use strict";
(() => {
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  const loginShell = $("#loginShell");
  const appShell = $("#appShell");
  const toastEl = $("#toast");

  let state = { packages: [], products: [], freeBots: [], apiKeys: [], settings: {}, aiConfig: {}, plans: [], banners: [], applications: [], username: "" };

  function showToast(message, kind) {
    toastEl.textContent = message;
    toastEl.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toastEl.className = "toast"), 3200);
  }

  async function api(path, options) {
    options = options || {};
    const res = await fetch(path, {
      method: options.method || "GET",
      headers: Object.assign(
        { "Content-Type": "application/json", "X-Requested-With": "fetch" },
        options.headers || {}
      ),
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------------- Auth ----------------
  const LOGIN_ERROR_MESSAGES = {
    not_allowed: "حساب الديسكورد هذا غير مصرّح له بدخول لوحة التحكم.",
    state: "انتهت صلاحية محاولة الدخول، حاول مرة ثانية.",
    token: "تعذّر إكمال تسجيل الدخول عبر Discord، حاول مرة ثانية.",
    cancelled: "تم إلغاء تسجيل الدخول.",
    config: "إعدادات Discord OAuth ناقصة على السيرفر.",
  };

  async function checkSession() {
    try {
      const data = await api("/admin/api/me");
      enterApp(data);
    } catch (e) {
      showLogin();
    }
  }

  function showLogin() {
    loginShell.style.display = "flex";
    appShell.classList.remove("active");
    const params = new URLSearchParams(window.location.search);
    const errCode = params.get("login_error");
    if (errCode) {
      $("#loginError").textContent = LOGIN_ERROR_MESSAGES[errCode] || "تعذّر تسجيل الدخول، حاول مرة ثانية.";
      params.delete("login_error");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
    }
  }

  function enterApp(me) {
    loginShell.style.display = "none";
    appShell.classList.add("active");
    state.username = me.username;
    $("#currentUser").innerHTML = "";
    if (me.avatarUrl) {
      const img = document.createElement("img");
      img.src = me.avatarUrl;
      img.alt = "";
      $("#currentUser").appendChild(img);
    }
    const nameSpan = document.createElement("span");
    nameSpan.textContent = me.username;
    $("#currentUser").appendChild(nameSpan);
    if ($("#accountAvatar")) $("#accountAvatar").src = me.avatarUrl || "";
    if ($("#accountName")) $("#accountName").textContent = me.username;
    if ($("#accountId")) $("#accountId").textContent = me.discordId || "";
    loadAll();
  }

  $("#logoutBtn").addEventListener("click", async () => {
    try {
      await api("/admin/api/logout", { method: "POST" });
    } catch (e) {}
    showLogin();
  });

  // ---------------- Navigation ----------------
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      $$(".view").forEach((v) => v.classList.remove("active"));
      $("#view-" + view).classList.add("active");
    });
  });

  // ---------------- Data loading ----------------
  async function loadAll() {
    try {
      const [data, keys, freeBots, aiConfig, plans, banners, applications] = await Promise.all([
        api("/admin/api/data"),
        api("/admin/api/apikeys"),
        api("/admin/api/free"),
        api("/admin/api/ai-config"),
        api("/admin/api/plans"),
        api("/admin/api/banners"),
        api("/admin/api/applications"),
      ]);
      state.packages = data.packages;
      state.products = data.products;
      state.settings = data.settings;
      state.apiKeys = keys;
      state.freeBots = freeBots;
      state.aiConfig = aiConfig;
      state.plans = plans;
      state.banners = banners;
      state.applications = applications;
      renderOverview();
      renderPackages();
      renderProducts();
      renderSettings();
      renderKeys();
      renderFreeBots();
      renderAiConfig();
      renderPlans();
      renderBanners();
      renderApplications();
    } catch (err) {
      if (err.status === 401) showLogin();
      else showToast("تعذّر تحميل البيانات", "error");
    }
  }

  function renderOverview() {
    $("#statPackages").textContent = state.packages.length;
    $("#statProducts").textContent = state.products.length;
    $("#statKeys").textContent = state.apiKeys.length;
    if ($("#statFree")) $("#statFree").textContent = state.freeBots.length;
    if ($("#statPlans")) $("#statPlans").textContent = state.plans.length;
    if ($("#statBanners")) $("#statBanners").textContent = state.banners.filter((b) => b.active).length;
    $("#overviewDiscordLink").textContent = state.settings.discordInvite || "—";
  }

  function priceSummary(item) {
    const parts = [];
    if (item.lifetime) parts.push(`مدى الحياة: ${item.lifetime}`);
    if (item.monthly) parts.push(`شهري: ${item.monthly}`);
    if (item.openSource) parts.push(`مفتوح المصدر: ${item.openSource}`);
    if (item.price) parts.push(String(item.price));
    return parts.join(" · ") || "—";
  }

  function renderPackages(filter) {
    const q = (filter || $("#packagesSearch").value || "").trim().toLowerCase();
    const rows = state.packages
      .filter((p) => !q || p.id.toLowerCase().includes(q) || (p.sourceName || "").toLowerCase().includes(q))
      .map(
        (p) => `
      <tr>
        <td class="mono">${escapeHtml(p.id)}</td>
        <td>${escapeHtml(p.sourceName || p.key || "")}</td>
        <td>${escapeHtml(priceSummary(p))}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="packages:${escapeAttr(p.id)}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del="packages:${escapeAttr(p.id)}">حذف</button>
        </td>
      </tr>`
      )
      .join("");
    $("#packagesTable").innerHTML = rows || `<tr><td colspan="4" style="color:var(--muted)">لا توجد نتائج</td></tr>`;
  }

  function renderProducts(filter) {
    const q = (filter || $("#productsSearch").value || "").trim().toLowerCase();
    const rows = state.products
      .filter((p) => !q || p.id.toLowerCase().includes(q) || (p.name || p.sourceName || "").toLowerCase().includes(q))
      .map(
        (p) => `
      <tr>
        <td class="mono">${escapeHtml(p.id)}</td>
        <td>${escapeHtml(p.name || p.sourceName || "")}</td>
        <td>${escapeHtml(priceSummary(p))}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-edit="products:${escapeAttr(p.id)}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del="products:${escapeAttr(p.id)}">حذف</button>
        </td>
      </tr>`
      )
      .join("");
    $("#productsTable").innerHTML = rows || `<tr><td colspan="4" style="color:var(--muted)">لا توجد نتائج</td></tr>`;
  }

  function renderSettings() {
    $("#siteNameInput").value = state.settings.siteName || "";
    $("#discordInviteInput").value = state.settings.discordInvite || "";
  }

  function renderKeys() {
    const rows = state.apiKeys
      .map(
        (k) => `
      <tr>
        <td>${escapeHtml(k.label)}</td>
        <td class="mono">${escapeHtml(k.key)}</td>
        <td>${escapeHtml(new Date(k.createdAt).toLocaleString("ar"))}</td>
        <td class="actions"><button class="btn btn-danger btn-sm" data-revoke="${escapeAttr(k.key)}">إلغاء</button></td>
      </tr>`
      )
      .join("");
    $("#keysTable").innerHTML = rows || `<tr><td colspan="4" style="color:var(--muted)">لا توجد مفاتيح</td></tr>`;
  }

  function renderPlans() {
    const rows = state.plans
      .map(
        (p) => `
      <tr>
        <td class="mono">${escapeHtml(p.id)}</td>
        <td>${escapeHtml(p.name)}${p.badge ? ` <span class="badge">${escapeHtml(p.badge)}</span>` : ""}</td>
        <td>${escapeHtml(p.price)}${escapeHtml(p.period || "")}</td>
        <td>${p.featured ? "✓" : "—"}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-edit-plan="${escapeAttr(p.id)}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del-plan="${escapeAttr(p.id)}">حذف</button>
        </td>
      </tr>`
      )
      .join("");
    $("#plansTable").innerHTML = rows || `<tr><td colspan="5" style="color:var(--muted)">لا توجد خطط بعد</td></tr>`;
  }

  function renderBanners() {
    const rows = state.banners
      .map(
        (b) => `
      <tr>
        <td><img src="${escapeAttr(b.imageUrl)}" alt="" style="width:64px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--line);" /></td>
        <td>${escapeHtml(b.title)}</td>
        <td>${b.active ? "✓" : "—"}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-edit-banner="${escapeAttr(b.id)}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del-banner="${escapeAttr(b.id)}">حذف</button>
        </td>
      </tr>`
      )
      .join("");
    $("#bannersTable").innerHTML = rows || `<tr><td colspan="4" style="color:var(--muted)">لا توجد شعارات بعد</td></tr>`;
  }

  // ---------------- Plan modal ----------------
  const planModalBackdrop = $("#planModalBackdrop");
  let planModalCtx = { id: null, isNew: false };

  function openPlanModal(id) {
    planModalCtx = { id, isNew: !id };
    const item = id ? state.plans.find((p) => p.id === id) : null;
    $("#planModalTitle").textContent = id ? `تعديل خطة: ${item ? item.name : ""}` : "إضافة خطة جديدة";
    $("#planIdInput").value = item ? item.id : "";
    $("#planIdInput").disabled = !!id;
    $("#planNameInput").value = item ? item.name || "" : "";
    $("#planPriceInput").value = item ? item.price || "" : "";
    $("#planPeriodInput").value = item ? item.period || "/mo" : "/mo";
    $("#planTaglineInput").value = item ? item.tagline || "" : "";
    $("#planFeaturesInput").value = item && item.features ? item.features.join("\n") : "";
    $("#planBadgeInput").value = item ? item.badge || "" : "";
    $("#planCtaInput").value = item ? item.ctaUrl || "" : "";
    $("#planFeaturedInput").checked = item ? !!item.featured : false;
    $("#planModalError").textContent = "";
    planModalBackdrop.classList.add("active");
  }
  function closePlanModal() {
    planModalBackdrop.classList.remove("active");
  }
  $("#addPlanBtn").addEventListener("click", () => openPlanModal(null));
  $("#planModalCancel").addEventListener("click", closePlanModal);
  planModalBackdrop.addEventListener("click", (e) => {
    if (e.target === planModalBackdrop) closePlanModal();
  });
  $("#planModalSave").addEventListener("click", async () => {
    const errorEl = $("#planModalError");
    errorEl.textContent = "";
    const id = $("#planIdInput").value.trim();
    const name = $("#planNameInput").value.trim();
    if ((planModalCtx.isNew && !id) || !name) {
      errorEl.textContent = "المعرف والاسم مطلوبين.";
      return;
    }
    const payload = {
      id: planModalCtx.isNew ? id : planModalCtx.id,
      name,
      price: $("#planPriceInput").value.trim(),
      period: $("#planPeriodInput").value.trim() || "/mo",
      tagline: $("#planTaglineInput").value.trim(),
      features: $("#planFeaturesInput").value.split("\n").map((s) => s.trim()).filter(Boolean),
      badge: $("#planBadgeInput").value.trim() || null,
      ctaUrl: $("#planCtaInput").value.trim() || null,
      featured: $("#planFeaturedInput").checked,
    };
    try {
      if (planModalCtx.isNew) {
        await api("/admin/api/plans", { method: "POST", body: payload });
        showToast("تمت إضافة الخطة", "ok");
      } else {
        await api(`/admin/api/plans/${encodeURIComponent(planModalCtx.id)}`, { method: "PUT", body: payload });
        showToast("تم الحفظ بنجاح", "ok");
      }
      closePlanModal();
      await loadAll();
    } catch (err) {
      errorEl.textContent = err.message || "حدث خطأ أثناء الحفظ.";
    }
  });

  // ---------------- Banner modal ----------------
  const bannerModalBackdrop = $("#bannerModalBackdrop");
  let bannerModalCtx = { id: null, isNew: false };

  function openBannerModal(id) {
    bannerModalCtx = { id, isNew: !id };
    const item = id ? state.banners.find((b) => b.id === id) : null;
    $("#bannerModalTitle").textContent = id ? `تعديل شعار: ${item ? item.title : ""}` : "إضافة شعار جديد";
    $("#bannerTitleInput").value = item ? item.title || "" : "";
    $("#bannerImageInput").value = item ? item.imageUrl || "" : "";
    $("#bannerLinkInput").value = item ? item.linkUrl || "" : "";
    $("#bannerActiveInput").checked = item ? !!item.active : true;
    $("#bannerModalError").textContent = "";
    bannerModalBackdrop.classList.add("active");
  }
  function closeBannerModal() {
    bannerModalBackdrop.classList.remove("active");
  }
  $("#addBannerBtn").addEventListener("click", () => openBannerModal(null));
  $("#bannerModalCancel").addEventListener("click", closeBannerModal);
  bannerModalBackdrop.addEventListener("click", (e) => {
    if (e.target === bannerModalBackdrop) closeBannerModal();
  });
  $("#bannerModalSave").addEventListener("click", async () => {
    const errorEl = $("#bannerModalError");
    errorEl.textContent = "";
    const title = $("#bannerTitleInput").value.trim();
    const imageUrl = $("#bannerImageInput").value.trim();
    if (!title || !imageUrl) {
      errorEl.textContent = "العنوان ورابط الصورة مطلوبين.";
      return;
    }
    const payload = {
      title,
      imageUrl,
      linkUrl: $("#bannerLinkInput").value.trim() || null,
      active: $("#bannerActiveInput").checked,
    };
    try {
      if (bannerModalCtx.isNew) {
        await api("/admin/api/banners", { method: "POST", body: payload });
        showToast("تمت إضافة الشعار", "ok");
      } else {
        await api(`/admin/api/banners/${encodeURIComponent(bannerModalCtx.id)}`, { method: "PUT", body: payload });
        showToast("تم الحفظ بنجاح", "ok");
      }
      closeBannerModal();
      await loadAll();
    } catch (err) {
      errorEl.textContent = err.message || "حدث خطأ أثناء الحفظ.";
    }
  });

  document.addEventListener("click", async (e) => {
    const editPlan = e.target.closest("[data-edit-plan]");
    const delPlan = e.target.closest("[data-del-plan]");
    const editBanner = e.target.closest("[data-edit-banner]");
    const delBanner = e.target.closest("[data-del-banner]");
    if (editPlan) {
      openPlanModal(editPlan.dataset.editPlan);
    } else if (delPlan) {
      const id = delPlan.dataset.delPlan;
      if (!confirm(`حذف الخطة "${id}"؟`)) return;
      try {
        await api(`/admin/api/plans/${encodeURIComponent(id)}`, { method: "DELETE" });
        showToast("تم الحذف", "ok");
        await loadAll();
      } catch (err) {
        showToast(err.message || "تعذّر الحذف", "error");
      }
    } else if (editBanner) {
      openBannerModal(editBanner.dataset.editBanner);
    } else if (delBanner) {
      const id = delBanner.dataset.delBanner;
      if (!confirm("حذف هذا الشعار؟")) return;
      try {
        await api(`/admin/api/banners/${encodeURIComponent(id)}`, { method: "DELETE" });
        showToast("تم الحذف", "ok");
        await loadAll();
      } catch (err) {
        showToast(err.message || "تعذّر الحذف", "error");
      }
    }
  });

  const TEAM_LABELS = {
    bot_developer: "Bot Developer",
    bot_team: "Bot Team",
    designer_team: "Designer Team",
    marketing_team: "Marketing Team",
    website_team: "Website Team",
  };
  const STATUS_LABELS = { pending: "قيد المراجعة", approved: "مقبول ✓", rejected: "مرفوض ✕" };

  function renderApplications() {
    const rows = state.applications
      .map((a) => {
        const memberName = a.member ? escapeHtml(a.member.username || a.member.email || "—") : "—";
        const actions =
          a.status === "pending"
            ? `<button class="btn btn-primary btn-sm" data-app-approve="${a.id}">قبول</button>
               <button class="btn btn-danger btn-sm" data-app-reject="${a.id}">رفض</button>`
            : `<span class="badge">${STATUS_LABELS[a.status] || a.status}</span>`;
        return `<tr>
          <td>${memberName}</td>
          <td>${escapeHtml(TEAM_LABELS[a.team] || a.team)}</td>
          <td style="max-width:280px;white-space:normal;">${escapeHtml(a.message || "—")}</td>
          <td>${STATUS_LABELS[a.status] || a.status}</td>
          <td class="actions">${actions}</td>
        </tr>`;
      })
      .join("");
    $("#applicationsTable").innerHTML = rows || `<tr><td colspan="5" style="color:var(--muted)">لا توجد تقديمات بعد</td></tr>`;
  }

  document.addEventListener("click", async (e) => {
    const approveBtn = e.target.closest("[data-app-approve]");
    const rejectBtn = e.target.closest("[data-app-reject]");
    if (approveBtn) {
      await api(`/admin/api/applications/${approveBtn.dataset.appApprove}/approve`, { method: "POST" });
      showToast("تم قبول التقديم", "ok");
      await loadAll();
    } else if (rejectBtn) {
      await api(`/admin/api/applications/${rejectBtn.dataset.appReject}/reject`, { method: "POST" });
      showToast("تم رفض التقديم", "ok");
      await loadAll();
    }
  });

  $("#packagesSearch").addEventListener("input", (e) => renderPackages(e.target.value));
  $("#productsSearch").addEventListener("input", (e) => renderProducts(e.target.value));

  function renderFreeBots(filter) {
    const q = (filter || ($("#freeSearch") ? $("#freeSearch").value : "") || "").trim().toLowerCase();
    const rows = state.freeBots
      .filter((f) => !q || (f.name || "").toLowerCase().includes(q))
      .map((f) => {
        const mediaBits = [];
        if ((f.images || []).length) mediaBits.push(`${f.images.length} صورة`);
        if (f.videoUrl) mediaBits.push("فيديو");
        return `
      <tr>
        <td>${escapeHtml(f.name)}</td>
        <td>${escapeHtml((f.description || "").slice(0, 60))}${(f.description || "").length > 60 ? "…" : ""}</td>
        <td>${escapeHtml(mediaBits.join(" · ") || "—")}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-edit-free="${escapeAttr(f.id)}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del-free="${escapeAttr(f.id)}">حذف</button>
        </td>
      </tr>`;
      })
      .join("");
    $("#freeTable").innerHTML = rows || `<tr><td colspan="4" style="color:var(--muted)">لا توجد بوتات مجانية بعد</td></tr>`;
  }
  if ($("#freeSearch")) $("#freeSearch").addEventListener("input", (e) => renderFreeBots(e.target.value));

  function renderAiConfig() {
    const c = state.aiConfig || {};
    if ($("#aiEnabledInput")) $("#aiEnabledInput").checked = !!c.enabled;
    if ($("#aiPlacementInput")) $("#aiPlacementInput").value = c.placement || "";
    if ($("#aiTitleInput")) $("#aiTitleInput").value = c.title || "";
    if ($("#aiAccessCodeInput")) $("#aiAccessCodeInput").value = c.accessCode || "";
    if ($("#aiSystemPromptInput")) $("#aiSystemPromptInput").value = c.systemPrompt || "";
  }

  if ($("#aiConfigForm")) {
    $("#aiConfigForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("/admin/api/ai-config", {
          method: "PUT",
          body: {
            enabled: $("#aiEnabledInput").checked,
            placement: $("#aiPlacementInput").value.trim(),
            title: $("#aiTitleInput").value.trim(),
            accessCode: $("#aiAccessCodeInput").value.trim(),
            systemPrompt: $("#aiSystemPromptInput").value,
          },
        });
        showToast("تم حفظ إعدادات المساعد الذكي", "ok");
        await loadAll();
      } catch (err) {
        showToast(err.message || "تعذّر الحفظ", "error");
      }
    });
  }

  // ---------------- Free bot modal ----------------
  const freeModalBackdrop = $("#freeModalBackdrop");
  let freeModalCtx = { id: null, isNew: false };

  function openFreeModal(id) {
    freeModalCtx = { id, isNew: !id };
    const item = id ? state.freeBots.find((f) => f.id === id) : null;
    $("#freeModalTitle").textContent = id ? `تعديل: ${item ? item.name : ""}` : "إضافة بوت مجاني";
    $("#freeNameInput").value = item ? item.name || "" : "";
    $("#freeDescInput").value = item ? item.description || "" : "";
    $("#freeDownloadInput").value = item ? item.downloadUrl || "" : "";
    $("#freeVideoInput").value = item ? item.videoUrl || "" : "";
    $("#freeImagesInput").value = item && item.images ? item.images.join("\n") : "";
    $("#freeTagsInput").value = item && item.tags ? item.tags.join(", ") : "";
    $("#freeModalError").textContent = "";
    freeModalBackdrop.classList.add("active");
  }
  function closeFreeModal() {
    freeModalBackdrop.classList.remove("active");
  }
  if ($("#addFreeBtn")) $("#addFreeBtn").addEventListener("click", () => openFreeModal(null));
  if ($("#freeModalCancel")) $("#freeModalCancel").addEventListener("click", closeFreeModal);
  freeModalBackdrop.addEventListener("click", (e) => {
    if (e.target === freeModalBackdrop) closeFreeModal();
  });

  if ($("#freeModalSave")) {
    $("#freeModalSave").addEventListener("click", async () => {
      const errorEl = $("#freeModalError");
      errorEl.textContent = "";
      const name = $("#freeNameInput").value.trim();
      const downloadUrl = $("#freeDownloadInput").value.trim();
      if (!name || !downloadUrl) {
        errorEl.textContent = "الاسم ورابط التحميل مطلوبين.";
        return;
      }
      const payload = {
        name,
        description: $("#freeDescInput").value.trim(),
        downloadUrl,
        videoUrl: $("#freeVideoInput").value.trim() || null,
        images: $("#freeImagesInput").value.split("\n").map((s) => s.trim()).filter(Boolean),
        tags: $("#freeTagsInput").value.split(",").map((s) => s.trim()).filter(Boolean),
      };
      try {
        if (freeModalCtx.isNew) {
          await api("/admin/api/free", { method: "POST", body: payload });
          showToast("تمت إضافة البوت المجاني", "ok");
        } else {
          await api(`/admin/api/free/${encodeURIComponent(freeModalCtx.id)}`, { method: "PUT", body: payload });
          showToast("تم الحفظ بنجاح", "ok");
        }
        closeFreeModal();
        await loadAll();
      } catch (err) {
        errorEl.textContent = err.message || "حدث خطأ أثناء الحفظ.";
      }
    });
  }

  document.addEventListener("click", async (e) => {
    const editFreeTarget = e.target.closest("[data-edit-free]");
    const delFreeTarget = e.target.closest("[data-del-free]");
    if (editFreeTarget) {
      openFreeModal(editFreeTarget.dataset.editFree);
    } else if (delFreeTarget) {
      const id = delFreeTarget.dataset.delFree;
      if (!confirm("حذف هذا البوت المجاني؟ لا يمكن التراجع عن هذا الإجراء.")) return;
      try {
        await api(`/admin/api/free/${encodeURIComponent(id)}`, { method: "DELETE" });
        showToast("تم الحذف", "ok");
        await loadAll();
      } catch (err) {
        showToast(err.message || "تعذّر الحذف", "error");
      }
    }
  });

  // ---------------- Item modal (add/edit package or product) ----------------
  const modalBackdrop = $("#itemModalBackdrop");
  let modalCtx = { collection: null, id: null, isNew: false };

  function openModal(collection, id) {
    modalCtx = { collection, id, isNew: !id };
    const list = collection === "packages" ? state.packages : state.products;
    const item = id ? list.find((it) => it.id === id) : { id: "" };
    $("#itemModalTitle").textContent = id
      ? `تعديل ${collection === "packages" ? "باكج" : "منتج"}: ${id}`
      : `إضافة ${collection === "packages" ? "باكج" : "منتج"} جديد`;
    $("#itemIdInput").value = item.id || "";
    $("#itemIdInput").disabled = !!id;
    const { id: _drop, ...rest } = item;
    $("#itemJsonInput").value = JSON.stringify(id ? rest : {}, null, 2);
    $("#itemModalError").textContent = "";
    modalBackdrop.classList.add("active");
  }
  function closeModal() {
    modalBackdrop.classList.remove("active");
  }
  $("#itemModalCancel").addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  $("#itemModalSave").addEventListener("click", async () => {
    const errorEl = $("#itemModalError");
    errorEl.textContent = "";
    const id = $("#itemIdInput").value.trim();
    let payload;
    try {
      payload = JSON.parse($("#itemJsonInput").value || "{}");
    } catch (e) {
      errorEl.textContent = "صيغة JSON غير صحيحة.";
      return;
    }
    if (modalCtx.isNew && id) payload.id = id;
    try {
      if (modalCtx.isNew) {
        await api(`/admin/api/${modalCtx.collection}`, { method: "POST", body: payload });
        showToast("تمت الإضافة بنجاح", "ok");
      } else {
        await api(`/admin/api/${modalCtx.collection}/${encodeURIComponent(modalCtx.id)}`, {
          method: "PUT",
          body: payload,
        });
        showToast("تم الحفظ بنجاح", "ok");
      }
      closeModal();
      await loadAll();
    } catch (err) {
      errorEl.textContent = err.message || "حدث خطأ أثناء الحفظ.";
    }
  });

  $("#addPackageBtn").addEventListener("click", () => openModal("packages", null));
  $("#addProductBtn").addEventListener("click", () => openModal("products", null));

  document.addEventListener("click", async (e) => {
    const editTarget = e.target.closest("[data-edit]");
    const delTarget = e.target.closest("[data-del]");
    const revokeTarget = e.target.closest("[data-revoke]");
    if (editTarget) {
      const [collection, id] = editTarget.dataset.edit.split(":");
      openModal(collection, id);
    } else if (delTarget) {
      const [collection, id] = delTarget.dataset.del.split(":");
      if (!confirm(`حذف "${id}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
      try {
        await api(`/admin/api/${collection}/${encodeURIComponent(id)}`, { method: "DELETE" });
        showToast("تم الحذف", "ok");
        await loadAll();
      } catch (err) {
        showToast(err.message || "تعذّر الحذف", "error");
      }
    } else if (revokeTarget) {
      const key = revokeTarget.dataset.revoke;
      if (!confirm("إلغاء هذا المفتاح؟ أي بوت يستخدمه سيتوقف عن العمل فورًا.")) return;
      try {
        await api(`/admin/api/apikeys/${encodeURIComponent(key)}`, { method: "DELETE" });
        showToast("تم إلغاء المفتاح", "ok");
        await loadAll();
      } catch (err) {
        showToast(err.message || "تعذّر الإلغاء", "error");
      }
    }
  });

  $("#addKeyBtn").addEventListener("click", async () => {
    const label = prompt("اسم/وصف المفتاح (مثال: بوت الديسكورد الرئيسي):", "بوت الديسكورد");
    if (label === null) return;
    try {
      await api("/admin/api/apikeys", { method: "POST", body: { label } });
      showToast("تم توليد مفتاح جديد", "ok");
      await loadAll();
    } catch (err) {
      showToast(err.message || "تعذّر إنشاء المفتاح", "error");
    }
  });

  // ---------------- Settings ----------------
  $("#settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/admin/api/settings", {
        method: "PUT",
        body: {
          siteName: $("#siteNameInput").value.trim(),
          discordInvite: $("#discordInviteInput").value.trim(),
        },
      });
      showToast("تم حفظ الإعدادات", "ok");
      await loadAll();
    } catch (err) {
      showToast(err.message || "تعذّر الحفظ", "error");
    }
  });

  // ---------------- Utils ----------------
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }

  checkSession();
})();
