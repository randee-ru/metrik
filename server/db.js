/**
 * SQLite: сайты, визиты, цели, конверсии, сквозная аналитика
 * (первое касание, сделки/выручка, расходы на рекламу).
 * Файл базы: analytics.db в каталоге данных (по умолчанию ../data).
 * Переменная METRIK_DATA_DIR — абсолютный путь к каталогу для второго экземпляра на сервере.
 */
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.METRIK_DATA_DIR
  ? process.env.METRIK_DATA_DIR.replace(/\/+$/, "")
  : join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, "analytics.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    site_url TEXT,
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
    visitor_id TEXT,
    session_id TEXT,
    FOREIGN KEY (site_id) REFERENCES sites(id)
  );

  CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events(site_id, ts DESC);

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    name TEXT NOT NULL,
    match_type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id)
  );

  CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    visitor_id TEXT,
    session_id TEXT,
    ts INTEGER NOT NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id),
    FOREIGN KEY (goal_id) REFERENCES goals(id)
  );

  CREATE INDEX IF NOT EXISTS idx_conv_site_ts ON conversions(site_id, ts DESC);

  CREATE TABLE IF NOT EXISTS visitor_first_touch (
    visitor_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    path TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    PRIMARY KEY (visitor_id, site_id)
  );

  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RUB',
    title TEXT,
    visitor_id TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    referrer TEXT,
    source TEXT,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_deals_site_ts ON deals(site_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS ad_spend (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    from_ts INTEGER NOT NULL,
    to_ts INTEGER NOT NULL,
    utm_campaign TEXT,
    utm_source TEXT,
    amount REAL NOT NULL,
    name TEXT NOT NULL,
    comment TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_spend_site ON ad_spend(site_id);
`);

function migrateEventsColumns() {
  const cols = db.prepare("PRAGMA table_info(events)").all();
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("visitor_id")) {
    db.exec("ALTER TABLE events ADD COLUMN visitor_id TEXT");
  }
  if (!names.has("session_id")) {
    db.exec("ALTER TABLE events ADD COLUMN session_id TEXT");
  }
}

migrateEventsColumns();

function migrateSitesSiteUrl() {
  const cols = db.prepare("PRAGMA table_info(sites)").all();
  const names = new Set(cols.map((c) => c.name));
  if (names.size > 0 && !names.has("site_url")) {
    db.exec("ALTER TABLE sites ADD COLUMN site_url TEXT");
  }
}

migrateSitesSiteUrl();

function migrateAdSpendCreatedAt() {
  const cols = db.prepare("PRAGMA table_info(ad_spend)").all();
  const names = new Set(cols.map((c) => c.name));
  if (names.size && !names.has("created_at")) {
    db.exec("ALTER TABLE ad_spend ADD COLUMN created_at INTEGER");
    db.exec("UPDATE ad_spend SET created_at = from_ts WHERE created_at IS NULL");
  }
}

migrateAdSpendCreatedAt();

db.exec(`CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(site_id, visitor_id);`);

export function createSite(name, siteUrl = null) {
  const id = crypto.randomUUID();
  const tracking_key = crypto.randomUUID().replace(/-/g, "");
  const created_at = Date.now();
  const url =
    siteUrl != null && String(siteUrl).trim() !== "" ? String(siteUrl).trim().slice(0, 2000) : null;
  db.prepare(
    "INSERT INTO sites (id, name, site_url, tracking_key, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, url, tracking_key, created_at);
  return { id, name, site_url: url, tracking_key, created_at };
}

export function getSiteById(siteId) {
  return db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId);
}

export function updateSite(siteId, fields) {
  const existing = getSiteById(siteId);
  if (!existing) return null;
  if (fields.name !== undefined) {
    db.prepare("UPDATE sites SET name = ? WHERE id = ?").run(
      String(fields.name || "").trim().slice(0, 200) || "Проект",
      siteId
    );
  }
  if (fields.site_url !== undefined) {
    const v = fields.site_url;
    const url =
      v === null || v === ""
        ? null
        : String(v).trim().slice(0, 2000);
    db.prepare("UPDATE sites SET site_url = ? WHERE id = ?").run(url, siteId);
  }
  return getSiteById(siteId);
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
      screen_w, screen_h, lang, visitor_id, session_id
    ) VALUES (
      @id, @site_id, @ts, @path, @title, @referrer,
      @utm_source, @utm_medium, @utm_campaign, @utm_term, @utm_content,
      @ip, @country, @region, @city, @ll_lat, @ll_lon,
      @user_agent, @browser, @os, @device_type,
      @screen_w, @screen_h, @lang, @visitor_id, @session_id
    )`
  ).run(row);
}

export function listSites() {
  return db
    .prepare(
      "SELECT id, name, site_url, tracking_key, created_at FROM sites ORDER BY created_at DESC"
    )
    .all();
}

/** Уникальный «посетитель»: visitor_id со скрипта или запасной ключ по IP. */
function visitorKeyExpr() {
  return `COALESCE(NULLIF(TRIM(visitor_id), ''), 'ip:' || IFNULL(ip, ''))`;
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
  const uniqueVisitors = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT DISTINCT ${visitorKeyExpr()} AS vk
         FROM events WHERE site_id = ? AND ts >= ? AND ts <= ?
       )`
    )
    .get(siteId, fromTs, toTs).c;
  const uniqueSessions = db
    .prepare(
      `SELECT COUNT(DISTINCT session_id) AS c FROM events
       WHERE site_id = ? AND ts >= ? AND ts <= ?
       AND session_id IS NOT NULL AND TRIM(session_id) != ''`
    )
    .get(siteId, fromTs, toTs).c;
  const conversionHits = db
    .prepare(
      `SELECT COUNT(*) AS c FROM conversions WHERE site_id = ? AND ts >= ? AND ts <= ?`
    )
    .get(siteId, fromTs, toTs).c;
  const conversionVisitors = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT DISTINCT COALESCE(NULLIF(TRIM(c.visitor_id), ''), 'ip:' || IFNULL(e.ip, '')) AS vk
         FROM conversions c
         JOIN events e ON e.id = c.event_id
         WHERE c.site_id = ? AND c.ts >= ? AND c.ts <= ?
       )`
    )
    .get(siteId, fromTs, toTs).c;
  const crPercent =
    uniqueVisitors > 0
      ? Math.round((10000 * conversionVisitors) / uniqueVisitors) / 100
      : 0;

  return {
    total,
    uniqueIp,
    uniqueVisitors,
    uniqueSessions,
    conversionHits,
    conversionVisitors,
    crPercent,
  };
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

export function listGoals(siteId) {
  return db
    .prepare(
      `SELECT id, site_id, name, match_type, pattern, created_at FROM goals
       WHERE site_id = ? ORDER BY created_at DESC`
    )
    .all(siteId);
}

export function createGoal(siteId, name, match_type, pattern) {
  const id = crypto.randomUUID();
  const created_at = Date.now();
  db.prepare(
    `INSERT INTO goals (id, site_id, name, match_type, pattern, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, siteId, name, match_type, pattern, created_at);
  return { id, site_id: siteId, name, match_type, pattern, created_at };
}

export function deleteGoal(siteId, goalId) {
  db.prepare("DELETE FROM conversions WHERE goal_id = ? AND site_id = ?").run(goalId, siteId);
  const r = db
    .prepare("DELETE FROM goals WHERE id = ? AND site_id = ?")
    .run(goalId, siteId);
  return r.changes;
}

export function insertConversion(row) {
  db.prepare(
    `INSERT INTO conversions (id, site_id, goal_id, event_id, visitor_id, session_id, ts)
     VALUES (@id, @site_id, @goal_id, @event_id, @visitor_id, @session_id, @ts)`
  ).run(row);
}

export function goalStats(siteId, fromTs, toTs) {
  return db
    .prepare(
      `SELECT g.id, g.name, g.match_type, g.pattern,
        COUNT(c.id) AS hits,
        COUNT(DISTINCT COALESCE(NULLIF(TRIM(c.visitor_id), ''), 'ip:' || IFNULL(e.ip, ''))) AS reached_visitors
       FROM goals g
       LEFT JOIN conversions c ON c.goal_id = g.id AND c.ts >= ? AND c.ts <= ?
       LEFT JOIN events e ON e.id = c.event_id
       WHERE g.site_id = ?
       GROUP BY g.id
       ORDER BY hits DESC, g.name`
    )
    .all(fromTs, toTs, siteId);
}

export function overviewAllSites(fromTs, toTs) {
  const sites = listSites();
  return sites.map((s) => ({
    site: s,
    summary: statsSummary(s.id, fromTs, toTs),
  }));
}

/** Ключ группировки по utm_campaign (как в отчётах Roistat). */
export function sqlCampaignKey(column) {
  return `COALESCE(NULLIF(TRIM(${column}), ''), '(не указана)')`;
}

export function tryRecordFirstTouch(siteId, visitorId, row) {
  if (!visitorId || !String(visitorId).trim()) return;
  db.prepare(
    `INSERT OR IGNORE INTO visitor_first_touch (
      visitor_id, site_id, ts, path, referrer, utm_source, utm_medium, utm_campaign
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    visitorId.trim().slice(0, 80),
    siteId,
    row.ts,
    row.path ?? null,
    row.referrer ?? null,
    row.utm_source ?? null,
    row.utm_medium ?? null,
    row.utm_campaign ?? null
  );
}

export function insertDeal(row) {
  db.prepare(
    `INSERT INTO deals (
      id, site_id, created_at, amount, currency, title, visitor_id,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, source, notes
    ) VALUES (
      @id, @site_id, @created_at, @amount, @currency, @title, @visitor_id,
      @utm_source, @utm_medium, @utm_campaign, @utm_term, @utm_content, @referrer, @source, @notes
    )`
  ).run(row);
}

export function listDeals(siteId, fromTs, toTs, limit = 200) {
  return db
    .prepare(
      `SELECT * FROM deals WHERE site_id = ? AND created_at >= ? AND created_at <= ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(siteId, fromTs, toTs, limit);
}

export function deleteDeal(siteId, dealId) {
  return db.prepare("DELETE FROM deals WHERE id = ? AND site_id = ?").run(dealId, siteId).changes;
}

export function insertAdSpend(row) {
  db.prepare(
    `INSERT INTO ad_spend (id, site_id, from_ts, to_ts, utm_campaign, utm_source, amount, name, comment, created_at)
     VALUES (@id, @site_id, @from_ts, @to_ts, @utm_campaign, @utm_source, @amount, @name, @comment, @created_at)`
  ).run(row);
}

export function listAdSpend(siteId, limit = 100) {
  return db
    .prepare(
      `SELECT * FROM ad_spend WHERE site_id = ?
       ORDER BY COALESCE(created_at, from_ts) DESC LIMIT ?`
    )
    .all(siteId, limit);
}

export function deleteAdSpend(siteId, spendId) {
  return db.prepare("DELETE FROM ad_spend WHERE id = ? AND site_id = ?").run(spendId, siteId).changes;
}

export function dealTotals(siteId, fromTs, toTs) {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS revenue
       FROM deals WHERE site_id = ? AND created_at >= ? AND created_at <= ?`
    )
    .get(siteId, fromTs, toTs);
  return { count: r.cnt, revenue: r.revenue };
}

export function spendTotalsOverlapping(siteId, fromTs, toTs) {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS spend FROM ad_spend
       WHERE site_id = ? AND NOT (to_ts < ? OR from_ts > ?)`
    )
    .get(siteId, fromTs, toTs);
  return r.spend;
}

export function listFirstTouches(siteId, limit = 60) {
  return db
    .prepare(
      `SELECT * FROM visitor_first_touch WHERE site_id = ?
       ORDER BY ts DESC LIMIT ?`
    )
    .all(siteId, limit);
}

const CH_SQL = `CASE
  WHEN LOWER(COALESCE(NULLIF(TRIM(utm_medium), ''), '')) IN ('cpc','cpm','ppc','paid','cpa','cpv','cpc_cpm') THEN 'Платный трафик (utm_medium)'
  WHEN COALESCE(NULLIF(TRIM(utm_source), ''), '') != '' OR COALESCE(NULLIF(TRIM(utm_medium), ''), '') != '' THEN 'Размеченный UTM'
  WHEN COALESCE(NULLIF(TRIM(referrer), ''), '') = '' THEN 'Прямой заход'
  ELSE 'Рефералы и органика'
END`;

const CH_SQL_E = `CASE
  WHEN LOWER(COALESCE(NULLIF(TRIM(e.utm_medium), ''), '')) IN ('cpc','cpm','ppc','paid','cpa','cpv','cpc_cpm') THEN 'Платный трафик (utm_medium)'
  WHEN COALESCE(NULLIF(TRIM(e.utm_source), ''), '') != '' OR COALESCE(NULLIF(TRIM(e.utm_medium), ''), '') != '' THEN 'Размеченный UTM'
  WHEN COALESCE(NULLIF(TRIM(e.referrer), ''), '') = '' THEN 'Прямой заход'
  ELSE 'Рефералы и органика'
END`;

export function channelBreakdown(siteId, fromTs, toTs) {
  const visits = db
    .prepare(
      `SELECT ch AS channel, COUNT(*) AS visits FROM (
         SELECT ${CH_SQL} AS ch FROM events
         WHERE site_id = ? AND ts >= ? AND ts <= ?
       ) GROUP BY ch ORDER BY visits DESC`
    )
    .all(siteId, fromTs, toTs);
  const conv = db
    .prepare(
      `SELECT ch AS channel, COUNT(*) AS conversion_hits FROM (
         SELECT ${CH_SQL_E} AS ch
         FROM conversions c
         JOIN events e ON e.id = c.event_id
         WHERE c.site_id = ? AND c.ts >= ? AND c.ts <= ?
       ) GROUP BY ch`
    )
    .all(siteId, fromTs, toTs);
  const cmap = Object.fromEntries(conv.map((x) => [x.channel, x.conversion_hits]));
  return visits.map((v) => ({
    channel: v.channel,
    visits: v.visits,
    conversion_hits: cmap[v.channel] || 0,
  }));
}

export function crossAnalyticsByCampaign(siteId, fromTs, toTs) {
  const ck = sqlCampaignKey("utm_campaign");
  const keys = db
    .prepare(
      `SELECT DISTINCT k FROM (
         SELECT ${ck} AS k FROM events WHERE site_id = ? AND ts >= ? AND ts <= ?
         UNION
         SELECT ${ck} FROM deals WHERE site_id = ? AND created_at >= ? AND created_at <= ?
         UNION
         SELECT ${ck} FROM ad_spend WHERE site_id = ? AND NOT (to_ts < ? OR from_ts > ?)
       ) ORDER BY k`
    )
    .all(siteId, fromTs, toTs, siteId, fromTs, toTs, siteId, fromTs, toTs)
    .map((r) => r.k);

  const qVisits = db.prepare(
    `SELECT COUNT(*) AS c FROM events WHERE site_id = ? AND ts >= ? AND ts <= ? AND ${ck} = ?`
  );
  const qVisitors = db.prepare(
    `SELECT COUNT(*) AS c FROM (
       SELECT DISTINCT ${visitorKeyExpr()} AS vk FROM events
       WHERE site_id = ? AND ts >= ? AND ts <= ? AND ${ck} = ?
     )`
  );
  const qConvHits = db.prepare(
    `SELECT COUNT(*) AS c FROM conversions c
     JOIN events e ON e.id = c.event_id
     WHERE c.site_id = ? AND c.ts >= ? AND c.ts <= ? AND ${sqlCampaignKey("e.utm_campaign")} = ?`
  );
  const qConvVisitors = db.prepare(
    `SELECT COUNT(*) AS c FROM (
       SELECT DISTINCT COALESCE(NULLIF(TRIM(c.visitor_id), ''), 'ip:' || IFNULL(e.ip, '')) AS vk
       FROM conversions c
       JOIN events e ON e.id = c.event_id
       WHERE c.site_id = ? AND c.ts >= ? AND c.ts <= ? AND ${sqlCampaignKey("e.utm_campaign")} = ?
     )`
  );
  const qDeals = db.prepare(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS revenue FROM deals
     WHERE site_id = ? AND created_at >= ? AND created_at <= ? AND ${ck} = ?`
  );
  const qSpend = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS s FROM ad_spend
     WHERE site_id = ? AND NOT (to_ts < ? OR from_ts > ?) AND ${ck} = ?`
  );

  const rows = [];
  for (const k of keys) {
    const visits = qVisits.get(siteId, fromTs, toTs, k).c;
    const visitors = qVisitors.get(siteId, fromTs, toTs, k).c;
    const conversionHits = qConvHits.get(siteId, fromTs, toTs, k).c;
    const conversionVisitors = qConvVisitors.get(siteId, fromTs, toTs, k).c;
    const d = qDeals.get(siteId, fromTs, toTs, k);
    const spend = qSpend.get(siteId, fromTs, toTs, k).s;
    const revenue = d.revenue;
    const dealsCount = d.cnt;
    const profit = revenue - spend;
    const roas = spend > 0 ? Math.round((100 * revenue) / spend) / 100 : null;
    const roiPercent = spend > 0 ? Math.round((10000 * profit) / spend) / 100 : null;
    const cpa = dealsCount > 0 && spend > 0 ? Math.round((100 * spend) / dealsCount) / 100 : null;
    rows.push({
      campaign: k,
      visits,
      visitors,
      conversionHits,
      conversionVisitors,
      dealsCount,
      revenue,
      spend,
      profit,
      roas,
      roiPercent,
      cpa,
    });
  }
  rows.sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);
  return rows;
}

export function crossAnalyticsBundle(siteId, fromTs, toTs) {
  const byCampaign = crossAnalyticsByCampaign(siteId, fromTs, toTs);
  const byChannel = channelBreakdown(siteId, fromTs, toTs);
  const deals = dealTotals(siteId, fromTs, toTs);
  const spend = spendTotalsOverlapping(siteId, fromTs, toTs);
  const profit = deals.revenue - spend;
  return {
    range: { from: fromTs, to: toTs },
    totals: {
      revenue: deals.revenue,
      dealsCount: deals.count,
      spend,
      profit,
      roas: spend > 0 ? Math.round((100 * deals.revenue) / spend) / 100 : null,
      roiPercent: spend > 0 ? Math.round((10000 * profit) / spend) / 100 : null,
    },
    byCampaign,
    byChannel,
    firstTouches: listFirstTouches(siteId, 50),
    dealsList: listDeals(siteId, fromTs, toTs, 100),
    spendList: listAdSpend(siteId, 80),
  };
}

export { db };
