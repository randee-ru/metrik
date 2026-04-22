/**
 * HTTP-сервер аналитики: POST /collect — приём от tracker.js;
 * GET/POST /api/* — панель; статика public/ и dashboard/dist.
 */
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import geoip from "geoip-lite";
import UAParser from "ua-parser-js";
import {
  createSite,
  getSiteByTrackingKey,
  getSiteById,
  updateSite,
  insertEvent,
  listSites,
  statsSummary,
  topReferrers,
  topCities,
  recentEvents,
  listGoals,
  createGoal,
  deleteGoal,
  insertConversion,
  goalStats,
  overviewAllSites,
  tryRecordFirstTouch,
  insertDeal,
  deleteDeal,
  insertAdSpend,
  deleteAdSpend,
  dealTotals,
  crossAnalyticsBundle,
} from "./db.js";
import { verifyOurTrackerInstalled, normalizeSiteUrl } from "./scriptVerifier.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3847;
const isProd = process.env.NODE_ENV === "production";

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0].trim();
  }
  const xri = req.headers["x-real-ip"];
  if (typeof xri === "string") return xri.trim();
  return req.socket.remoteAddress || "";
}

function normalizeIp(ip) {
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

function geoFromIp(ip) {
  const n = normalizeIp(ip);
  if (!n || n === "127.0.0.1" || n === "::1") {
    return { country: null, region: null, city: null, ll_lat: null, ll_lon: null };
  }
  const g = geoip.lookup(n);
  if (!g) {
    return { country: null, region: null, city: null, ll_lat: null, ll_lon: null };
  }
  const [lat, lon] = g.ll || [null, null];
  return {
    country: g.country || null,
    region: g.region || null,
    city: g.city || null,
    ll_lat: lat ?? null,
    ll_lon: lon ?? null,
  };
}

function parseUa(ua) {
  const p = new UAParser(ua || "");
  const device = p.getDevice();
  const type = device.type || "desktop";
  const browser = [p.getBrowser().name, p.getBrowser().version].filter(Boolean).join(" ");
  const os = [p.getOS().name, p.getOS().version].filter(Boolean).join(" ");
  return {
    browser: browser || null,
    os: os || null,
    device_type: type,
  };
}

function matchesGoal(goal, path) {
  const p = path || "";
  const pat = (goal.pattern || "").trim();
  if (!pat) return false;
  const type = goal.match_type;
  if (type === "path_contains") {
    return p.toLowerCase().includes(pat.toLowerCase());
  }
  if (type === "path_equals") {
    return p === pat;
  }
  if (type === "path_prefix") {
    return p.toLowerCase().startsWith(pat.toLowerCase());
  }
  return false;
}

function recordGoalConversions(siteId, eventRow, goals) {
  const pathStr = eventRow.path || "";
  for (const g of goals) {
    if (!matchesGoal(g, pathStr)) continue;
    insertConversion({
      id: crypto.randomUUID(),
      site_id: siteId,
      goal_id: g.id,
      event_id: eventRow.id,
      visitor_id: eventRow.visitor_id || null,
      session_id: eventRow.session_id || null,
      ts: eventRow.ts,
    });
  }
}

const app = express();
app.use(express.json({ limit: "32kb" }));

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.post("/collect", (req, res) => {
  const body = req.body || {};
  const key = body.site || body.tracking_key;
  if (!key || typeof key !== "string") {
    return res.status(400).json({ ok: false, error: "Не указан ключ сайта (site)." });
  }
  const site = getSiteByTrackingKey(key.trim());
  if (!site) {
    return res.status(404).json({ ok: false, error: "Неизвестный ключ сайта." });
  }

  const ip = normalizeIp(clientIp(req));
  const geo = geoFromIp(ip);
  const uaInfo = parseUa(body.user_agent || req.headers["user-agent"]);
  const visitor_id =
    typeof body.visitor_id === "string" && body.visitor_id.trim().length > 0
      ? body.visitor_id.trim().slice(0, 80)
      : null;
  const session_id =
    typeof body.session_id === "string" && body.session_id.trim().length > 0
      ? body.session_id.trim().slice(0, 80)
      : null;

  const row = {
    id: crypto.randomUUID(),
    site_id: site.id,
    ts: Date.now(),
    path: body.path ?? null,
    title: body.title ?? null,
    referrer: body.referrer ?? null,
    utm_source: body.utm_source ?? null,
    utm_medium: body.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? null,
    utm_term: body.utm_term ?? null,
    utm_content: body.utm_content ?? null,
    ip: ip || null,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    ll_lat: geo.ll_lat,
    ll_lon: geo.ll_lon,
    user_agent: body.user_agent || req.headers["user-agent"] || null,
    browser: uaInfo.browser,
    os: uaInfo.os,
    device_type: uaInfo.device_type,
    screen_w: body.screen_w != null ? Number(body.screen_w) : null,
    screen_h: body.screen_h != null ? Number(body.screen_h) : null,
    lang: body.lang ?? null,
    visitor_id,
    session_id,
  };

  try {
    insertEvent(row);
    tryRecordFirstTouch(site.id, visitor_id, row);
    const goals = listGoals(site.id);
    if (goals.length) recordGoalConversions(site.id, row, goals);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Ошибка записи в базу." });
  }
  res.json({ ok: true });
});

app.get("/api/sites", (_req, res) => {
  res.json(listSites());
});

app.post("/api/sites", (req, res) => {
  const body = req.body || {};
  const name = String(body.project_name || body.name || "Новый проект").trim().slice(0, 200);
  const rawUrl = body.site_url != null ? String(body.site_url).trim() : "";
  const site_url = rawUrl ? normalizeSiteUrl(rawUrl) : null;
  if (rawUrl && !site_url) {
    return res.status(400).json({ error: "Некорректный адрес сайта (site_url)." });
  }
  const site = createSite(name || "Проект", site_url);
  res.json(site);
});

app.patch("/api/sites/:siteId", (req, res) => {
  const sites = listSites();
  const site = sites.find((s) => s.id === req.params.siteId);
  if (!site) return res.status(404).json({ error: "Проект не найден." });
  const body = req.body || {};
  const fields = {};
  if (body.project_name !== undefined || body.name !== undefined) {
    fields.name = String(body.project_name ?? body.name ?? site.name).trim().slice(0, 200);
  }
  if (body.site_url !== undefined) {
    if (body.site_url === null || String(body.site_url).trim() === "") {
      fields.site_url = null;
    } else {
      const n = normalizeSiteUrl(String(body.site_url).trim());
      if (!n) return res.status(400).json({ error: "Некорректный адрес сайта." });
      fields.site_url = n;
    }
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "Нет полей для обновления (name, site_url)." });
  }
  const updated = updateSite(req.params.siteId, fields);
  res.json(updated);
});

app.post("/api/sites/:siteId/verify-install", async (req, res) => {
  const site = getSiteById(req.params.siteId);
  if (!site) return res.status(404).json({ error: "Проект не найден." });
  const body = req.body || {};
  const overrideUrl = body.url != null ? String(body.url).trim() : "";
  const pageUrl = overrideUrl || site.site_url;
  if (!pageUrl) {
    return res.status(400).json({
      ok: false,
      error: "Укажите адрес сайта в карточке проекта или передайте { \"url\": \"https://...\" } в теле запроса.",
    });
  }
  try {
    const result = await verifyOurTrackerInstalled(pageUrl, site.tracking_key);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.get("/api/overview", (req, res) => {
  const from = Number(req.query.from) || Date.now() - 7 * 86400000;
  const to = Number(req.query.to) || Date.now();
  res.json({ range: { from, to }, rows: overviewAllSites(from, to) });
});

app.get("/api/sites/:siteId/goals", (req, res) => {
  const sites = listSites();
  const site = sites.find((s) => s.id === req.params.siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  res.json(listGoals(req.params.siteId));
});

app.post("/api/sites/:siteId/goals", (req, res) => {
  const sites = listSites();
  const site = sites.find((s) => s.id === req.params.siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  const body = req.body || {};
  const name = String(body.name || "Цель").trim().slice(0, 200);
  const match_type = String(body.match_type || "path_contains").trim();
  const pattern = String(body.pattern || "").trim().slice(0, 500);
  if (!pattern) {
    return res.status(400).json({ error: "Укажите условие (pattern) для цели." });
  }
  const allowed = ["path_contains", "path_equals", "path_prefix"];
  if (!allowed.includes(match_type)) {
    return res.status(400).json({ error: "Недопустимый тип условия." });
  }
  const g = createGoal(req.params.siteId, name, match_type, pattern);
  res.json(g);
});

app.delete("/api/sites/:siteId/goals/:goalId", (req, res) => {
  const sites = listSites();
  const site = sites.find((s) => s.id === req.params.siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  const n = deleteGoal(req.params.siteId, req.params.goalId);
  if (!n) return res.status(404).json({ error: "Цель не найдена." });
  res.json({ ok: true });
});

app.get("/api/sites/:siteId/summary", (req, res) => {
  const { siteId } = req.params;
  const from = Number(req.query.from) || Date.now() - 7 * 86400000;
  const to = Number(req.query.to) || Date.now();
  const sites = listSites();
  const site = sites.find((s) => s.id === siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  res.json({
    site,
    range: { from, to },
    summary: statsSummary(siteId, from, to),
    deals: dealTotals(siteId, from, to),
    goalStats: goalStats(siteId, from, to),
    referrers: topReferrers(siteId, from, to),
    cities: topCities(siteId, from, to),
    events: recentEvents(siteId, from, to, 300),
  });
});

app.get("/api/sites/:siteId/cross-analytics", (req, res) => {
  const { siteId } = req.params;
  const from = Number(req.query.from) || Date.now() - 7 * 86400000;
  const to = Number(req.query.to) || Date.now();
  const sites = listSites();
  const site = sites.find((s) => s.id === siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  res.json(crossAnalyticsBundle(siteId, from, to));
});

app.post("/api/sites/:siteId/deals", (req, res) => {
  const sites = listSites();
  const site = sites.find((s) => s.id === req.params.siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  const b = req.body || {};
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "Укажите сумму сделки (число ≥ 0)." });
  }
  const id = crypto.randomUUID();
  const created_at = b.created_at != null ? Number(b.created_at) : Date.now();
  insertDeal({
    id,
    site_id: req.params.siteId,
    created_at,
    amount,
    currency: String(b.currency || "RUB").slice(0, 8),
    title: b.title != null ? String(b.title).slice(0, 300) : null,
    visitor_id: b.visitor_id != null ? String(b.visitor_id).slice(0, 80) : null,
    utm_source: b.utm_source != null ? String(b.utm_source).slice(0, 200) : null,
    utm_medium: b.utm_medium != null ? String(b.utm_medium).slice(0, 200) : null,
    utm_campaign: b.utm_campaign != null ? String(b.utm_campaign).slice(0, 200) : null,
    utm_term: b.utm_term != null ? String(b.utm_term).slice(0, 200) : null,
    utm_content: b.utm_content != null ? String(b.utm_content).slice(0, 200) : null,
    referrer: b.referrer != null ? String(b.referrer).slice(0, 2000) : null,
    source: String(b.source || "manual").slice(0, 40),
    notes: b.notes != null ? String(b.notes).slice(0, 2000) : null,
  });
  res.json({ ok: true, id });
});

app.delete("/api/sites/:siteId/deals/:dealId", (req, res) => {
  const sites = listSites();
  const site = sites.find((s) => s.id === req.params.siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  const n = deleteDeal(req.params.siteId, req.params.dealId);
  if (!n) return res.status(404).json({ error: "Сделка не найдена." });
  res.json({ ok: true });
});

app.post("/api/sites/:siteId/ad-spend", (req, res) => {
  const sites = listSites();
  const site = sites.find((s) => s.id === req.params.siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  const b = req.body || {};
  const from_ts = Number(b.from_ts);
  const to_ts = Number(b.to_ts);
  const amount = Number(b.amount);
  if (!Number.isFinite(from_ts) || !Number.isFinite(to_ts) || to_ts < from_ts) {
    return res.status(400).json({ error: "Укажите корректный интервал from_ts / to_ts (мс Unix)." });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "Укажите сумму расхода ≥ 0." });
  }
  const name = String(b.name || "Рекламный расход").trim().slice(0, 200);
  insertAdSpend({
    id: crypto.randomUUID(),
    site_id: req.params.siteId,
    from_ts,
    to_ts,
    utm_campaign: b.utm_campaign != null ? String(b.utm_campaign).slice(0, 200) : null,
    utm_source: b.utm_source != null ? String(b.utm_source).slice(0, 200) : null,
    amount,
    name,
    comment: b.comment != null ? String(b.comment).slice(0, 500) : null,
    created_at: Date.now(),
  });
  res.json({ ok: true });
});

app.delete("/api/sites/:siteId/ad-spend/:spendId", (req, res) => {
  const sites = listSites();
  const site = sites.find((s) => s.id === req.params.siteId);
  if (!site) return res.status(404).json({ error: "Сайт не найден." });
  const n = deleteAdSpend(req.params.siteId, req.params.spendId);
  if (!n) return res.status(404).json({ error: "Запись не найдена." });
  res.json({ ok: true });
});

app.use(express.static(join(root, "public")));
app.use(express.static(join(root, "dashboard", "dist")));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/collect") return next();
  if (isProd) {
    return res.sendFile(join(root, "dashboard", "dist", "index.html"));
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Сервер аналитики: http://localhost:${PORT}`);
  console.log(
    `Пример вставки на сайт: <script async src="http://localhost:${PORT}/tracker.js" data-site="КЛЮЧ_ИЗ_ПАНЕЛИ"></script>`
  );
});
