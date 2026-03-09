const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const ASSETS_DIR = path.join(__dirname, "assets");
const DATA_DIR = path.join(__dirname, "data");

const TEAM_JSON = path.join(DATA_DIR, "team.json");
const SPONSORS_JSON = path.join(DATA_DIR, "sponsors.json");
const SPEAKERS_JSON = path.join(DATA_DIR, "speakers.json");

// Ensure folders exist
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Disable caching
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/assets") || req.path.endsWith(".json")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
  next();
});

// Serve static
app.use(express.static(__dirname));

// ---------- Helpers ----------
function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf-8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

// init missing
if (!fs.existsSync(TEAM_JSON)) writeJson(TEAM_JSON, {});
if (!fs.existsSync(SPONSORS_JSON)) writeJson(SPONSORS_JSON, {});
if (!fs.existsSync(SPEAKERS_JSON)) writeJson(SPEAKERS_JSON, {});

// ---------- Generic normalize {order,members} ----------
function normalizeOrderedShape(raw) {
  if (!raw || typeof raw !== "object") return { order: [], members: {} };

  if (Array.isArray(raw.order) && raw.members && typeof raw.members === "object") {
    return { order: raw.order.map(String), members: raw.members };
  }

  // Flat -> convert
  const members = {};
  const order = [];
  for (const [k, v] of Object.entries(raw)) {
    if (k === "order" || k === "members") continue;
    if (v && typeof v === "object") {
      members[k] = v;
      order.push(k);
    }
  }
  return { order, members };
}

function readEntity(filePath) {
  const raw = readJson(filePath);
  const ent = normalizeOrderedShape(raw);

  const keys = new Set(Object.keys(ent.members));
  ent.order = ent.order.filter(k => keys.has(k));
  for (const k of Object.keys(ent.members)) {
    if (!ent.order.includes(k)) ent.order.push(k);
  }
  return ent;
}

function writeEntity(filePath, ent) {
  writeJson(filePath, {
    order: Array.isArray(ent.order) ? ent.order : [],
    members: ent.members || {},
  });
}

function makeKey(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- Build ordered routes (team/sponsors/speakers) ----------
function bindOrderedRoutes(basePath, filePath, prefix) {
  const requireRole = prefix !== "sponsor"; // sponsors don't require "role"

  app.get(basePath, (req, res) => {
    res.json(readEntity(filePath));
  });

  app.post(basePath, (req, res) => {
    const body = req.body || {};
    const action = String(body.action || "update").toLowerCase();

    const ent = readEntity(filePath);

    if (action === "reorder") {
      if (!Array.isArray(body.order)) return res.status(400).json({ error: "Missing order" });
      const incoming = body.order.map(String);
      const keys = new Set(Object.keys(ent.members));
      ent.order = incoming.filter(k => keys.has(k));
      for (const k of Object.keys(ent.members)) if (!ent.order.includes(k)) ent.order.push(k);
      writeEntity(filePath, ent);
      return res.json({ ok: true });
    }

    if (action === "delete") {
      const key = String(body.key || "").trim();
      if (!key) return res.status(400).json({ error: "Missing key" });

      delete ent.members[key];
      ent.order = ent.order.filter(k => k !== key);
      writeEntity(filePath, ent);
      return res.json({ ok: true });
    }

    if (action === "add") {
      const name = String(body.name || "").trim();
      const role = String(body.role || "").trim();
      const position = Number(body.position);

      if (!name) return res.status(400).json({ error: "Missing name" });
      if (requireRole && !role) return res.status(400).json({ error: "Missing role" });

      let key = String(body.key || "").trim();
      if (!key) key = makeKey(prefix);

      // keep/merge any extra fields (desc, insta, tier, etc.)
      const extra = { ...body };
      delete extra.action;
      delete extra.key;
      delete extra.position;

      ent.members[key] = {
        ...(ent.members[key] || {}),
        ...extra,
        name,
        ...(requireRole ? { role } : {}),
      };

      ent.order = ent.order.filter(k => k !== key);
      if (Number.isFinite(position) && position >= 1) {
        const idx = Math.min(Math.max(Math.floor(position) - 1, 0), ent.order.length);
        ent.order.splice(idx, 0, key);
      } else {
        ent.order.push(key);
      }

      writeEntity(filePath, ent);
      return res.json({ ok: true, key });
    }

    // update (default): accept extra fields (desc, insta, tier, etc.)
    const key = String(body.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing key" });

    const cur = ent.members[key] || {};
    const payload = { ...body };
    delete payload.action;
    delete payload.key;

    ent.members[key] = { ...cur, ...payload };
    if (!ent.order.includes(key)) ent.order.push(key);

    writeEntity(filePath, ent);
    return res.json({ ok: true });
  });
}

// TEAM / SPONSORS / SPEAKERS
bindOrderedRoutes("/api/team", TEAM_JSON, "member");
bindOrderedRoutes("/api/sponsors", SPONSORS_JSON, "sponsor");
bindOrderedRoutes("/api/speakers", SPEAKERS_JSON, "speaker");

// ---- Upload handler (team/sponsor/speaker) ----
// ✅ FIX: make filename unique per "key" so changing one person doesn't affect others
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ASSETS_DIR),
  filename: (req, file, cb) => {
    const type = (req.query.type || "team").toLowerCase();
const key =
  (req.body && req.body.key ? String(req.body.key).trim() : "") ||
  (req.query && req.query.key ? String(req.query.key).trim() : "");
    const ext = (path.extname(file.originalname || "").toLowerCase() || ".png");

    // IMPORTANT: key must exist
    const safeKey = key ? key.replace(/[^\w.\-]+/g, "_") : "upload";
    const safeType = String(type).replace(/[^\w.\-]+/g, "_");

    // We'll always save as: team_<key>.ext  / sponsor_<key>.ext / speaker_<key>.ext
    const prefix = `${safeType}_${safeKey}`;

    // حذف أي ملف قديم لنفس العضو (حتى لو كان امتداد مختلف)
    try {
      const files = fs.readdirSync(ASSETS_DIR);
      for (const f of files) {
        if (f.toLowerCase().startsWith(prefix.toLowerCase() + ".")) {
          try { fs.unlinkSync(path.join(ASSETS_DIR, f)); } catch {}
        }
      }
    } catch {}

    const targetName = `${prefix}${ext}`;
    cb(null, targetName);
  }
});

const upload = multer({ storage });

app.post("/api/upload", upload.single("file"), (req, res) => {
  const type = (req.query.type || "team").toLowerCase();
const key = String(req.body?.key || req.query?.key || "").trim();
  if (!key) return res.status(400).json({ error: "Missing key" });
  if (!req.file) return res.status(400).json({ error: "Missing file" });

  const relPath = "assets/" + req.file.filename;

  let filePath = TEAM_JSON;
  if (type === "sponsor" || type === "sponsors") filePath = SPONSORS_JSON;
  if (type === "speaker" || type === "speakers") filePath = SPEAKERS_JSON;

  const ent = readEntity(filePath);
  const cur = ent.members[key] || {};
  ent.members[key] = { ...cur, img: relPath };
  if (!ent.order.includes(key)) ent.order.push(key);
  writeEntity(filePath, ent);

  res.json({ ok: true, path: relPath });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
