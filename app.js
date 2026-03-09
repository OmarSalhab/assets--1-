(() => {
  // =========================
  // Helpers
  // =========================
  const $ = (s, r = document) => r.querySelector(s);

  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // =========================
  // Countdown (لازم يشتغل دايمًا)
  // =========================
  function initCountdown() {
    // 1 April 2026 الساعة 00:00 (منتصف الليل)
    const target = new Date("2026-04-01T00:00:00").getTime();

    const dEl = $("#d");
    const hEl = $("#h");
    const mEl = $("#m");
    const sEl = $("#s");

    if (!dEl || !hEl || !mEl || !sEl) return;

    function tick() {
      const now = Date.now();
      let diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      diff -= days * (1000 * 60 * 60 * 24);
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      diff -= hrs * (1000 * 60 * 60);
      const mins = Math.floor(diff / (1000 * 60));
      diff -= mins * (1000 * 60);
      const secs = Math.floor(diff / 1000);

      dEl.textContent = String(days).padStart(2, "0");
      hEl.textContent = String(hrs).padStart(2, "0");
      mEl.textContent = String(mins).padStart(2, "0");
      sEl.textContent = String(secs).padStart(2, "0");
    }

    tick();
    setInterval(tick, 1000);
  }

  // =========================
  // Speakers (Dynamic)
  // =========================
  function speakerCard(sp) {
    const name = esc(sp.name || "");
    const role = esc(sp.role || "");
    const desc = esc(sp.desc || "");
    const insta = sp.insta ? String(sp.insta) : "#";
    const img = sp.img ? String(sp.img) : "";

    return `
      <div class="col-12 col-lg-6">
        <article class="speaker-card">
          <div class="speaker-left">
            <div class="speaker-avatar" style="${img ? `background-image:url('${esc(img)}'); background-size:cover; background-position:center;` : ""}">
              <div class="speaker-mic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M12 18v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M8 21h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
          </div>

          <div class="speaker-body">
            <h3 class="speaker-name">${name}</h3>
            <div class="speaker-role">${role}</div>

            <p class="speaker-desc">${desc}</p>

            <a class="speaker-link" href="${esc(insta)}" target="_blank" rel="noopener">
              Follow on instagram <span class="arrow">→</span>
            </a>
          </div>
        </article>
      </div>
    `;
  }

  async function renderSpeakers() {
    const row = $("#speakersRow");
    if (!row) return;

    const data = await fetchJson("/api/speakers");
    const ent = data && data.order && data.members ? data : { order: [], members: {} };

    const order = Array.isArray(ent.order) ? ent.order : [];
    const members = ent.members && typeof ent.members === "object" ? ent.members : {};

    row.innerHTML = order
      .filter((k) => members[k])
      .map((k) => speakerCard(members[k]))
      .join("");
  }

  // =========================
  // Sponsors (Dynamic by tier)
  // =========================
  function sponsorCard(sp) {
    const name = esc(sp.name || "");
    const desc = esc(sp.desc || sp.role || "");
    const img = sp.img ? String(sp.img) : "";

    return `
      <article class="sponsor-card" style="${img ? `background-image:url('${esc(img)}'); background-size:cover; background-position:center;` : ""}">
        <div class="sponsor-card-overlay">
          <h3 class="sponsor-card-title">${name}</h3>
          <p class="sponsor-card-desc">${desc}</p>
        </div>
      </article>
    `;
  }

  async function renderSponsors() {
    const platinumTrack = $("#sponsorTrackPlatinum");
    const goldTrack = $("#sponsorTrackGold");
    const silverTrack = $("#sponsorTrackSilver");
    const bronzeTrack = $("#sponsorTrackBronze");
    if (!platinumTrack || !goldTrack || !silverTrack || !bronzeTrack) return;

    const data = await fetchJson("/api/sponsors");
    const ent = data && data.order && data.members ? data : { order: [], members: {} };

    const order = Array.isArray(ent.order) ? ent.order : [];
    const members = ent.members && typeof ent.members === "object" ? ent.members : {};

    const platinum = [];
    const gold = [];
    const silver = [];
    const bronze = [];

    for (const k of order) {
      const s = members[k];
      if (!s) continue;
      const tier = String(s.tier || "platinum").toLowerCase();

      if (tier === "gold") gold.push(s);
      else if (tier === "silver") silver.push(s);
      else if (tier === "bronze") bronze.push(s);
      else platinum.push(s);
    }

    platinumTrack.innerHTML = platinum.map(sponsorCard).join("");
    goldTrack.innerHTML = gold.map(sponsorCard).join("");
    silverTrack.innerHTML = silver.map(sponsorCard).join("");
    bronzeTrack.innerHTML = bronze.map(sponsorCard).join("");
  }

  // =========================
  // Team (Dynamic مثل Sponsors/Speakers)
  // =========================
  function teamCard(m) {
    const name = esc(m.name || "");
    const role = esc(m.role || "");
    const img = m.img ? String(m.img) : "";

    return `
      <article class="team-card" style="${img ? `background-image:url('${esc(img)}');` : ""}">
        <div class="team-card-overlay">
          <h3 class="team-card-title">${name}</h3>
          <p class="team-card-role">${role}</p>
        </div>
      </article>
    `;
  }

  async function renderTeam() {
    const rowsWrap = $("#teamRows");
    if (!rowsWrap) return;

    const data = await fetchJson("/api/team");
    const ent = data && data.order && data.members ? data : { order: [], members: {} };

    const order = Array.isArray(ent.order) ? ent.order : [];
    const members = ent.members && typeof ent.members === "object" ? ent.members : {};

    const keys = order.filter((k) => members[k]);

    const mid = Math.ceil(keys.length / 2);
    const row1 = keys.slice(0, mid);
    const row2 = keys.slice(mid);

    rowsWrap.innerHTML = `
      <div class="team-row">
        ${row1.map((k) => teamCard(members[k])).join("")}
      </div>
      <div class="team-row">
        ${row2.map((k) => teamCard(members[k])).join("")}
      </div>
    `;
  }

  // =========================
  // Init (مهم: ما نخلي خطأ يوقف كلشي)
  // =========================
  window.addEventListener("DOMContentLoaded", () => {
    // خلي الصفحة تظهر لو عندك page-hidden
    try {
      $("#pageContent")?.classList?.remove("page-hidden");
    } catch {}

    // 1) Countdown لازم دايمًا يشتغل
    try {
      initCountdown();
    } catch (e) {
      console.error("Countdown error:", e);
    }

    // 2) Speakers
    try {
      renderSpeakers();
    } catch (e) {
      console.error("Speakers error:", e);
    }

    // 3) Sponsors
    try {
      renderSponsors();
    } catch (e) {
      console.error("Sponsors error:", e);
    }

    // 4) Team ✅
    try {
      renderTeam();
    } catch (e) {
      console.error("Team error:", e);
    }
  });
})();
