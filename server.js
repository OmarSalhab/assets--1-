const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

const ASSETS_DIR = path.join(__dirname, "assets");
const DATA_DIR = path.join(__dirname, "data");

// Ensure folders exist
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Initialize SQLite DB
const db = new Database(path.join(DATA_DIR, "database.sqlite"));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS entities (
    entity_key TEXT PRIMARY KEY,
    data TEXT
  )
`);

function initEntity(key) {
  const row = db.prepare('SELECT data FROM entities WHERE entity_key = ?').get(key);
  if (!row) {
    let initialData = {};
    try {
      const jsonPath = path.join(DATA_DIR, `${key}.json`);
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        if (raw) initialData = JSON.parse(raw);
      }
    } catch (e) {
      console.error(`Error migrating ${key}.json:`, e);
    }
    db.prepare('INSERT INTO entities (entity_key, data) VALUES (?, ?)').run(key, JSON.stringify(initialData));
  }
}

initEntity('team');
initEntity('sponsors');
initEntity('speakers');

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
function readEntityRaw(entityKey) {
  try {
    const row = db.prepare('SELECT data FROM entities WHERE entity_key = ?').get(entityKey);
    return row && row.data ? JSON.parse(row.data) : {};
  } catch {
    return {};
  }
}

function writeEntityRaw(entityKey, obj) {
  db.prepare('UPDATE entities SET data = ? WHERE entity_key = ?').run(JSON.stringify(obj), entityKey);
}

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

function readEntity(entityKey) {
  const raw = readEntityRaw(entityKey);
  const ent = normalizeOrderedShape(raw);

  const keys = new Set(Object.keys(ent.members));
  ent.order = ent.order.filter(k => keys.has(k));
  for (const k of Object.keys(ent.members)) {
    if (!ent.order.includes(k)) ent.order.push(k);
  }
  return ent;
}

function writeEntity(entityKey, ent) {
  writeEntityRaw(entityKey, {
    order: Array.isArray(ent.order) ? ent.order : [],
    members: ent.members || {},
  });
}

function makeKey(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- Build ordered routes (team/sponsors/speakers) ----------
function bindOrderedRoutes(basePath, entityKey, prefix) {
  const requireRole = prefix !== "sponsor"; // sponsors don't require "role"

  app.get(basePath, (req, res) => {
    res.json(readEntity(entityKey));
  });

  app.post(basePath, (req, res) => {
    const body = req.body || {};
    const action = String(body.action || "update").toLowerCase();

    const ent = readEntity(entityKey);

    if (action === "reorder") {
      if (!Array.isArray(body.order)) return res.status(400).json({ error: "Missing order" });
      const incoming = body.order.map(String);
      const keys = new Set(Object.keys(ent.members));
      ent.order = incoming.filter(k => keys.has(k));
      for (const k of Object.keys(ent.members)) if (!ent.order.includes(k)) ent.order.push(k);
      writeEntity(entityKey, ent);
      return res.json({ ok: true });
    }

    if (action === "delete") {
      const key = String(body.key || "").trim();
      if (!key) return res.status(400).json({ error: "Missing key" });

      delete ent.members[key];
      ent.order = ent.order.filter(k => k !== key);
      writeEntity(entityKey, ent);
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

      writeEntity(entityKey, ent);
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

    writeEntity(entityKey, ent);
    return res.json({ ok: true });
  });
}

// TEAM / SPONSORS / SPEAKERS
bindOrderedRoutes("/api/team", "team", "member");
bindOrderedRoutes("/api/sponsors", "sponsors", "sponsor");
bindOrderedRoutes("/api/speakers", "speakers", "speaker");

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

  let entityKey = "team";
  if (type === "sponsor" || type === "sponsors") entityKey = "sponsors";
  if (type === "speaker" || type === "speakers") entityKey = "speakers";

  const ent = readEntity(entityKey);
  const cur = ent.members[key] || {};
  ent.members[key] = { ...cur, img: relPath };
  if (!ent.order.includes(key)) ent.order.push(key);
  writeEntity(entityKey, ent);

  res.json({ ok: true, path: relPath });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
