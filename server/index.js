import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import geoip from "geoip-lite";
import UAParser from "ua-parser-js";
import {
  createSite,
  getSiteByTrackingKey,
  insertEvent,
  listSites,
  statsSummary,
  topReferrers,
  topCities,
  recentEvents,
} from "./db.js";

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

const app = express();
app.use(express.json({ limit: "32kb" }));

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.post("/collect", (req, res) => {
  const body = req.body || {};
  const key = body.site || body.tracking_key;
  if (!key || typeof key !== "string") {
    return res.status(400).json({ ok: false, error: "missing site" });
  }
  const site = getSiteByTrackingKey(key.trim());
  if (!site) {
    return res.status(404).json({ ok: false, error: "unknown site" });
  }

  const ip = normalizeIp(clientIp(req));
  const geo = geoFromIp(ip);
  const uaInfo = parseUa(body.user_agent || req.headers["user-agent"]);

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
  };

  try {
    insertEvent(row);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false });
  }
  res.json({ ok: true });
});

app.get("/api/sites", (_req, res) => {
  res.json(listSites());
});

app.post("/api/sites", (req, res) => {
  const name = (req.body && req.body.name) || "Новый сайт";
  const site = createSite(String(name).slice(0, 200));
  res.json(site);
});

app.get("/api/sites/:siteId/summary", (req, res) => {
  const { siteId } = req.params;
  const from = Number(req.query.from) || Date.now() - 7 * 86400000;
  const to = Number(req.query.to) || Date.now();
  const sites = listSites();
  const site = sites.find((s) => s.id === siteId);
  if (!site) return res.status(404).json({ error: "not found" });
  res.json({
    site,
    range: { from, to },
    summary: statsSummary(siteId, from, to),
    referrers: topReferrers(siteId, from, to),
    cities: topCities(siteId, from, to),
    events: recentEvents(siteId, from, to, 300),
  });
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
  console.log(`Analytics server http://localhost:${PORT}`);
  console.log(`Встройте скрипт: <script async src="http://localhost:${PORT}/tracker.js" data-site="КЛЮЧ"></script>`);
});
