(() => {
  // =========================
  // CONFIG
  // =========================
  const SECTIONS = {
    team: {
      title: "Team",
      sectionId: "teamSection",
      gridId: "teamGrid",
      getUrl: "/api/team",
      postUrl: "/api/team",
      uploadUrl: "/api/upload?type=team",
      ordered: true,
      fields: {
        name: { label: "Name", type: "text" },
        role: { label: "Role / Position", type: "text" },
      },
      addUi: {
        nameId: "addName",
        roleId: "addRole",
        posId: "addPos",
        fileId: "addFile",
        addBtnId: "addBtn",
        saveOrderBtnId: "saveOrderBtn",
        msgId: "addMsg",
      },
    },

    sponsors: {
      title: "Sponsors",
      sectionId: "sponsorsSection",
      gridId: "sponsorGrid", // fallback if 3 grids not exist
      getUrl: "/api/sponsors",
      postUrl: "/api/sponsors",
      uploadUrl: "/api/upload?type=sponsor",
      ordered: true,
      fields: {
        name: { label: "Name", type: "text" },
        desc: { label: "Description", type: "textarea" },
        tier: {
          label: "Tier",
          type: "select",
          options: [
            { value: "platinum", label: "Platinum" },
            { value: "gold", label: "Gold" },
            { value: "silver", label: "Silver" },
            { value: "bronze", label: "Bronze" },
          ],
        },
      },
      addUi: {
        nameId: "sAddName",
        // دعم قديم: إذا لسه عندك sAddRole بدل sAddDesc
        descId: "sAddDesc",
        legacyDescId: "sAddRole",
        tierId: "sAddTier",
        posId: "sAddPos",
        fileId: "sAddFile",
        addBtnId: "sAddBtn",
        saveOrderBtnId: "sSaveOrderBtn",
        msgId: "sAddMsg",
      },
      // 3 grids (لازم تكون موجودة بالـ admin.html عشان ينقسم)
      gridsByTier: {
        platinum: "sponsorPlatinumGrid",
        gold: "sponsorGoldGrid",
        silver: "sponsorSilverGrid",
        bronze: "sponsorBronzeGrid",
      },
      maxPerTier: 5,
    },

    speakers: {
      title: "Speakers",
      sectionId: "speakersSection",
      gridId: "speakerGrid",
      getUrl: "/api/speakers",
      postUrl: "/api/speakers",
      uploadUrl: "/api/upload?type=speaker",
      ordered: true,
      fields: {
        name: { label: "Name", type: "text" },
        role: { label: "Role / Position", type: "text" },
        desc: { label: "Description", type: "textarea" },
        insta: { label: "Instagram link", type: "text" },
      },
      addUi: {
        nameId: "spAddName",
        roleId: "spAddRole",
        descId: "spAddDesc", // optional (if you add later)
        instaId: "spAddInsta", // optional (if you add later)
        posId: "spAddPos",
        fileId: "spAddFile",
        addBtnId: "spAddBtn",
        saveOrderBtnId: "spSaveOrderBtn",
        msgId: "spAddMsg",
      },
    },
  };

  const FALLBACK_IMG = "assets/tedx_logo.png";

  // =========================
  // HELPERS
  // =========================
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  function getImgCandidates(key) {
    return [
      `assets/${key}.jpeg`,
      `assets/${key}.jpg`,
      `assets/${key}.png`,
      `assets/${key}.webp`,
      FALLBACK_IMG,
    ];
  }

  window.__tedxImgFallback = (img) => {
    const key = img.dataset.key;
    const list = getImgCandidates(key);
    let i = parseInt(img.dataset.try || "0", 10) + 1;

    if (i < list.length) {
      img.dataset.try = i;
      img.src = list[i] + "?t=" + Date.now();
    } else {
      img.onerror = null;
      img.src = FALLBACK_IMG;
    }
  };

  async function fetchJson(url) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      return r.ok ? await r.json() : {};
    } catch {
      return {};
    }
  }

  async function postJson(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r;
  }

  async function uploadImage(section, key, file) {
 const fd = new FormData();
fd.append("key", key);
fd.append("file", file);

    const r = await fetch(section.uploadUrl, { method: "POST", body: fd });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d?.path || null;
  }

  async function addMember(section, payload) {
    const r = await postJson(section.postUrl, { action: "add", ...payload });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d?.key || null;
  }

  async function deleteMember(section, key) {
    const r = await postJson(section.postUrl, { action: "delete", key });
    return r.ok;
  }

  async function saveOrder(section, order) {
    const r = await postJson(section.postUrl, { action: "reorder", order });
    return r.ok;
  }

  async function saveMember(section, key, payload) {
    const r = await postJson(section.postUrl, { key, ...payload });
    return r.ok;
  }

  function normalizeOrdered(data) {
    if (!data || typeof data !== "object") return { order: [], members: {} };
    if (Array.isArray(data.order) && data.members && typeof data.members === "object") {
      return { order: data.order.map(String), members: data.members };
    }
    // flat
    const members = {};
    const order = [];
    for (const [k, v] of Object.entries(data)) {
      if (k === "order" || k === "members") continue;
      if (v && typeof v === "object") {
        members[k] = v;
        order.push(k);
      }
    }
    return { order, members };
  }

  // =========================
  // CARD TEMPLATE
  // =========================
  function fieldInputHtml(fieldKey, def, value) {
    const v = esc(value ?? "");
    if (def.type === "textarea") {
      return `<textarea class="form-control form-control-sm mb-2 field-input" data-field="${fieldKey}" rows="3" placeholder="${esc(def.label)}">${v}</textarea>`;
    }
    if (def.type === "select") {
      const opts = (def.options || [])
        .map(
          (o) =>
            `<option value="${esc(o.value)}" ${
              String(value || "").toLowerCase() === String(o.value).toLowerCase() ? "selected" : ""
            }>${esc(o.label)}</option>`
        )
        .join("");
      return `<select class="form-select form-select-sm mb-2 field-input" data-field="${fieldKey}">${opts}</select>`;
    }
    return `<input class="form-control form-control-sm mb-2 field-input" data-field="${fieldKey}" placeholder="${esc(def.label)}" value="${v}">`;
  }

  function cardTemplate(section, key, info, orderIndex) {
    const img = info?.img || getImgCandidates(key)[0];

    // sponsors defaults
    const normalizedInfo = { ...(info || {}) };
    if (section === SECTIONS.sponsors) {
      if (!normalizedInfo.tier) normalizedInfo.tier = "platinum";
      if (normalizedInfo.tier) normalizedInfo.tier = String(normalizedInfo.tier).toLowerCase();
    }

   return `
  <div class="col-12 col-md-6 col-lg-4" data-item-key="${key}">
        <div class="card border-0 rounded-4" style="background:rgba(0,0,0,.35)">
          <div class="card-body">
            <div class="d-flex gap-3 align-items-center">
              <div style="width:80px;height:80px;border-radius:16px;overflow:hidden;background:#111">
                <img class="person-img"
                     data-key="${key}"
                     data-try="0"
                     src="${img}"
                     style="width:100%;height:100%;object-fit:cover"
                     onerror="window.__tedxImgFallback(this)">
              </div>

              <div class="flex-grow-1">
                ${
                  section.ordered
                    ? `
                  <div class="d-flex gap-2 mb-2">
                    <input class="form-control form-control-sm order-input" type="number" min="1"
                           value="${Number.isFinite(orderIndex) ? orderIndex + 1 : ""}"
                           style="max-width:110px" title="Order #">
                    <div class="small text-secondary align-self-center">Order #</div>
                  </div>
                `
                    : ``
                }

                ${Object.entries(section.fields)
                  .map(([fieldKey, def]) => fieldInputHtml(fieldKey, def, normalizedInfo?.[fieldKey] ?? ""))
                  .join("")}
              </div>
            </div>

            <div class="d-flex gap-2 mt-3">
              <label class="btn btn-outline-light btn-sm rounded-pill flex-grow-1">
                Upload
                <input type="file" class="d-none file-input" accept="image/*">
              </label>
              <button class="btn btn-danger btn-sm rounded-pill flex-grow-1 save-btn">Save</button>
              <button class="btn btn-outline-danger btn-sm rounded-pill delete-btn">Delete</button>
            </div>

            <div class="small mt-2 msg text-secondary"></div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================
  // BIND CARD EVENTS
  // =========================
  function bindCardEvents(sectionKey, section, containerEl, listKeys) {
   containerEl.querySelectorAll('[data-item-key]').forEach((card) => {
  const k = card.getAttribute("data-item-key");

      const imgEl = card.querySelector(".person-img");
      const fileEl = card.querySelector(".file-input");
      const msgEl = card.querySelector(".msg");
      const orderInput = card.querySelector(".order-input");

      // upload
      if (fileEl) {
        fileEl.onchange = async () => {
          const f = fileEl.files?.[0];
          if (!f || !f.type?.startsWith("image/")) return;
          msgEl.textContent = "Uploading...";
          const p = await uploadImage(section, k, f);
          if (p) {
            imgEl.src = p + "?t=" + Date.now();
            imgEl.dataset.try = "0";
            msgEl.textContent = "✅ Uploaded";
          } else {
            msgEl.textContent = "❌ Failed";
          }
        };
      }

      // save
      const saveBtn = card.querySelector(".save-btn");
      if (saveBtn) {
        saveBtn.onclick = async () => {
          msgEl.textContent = "Saving...";

          const payload = {};
          card.querySelectorAll(".field-input").forEach((el) => {
            const field = el.dataset.field;
            if (!field) return;
            payload[field] = el.value;
          });

          // normalize tier
          if (sectionKey === "sponsors") {
            payload.tier = String(payload.tier || "platinum").toLowerCase();
          }

          const ok = await saveMember(section, k, payload);
          msgEl.textContent = ok ? "✅ Saved" : "❌ Failed";
        };
      }

      // delete
      const delBtn = card.querySelector(".delete-btn");
      if (delBtn) {
        delBtn.onclick = async () => {
          if (!confirm("حذف العنصر نهائياً؟")) return;
          msgEl.textContent = "Deleting...";
          const ok = await deleteMember(section, k);
          msgEl.textContent = ok ? "✅ Deleted" : "❌ Failed";
          if (ok) renderSection(sectionKey);
        };
      }

      // order validation
      if (section.ordered && orderInput) {
        orderInput.onchange = () => {
          const v = Number(orderInput.value);
          if (!Number.isFinite(v) || v < 1) return;
          orderInput.value = String(Math.floor(v));
        };
      }
    });
  }

  // =========================
  // RENDER SECTION
  // =========================
  async function renderSection(sectionKey) {
    const section = SECTIONS[sectionKey];

    // --- Special render for Sponsors into 3 tiers ---
    if (sectionKey === "sponsors") {
      const data = normalizeOrdered(await fetchJson(section.getUrl));
      const order = Array.isArray(data.order) ? data.order : [];
      const members = data.members || {};

      const platinumEl = document.getElementById(section.gridsByTier.platinum);
      const goldEl = document.getElementById(section.gridsByTier.gold);
      const silverEl = document.getElementById(section.gridsByTier.silver);
      const bronzeEl = document.getElementById(section.gridsByTier.bronze);

      // إذا الأربع grids موجودين → قسّم
      if (platinumEl && goldEl && silverEl && bronzeEl) {
        const tiers = { platinum: [], gold: [], silver: [], bronze: [] };

        for (const k of order) {
          const t = String(members?.[k]?.tier || "platinum").toLowerCase();
          if (tiers[t]) tiers[t].push(k);
        }
        // keys موجودة بالمembers بس مش بالorder
        for (const k of Object.keys(members)) {
          if (order.includes(k)) continue;
          const t = String(members?.[k]?.tier || "platinum").toLowerCase();
          if (tiers[t]) tiers[t].push(k);
        }

        const renderTier = (gridEl, tier) => {
          const keys = tiers[tier];
          gridEl.innerHTML = keys.map((k, idx) => cardTemplate(section, k, members[k] || {}, idx)).join("");
          bindCardEvents(sectionKey, section, gridEl, keys);
        };

        renderTier(platinumEl, "platinum");
        renderTier(goldEl, "gold");
        renderTier(silverEl, "silver");
        renderTier(bronzeEl, "bronze");
        return;
      }

      // fallback grid واحد (إذا ما أضفت الثلاث grids بالـ admin.html)
      const grid = document.getElementById(section.gridId);
      if (!grid) return;
      const allKeys = order.length ? order : Object.keys(members);
      grid.innerHTML = allKeys.map((k, idx) => cardTemplate(section, k, members[k] || {}, idx)).join("");
      bindCardEvents(sectionKey, section, grid, allKeys);
      return;
    }

    // --- Default render (Team / Speakers) ---
    const grid = document.getElementById(section.gridId);
    if (!grid) return;

    const data = normalizeOrdered(await fetchJson(section.getUrl));
    const order = Array.isArray(data.order) && data.order.length ? data.order : Object.keys(data.members || {});

    grid.innerHTML = order.map((k, idx) => cardTemplate(section, k, data.members?.[k] || {}, idx)).join("");
    bindCardEvents(sectionKey, section, grid, order);
  }

  // =========================
  // TABS
  // =========================
  function setActive(secKey) {
    $$("[data-section]").forEach((b) => {
      b.classList.toggle("btn-danger", b.dataset.section === secKey);
      b.classList.toggle("btn-outline-light", b.dataset.section !== secKey);
    });

    Object.entries(SECTIONS).forEach(([k, s]) => {
      const el = document.getElementById(s.sectionId);
      if (el) el.style.display = k === secKey ? "" : "none";
    });
  }

  // =========================
  // ADD + SAVE ORDER (wired per section)
  // =========================
  function wireAddUi(sectionKey) {
    const section = SECTIONS[sectionKey];
    const ui = section.addUi;
    if (!ui) return;

    const addBtn = document.getElementById(ui.addBtnId);
    const saveOrderBtn = document.getElementById(ui.saveOrderBtnId);
    const msg = document.getElementById(ui.msgId);

    // ---------- ADD ----------
    if (addBtn) {
      addBtn.onclick = async () => {
        // common
        const nameEl = document.getElementById(ui.nameId);
        const posEl = document.getElementById(ui.posId);
        const fileEl = document.getElementById(ui.fileId);

        const name = nameEl?.value?.trim() || "";
        const position = posEl?.value ? Number(posEl.value) : undefined;

        if (!name) {
          if (msg) msg.textContent = "❌ اكتب الاسم";
          return;
        }

        const payload = { name, position };

        if (sectionKey === "team") {
          const roleEl = document.getElementById(ui.roleId);
          const role = roleEl?.value?.trim() || "";
          if (!role) {
            if (msg) msg.textContent = "❌ اكتب المنصب";
            return;
          }
          payload.role = role;
        }

        if (sectionKey === "speakers") {
          const roleEl = document.getElementById(ui.roleId);
          const role = roleEl?.value?.trim() || "";
          if (!role) {
            if (msg) msg.textContent = "❌ اكتب المنصب";
            return;
          }
          payload.role = role;

          // اختياري: إذا أضفت حقول بالـ admin.html
          const descEl = document.getElementById(ui.descId);
          const instaEl = document.getElementById(ui.instaId);
          if (descEl) payload.desc = descEl.value || "";
          if (instaEl) payload.insta = instaEl.value || "";
        }

        if (sectionKey === "sponsors") {
          const descEl =
            document.getElementById(ui.descId) ||
            document.getElementById(ui.legacyDescId);
          const tierEl = document.getElementById(ui.tierId);

          const desc = descEl?.value?.trim() || "";
          const tier = String(tierEl?.value || "platinum").toLowerCase();

          // enforce max 5 per tier
          const liveData = normalizeOrdered(await fetchJson(section.getUrl));
          const members = liveData.members || {};
          const count = Object.values(members).filter(m => String(m?.tier || "platinum").toLowerCase() === tier).length;
          if (Number.isFinite(section.maxPerTier) && count >= section.maxPerTier) {
            if (msg) msg.textContent = `❌ وصلت الحد (5) لنوع ${tier}`;
            return;
          }

          payload.desc = desc;
          payload.tier = tier;
        }

        if (msg) msg.textContent = "Adding...";
        const newKey = await addMember(section, payload);
        if (!newKey) {
          if (msg) msg.textContent = "❌ Failed to add";
          return;
        }

        // upload image if provided
        const f = fileEl?.files?.[0];
        if (f && f.type?.startsWith("image/")) {
          if (msg) msg.textContent = "Uploading image...";
          await uploadImage(section, newKey, f);
        }

        // reset inputs
        if (nameEl) nameEl.value = "";
        if (posEl) posEl.value = "";
        if (fileEl) fileEl.value = "";

        if (sectionKey === "team" || sectionKey === "speakers") {
          const roleEl = document.getElementById(ui.roleId);
          if (roleEl) roleEl.value = "";
        }
        if (sectionKey === "sponsors") {
          const descEl =
            document.getElementById(ui.descId) ||
            document.getElementById(ui.legacyDescId);
          if (descEl) descEl.value = "";
        }

        if (msg) msg.textContent = "✅ Added";
        renderSection(sectionKey);
      };
    }

    // ---------- SAVE ORDER ----------
    if (saveOrderBtn) {
      saveOrderBtn.onclick = async () => {
        // Sponsors: save by tier grids if exist
        if (sectionKey === "sponsors") {
          const platId = section.gridsByTier.platinum;
          const goldId = section.gridsByTier.gold;
          const silvId = section.gridsByTier.silver;
          const bronId = section.gridsByTier.bronze;

          const platEl = document.getElementById(platId);
          const goldEl = document.getElementById(goldId);
          const silvEl = document.getElementById(silvId);
          const bronEl = document.getElementById(bronId);

          const grab = (gridId) => {
            return Array.from(document.querySelectorAll(`#${gridId} .col-12`))
              .map(card => {
                const k = card.querySelector(".person-img")?.dataset?.key;
                const v = Number(card.querySelector(".order-input")?.value);
                return { key: k, pos: Number.isFinite(v) ? v : 999999 };
              })
              .filter(x => x.key)
              .sort((a, b) => a.pos - b.pos)
              .map(x => x.key);
          };

          // إذا الثلاث grids موجودين
          if (platEl && goldEl && silvEl && bronEl) {
            const platinum = grab(platId);
            const gold = grab(goldId);
            const silver = grab(silvId);
            const bronze = grab(bronId);
            const newOrder = [...platinum, ...gold, ...silver, ...bronze];

            saveOrderBtn.disabled = true;
            const ok = await saveOrder(section, newOrder);
            saveOrderBtn.disabled = false;

            if (msg) msg.textContent = ok ? "✅ تم حفظ الترتيب" : "❌ فشل حفظ الترتيب";
            if (ok) renderSection(sectionKey);
            return;
          }

          // fallback grid واحد
          const cards = Array.from(document.querySelectorAll(`#${section.gridId} .col-12`));
          const pairs = cards
            .map((card) => {
              const k = card.querySelector(".person-img")?.dataset?.key;
              const v = Number(card.querySelector(".order-input")?.value);
              return { key: k, pos: Number.isFinite(v) ? v : 999999 };
            })
            .filter((x) => x.key)
            .sort((a, b) => a.pos - b.pos);

          const newOrder = pairs.map((x) => x.key);

          saveOrderBtn.disabled = true;
          const ok = await saveOrder(section, newOrder);
          saveOrderBtn.disabled = false;

          if (msg) msg.textContent = ok ? "✅ تم حفظ الترتيب" : "❌ فشل حفظ الترتيب";
          if (ok) renderSection(sectionKey);
          return;
        }

        // Default (team/speakers): one grid
        const cards = Array.from(document.querySelectorAll(`#${section.gridId} .col-12`));
        const pairs = cards
          .map((card) => {
            const k = card.querySelector(".person-img")?.dataset?.key;
            const v = Number(card.querySelector(".order-input")?.value);
            return { key: k, pos: Number.isFinite(v) ? v : 999999 };
          })
          .filter((x) => x.key);

        pairs.sort((a, b) => a.pos - b.pos);
        const newOrder = pairs.map((x) => x.key);

        saveOrderBtn.disabled = true;
        const ok = await saveOrder(section, newOrder);
        saveOrderBtn.disabled = false;

        if (msg) msg.textContent = ok ? "✅ تم حفظ الترتيب" : "❌ فشل حفظ الترتيب";
        if (ok) renderSection(sectionKey);
      };
    }
  }

  // =========================
  // SAVE ALL (visible section)
  // =========================
  async function saveAllCurrent() {
    const active = $$('[data-section].btn-danger')[0]?.dataset?.section || "team";
    const section = SECTIONS[active];

    // sponsors: save all three grids
    if (active === "sponsors") {
      const ids = Object.values(section.gridsByTier || {});
      const containers = ids.map(id => document.getElementById(id)).filter(Boolean);

      // fallback
      if (!containers.length) {
        containers.push(document.getElementById(section.gridId));
      }

      for (const container of containers) {
        const cards = Array.from(container.querySelectorAll(".col-12"));
        for (const card of cards) {
          const k = card.querySelector(".person-img")?.dataset?.key;
          if (!k) continue;

          const payload = {};
          card.querySelectorAll(".field-input").forEach((el) => {
            const field = el.dataset.field;
            if (!field) return;
            payload[field] = el.value;
          });
          payload.tier = String(payload.tier || "platinum").toLowerCase();

          const msg = card.querySelector(".msg");
          if (msg) msg.textContent = "Saving...";
          const ok = await saveMember(section, k, payload);
          if (msg) msg.textContent = ok ? "✅ Saved" : "❌ Failed";
        }
      }
      return;
    }

    // default
    const cards = Array.from(document.querySelectorAll(`#${section.gridId} .col-12`));
    for (const card of cards) {
      const k = card.querySelector(".person-img")?.dataset?.key;
      if (!k) continue;

      const payload = {};
      card.querySelectorAll(".field-input").forEach((el) => {
        const field = el.dataset.field;
        if (!field) return;
        payload[field] = el.value;
      });

      const msg = card.querySelector(".msg");
      if (msg) msg.textContent = "Saving...";
      const ok = await saveMember(section, k, payload);
      if (msg) msg.textContent = ok ? "✅ Saved" : "❌ Failed";
    }
  }

  // =========================
  // INIT
  // =========================
  window.addEventListener("DOMContentLoaded", () => {
    wireAddUi("team");
    wireAddUi("sponsors");
    wireAddUi("speakers");

    const saveAllBtn = document.getElementById("saveAllBtn");
    if (saveAllBtn) {
      saveAllBtn.onclick = async () => {
        saveAllBtn.disabled = true;
        await saveAllCurrent();
        saveAllBtn.disabled = false;
      };
    }

    $$("[data-section]").forEach((b) => {
      b.onclick = () => {
        const sec = b.dataset.section;
        setActive(sec);
        renderSection(sec);
      };
    });

    setActive("team");
    renderSection("team");
  });
})();
