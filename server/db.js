import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, "analytics.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tracking_key TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    path TEXT,
    title TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    ip TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    ll_lat REAL,
    ll_lon REAL,
    user_agent TEXT,
    browser TEXT,
    os TEXT,
    device_type TEXT,
    screen_w INTEGER,
    screen_h INTEGER,
    lang TEXT,
    FOREIGN KEY (site_id) REFERENCES sites(id)
  );

  CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events(site_id, ts DESC);
`);

export function createSite(name) {
  const id = crypto.randomUUID();
  const tracking_key = crypto.randomUUID().replace(/-/g, "");
  const created_at = Date.now();
  db.prepare(
    "INSERT INTO sites (id, name, tracking_key, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, name, tracking_key, created_at);
  return { id, name, tracking_key, created_at };
}

export function getSiteByTrackingKey(tracking_key) {
  return db
    .prepare("SELECT * FROM sites WHERE tracking_key = ?")
    .get(tracking_key);
}

export function insertEvent(row) {
  db.prepare(
    `INSERT INTO events (
      id, site_id, ts, path, title, referrer,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      ip, country, region, city, ll_lat, ll_lon,
      user_agent, browser, os, device_type,
      screen_w, screen_h, lang
    ) VALUES (
      @id, @site_id, @ts, @path, @title, @referrer,
      @utm_source, @utm_medium, @utm_campaign, @utm_term, @utm_content,
      @ip, @country, @region, @city, @ll_lat, @ll_lon,
      @user_agent, @browser, @os, @device_type,
      @screen_w, @screen_h, @lang
    )`
  ).run(row);
}

export function listSites() {
  return db
    .prepare(
      "SELECT id, name, tracking_key, created_at FROM sites ORDER BY created_at DESC"
    )
    .all();
}

export function statsSummary(siteId, fromTs, toTs) {
  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM events WHERE site_id = ? AND ts >= ? AND ts <= ?`
    )
    .get(siteId, fromTs, toTs).c;
  const uniqueIp = db
    .prepare(
      `SELECT COUNT(DISTINCT ip) AS c FROM events WHERE site_id = ? AND ts >= ? AND ts <= ? AND ip IS NOT NULL AND ip != ''`
    )
    .get(siteId, fromTs, toTs).c;
  return { total, uniqueIp };
}

export function topReferrers(siteId, fromTs, toTs, limit = 10) {
  return db
    .prepare(
      `SELECT COALESCE(NULLIF(referrer, ''), '(прямой заход)') AS ref, COUNT(*) AS c
       FROM events WHERE site_id = ? AND ts >= ? AND ts <= ?
       GROUP BY ref ORDER BY c DESC LIMIT ?`
    )
    .all(siteId, fromTs, toTs, limit);
}

export function topCities(siteId, fromTs, toTs, limit = 10) {
  return db
    .prepare(
      `SELECT COALESCE(NULLIF(city, ''), '—') AS city, country, COUNT(*) AS c
       FROM events WHERE site_id = ? AND ts >= ? AND ts <= ?
       GROUP BY city, country ORDER BY c DESC LIMIT ?`
    )
    .all(siteId, fromTs, toTs, limit);
}

export function recentEvents(siteId, fromTs, toTs, limit = 200) {
  return db
    .prepare(
      `SELECT * FROM events WHERE site_id = ? AND ts >= ? AND ts <= ?
       ORDER BY ts DESC LIMIT ?`
    )
    .all(siteId, fromTs, toTs, limit);
}

export { db };
