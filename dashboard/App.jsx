import React, { useEffect, useMemo, useState, useCallback } from "react";

const css = `
:root {
  --bg: #0b0d11;
  --panel: #131820;
  --border: #252d3d;
  --text: #e8ecf3;
  --muted: #8a96ab;
  --accent: #3d8bfd;
  --roi: #ff7a2e;
  --roi-dim: rgba(255, 122, 46, 0.15);
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
.mono { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 12px; }
.layout { max-width: 1320px; margin: 0 auto; padding: 24px 20px 48px; }
h1 { font-size: 1.4rem; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.02em; }
.sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 20px; max-width: 720px; line-height: 1.45; }
.row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 16px; }
label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
select, input, button {
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
}
button {
  cursor: pointer;
  background: linear-gradient(180deg, #2a6fd4, var(--accent));
  border-color: #5a9ef8;
  font-weight: 500;
}
button.secondary { background: var(--panel); border-color: var(--border); font-weight: 400; }
button.danger { background: #3a2228; border-color: #8b3a44; color: #ffb4bc; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.tab {
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}
.tab:hover { color: var(--text); border-color: #3a4558; }
.tab.active { color: var(--text); border-color: var(--accent); background: #1a2433; box-shadow: 0 0 0 1px var(--accent-dim, rgba(61,139,253,0.2)); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 18px; }
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}
.card.roi { border-color: #4a3528; background: linear-gradient(145deg, #1a1512, var(--panel)); }
.card .v { font-size: 1.55rem; font-weight: 600; letter-spacing: -0.03em; }
.card .v.roi-c { color: var(--roi); }
.card .k { color: var(--muted); font-size: 11px; margin-top: 4px; line-height: 1.35; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
@media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}
.panel h2 { margin: 0 0 12px; font-size: 0.95rem; font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
th.num, td.num { text-align: right; }
tr:last-child td { border-bottom: none; }
tr.clickable { cursor: pointer; }
tr.clickable:hover td { background: rgba(255,255,255,0.03); }
tr.totals td { font-weight: 600; border-top: 1px solid var(--border); background: rgba(0,0,0,0.2); }
.snippet {
  background: #080a0e;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.5;
}
.bar { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.bar .track { flex: 1; height: 6px; background: #080a0e; border-radius: 4px; overflow: hidden; }
.bar .fill { height: 100%; background: var(--accent); border-radius: 4px; }
.err { color: #ff6b6b; font-size: 14px; margin: 8px 0; }
.pill { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; background: var(--roi-dim); color: var(--roi); font-weight: 500; }
.verify-ok { color: #34c759; font-size: 14px; margin-top: 8px; }
.verify-bad { color: #ff6b6b; font-size: 14px; margin-top: 8px; }
.verify-muted { color: var(--muted); font-size: 13px; margin-top: 6px; }
.subtabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
.st {
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--muted);
  cursor: pointer;
  font-weight: 500;
}
.st:hover { color: var(--text); }
.st.active { color: var(--roi); border-color: #6a4a32; background: #1a1512; }
`;

function daysAgo(n) {
  return Date.now() - n * 86400000;
}

function deviceTypeRu(type) {
  if (!type) return "—";
  const map = {
    desktop: "Компьютер",
    mobile: "Смартфон",
    tablet: "Планшет",
    console: "Игровая приставка",
    smarttv: "Смарт-ТВ",
    wearable: "Носимое устройство",
    embedded: "Встроенное устройство",
  };
  return map[type] || type;
}

function matchTypeLabel(t) {
  const m = {
    path_contains: "URL содержит",
    path_equals: "URL равен",
    path_prefix: "URL начинается с",
  };
  return m[t] || t;
}

function shortId(s, n = 8) {
  if (!s) return "—";
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function formatMoney(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Math.round(Number(n)).toLocaleString("ru-RU")} ₽`;
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [sites, setSites] = useState([]);
  const [view, setView] = useState("overview");
  const [siteId, setSiteId] = useState("");
  const [range, setRange] = useState("7");
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newProjectName, setNewProjectName] = useState("Мой проект");
  const [newSiteUrl, setNewSiteUrl] = useState("https://");
  const [projectEditName, setProjectEditName] = useState("");
  const [projectEditUrl, setProjectEditUrl] = useState("");
  const [verifyPageUrl, setVerifyPageUrl] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [goalName, setGoalName] = useState("Заявка / thank-you");
  const [goalType, setGoalType] = useState("path_contains");
  const [goalPattern, setGoalPattern] = useState("/thanks");
  const [siteTab, setSiteTab] = useState("detail");
  const [crossData, setCrossData] = useState(null);
  const [dealAmount, setDealAmount] = useState("50000");
  const [dealTitle, setDealTitle] = useState("Сделка из CRM");
  const [dealCampaign, setDealCampaign] = useState("");
  const [spendName, setSpendName] = useState("Яндекс Директ");
  const [spendAmount, setSpendAmount] = useState("15000");
  const [spendCampaign, setSpendCampaign] = useState("");
  const [spendFrom, setSpendFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return isoDay(d);
  });
  const [spendTo, setSpendTo] = useState(() => isoDay(new Date()));

  const apiBase = "";

  const { from, to } = useMemo(() => {
    const d = Number(range);
    return { from: daysAgo(d), to: Date.now() };
  }, [range]);

  async function loadSites() {
    setError("");
    try {
      const r = await fetch(`${apiBase}/api/sites`);
      if (!r.ok) throw new Error("Не удалось загрузить сайты");
      const list = await r.json();
      setSites(list);
      if (!siteId && list[0]) setSiteId(list[0].id);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function loadOverview() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        `${apiBase}/api/overview?from=${from}&to=${to}`
      );
      if (!r.ok) throw new Error("Не удалось загрузить обзор");
      setOverview(await r.json());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    if (!siteId) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        `${apiBase}/api/sites/${encodeURIComponent(siteId)}/summary?from=${from}&to=${to}`
      );
      if (!r.ok) throw new Error("Ошибка загрузки статистики");
      setData(await r.json());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadCross() {
    if (!siteId) return;
    setCrossData(null);
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        `${apiBase}/api/sites/${encodeURIComponent(siteId)}/cross-analytics?from=${from}&to=${to}`
      );
      if (!r.ok) throw new Error("Не удалось загрузить сквозную аналитику");
      setCrossData(await r.json());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createSite() {
    setError("");
    try {
      const r = await fetch(`${apiBase}/api/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: newProjectName || "Проект",
          site_url: newSiteUrl.trim() && newSiteUrl.trim() !== "https://" ? newSiteUrl.trim() : "",
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Не удалось создать проект");
      }
      const s = await r.json();
      await loadSites();
      setSiteId(s.id);
      setSiteTab("detail");
      setView("site");
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  const syncProjectFields = useCallback(() => {
    const s = sites.find((x) => x.id === siteId);
    if (s) {
      setProjectEditName(s.name);
      setProjectEditUrl(s.site_url || "");
      setVerifyPageUrl("");
      setVerifyResult(null);
    }
  }, [siteId, sites]);

  useEffect(() => {
    syncProjectFields();
  }, [syncProjectFields]);

  async function saveProject() {
    if (!siteId) return;
    setError("");
    try {
      const r = await fetch(`${apiBase}/api/sites/${encodeURIComponent(siteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: projectEditName || "Проект",
          site_url: projectEditUrl.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Не сохранилось");
      }
      await loadSites();
      await loadSummary();
      setVerifyResult(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function verifyInstall() {
    if (!siteId) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    setError("");
    try {
      const body = {};
      const u = verifyPageUrl.trim();
      if (u) body.url = u;
      const r = await fetch(
        `${apiBase}/api/sites/${encodeURIComponent(siteId)}/verify-install`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = j.error || `Ошибка ${r.status}`;
        setVerifyResult({ ok: false, error: msg, urlChecked: j.urlChecked });
        setError(msg);
        return;
      }
      setVerifyResult(j);
      if (!j.ok) setError(j.error || "Счётчик не найден или ключ не совпадает");
      else setError("");
    } catch (e) {
      setVerifyResult({ ok: false, error: e.message || String(e) });
      setError(e.message || String(e));
    } finally {
      setVerifyLoading(false);
    }
  }

  async function createGoal() {
    setError("");
    try {
      const r = await fetch(`${apiBase}/api/sites/${encodeURIComponent(siteId)}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: goalName || "Цель",
          match_type: goalType,
          pattern: goalPattern,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Не удалось создать цель");
      }
      await loadSummary();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function removeGoal(goalId) {
    if (!confirm("Удалить цель и связанные конверсии?")) return;
    setError("");
    try {
      const r = await fetch(
        `${apiBase}/api/sites/${encodeURIComponent(siteId)}/goals/${encodeURIComponent(goalId)}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error("Не удалось удалить");
      await loadSummary();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (view === "overview") {
      loadOverview();
      return;
    }
    if (!siteId) return;
    if (siteTab === "detail") loadSummary();
    else loadCross();
  }, [view, siteId, from, to, siteTab]);

  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";

  const embedCode = useMemo(() => {
    const site = sites.find((s) => s.id === siteId);
    if (!site || !origin) return "";
    return `<script async src="${origin}/tracker.js" data-site="${site.tracking_key}"></script>`;
  }, [sites, siteId, origin]);

  const maxRef = useMemo(() => {
    if (!data?.referrers?.length) return 1;
    return Math.max(...data.referrers.map((x) => x.c), 1);
  }, [data]);

  const maxCity = useMemo(() => {
    if (!data?.cities?.length) return 1;
    return Math.max(...data.cities.map((x) => x.c), 1);
  }, [data]);

  const overviewTotals = useMemo(() => {
    if (!overview?.rows?.length) {
      return { visits: 0, visitors: 0, sessions: 0, convHits: 0, convVis: 0, cr: 0 };
    }
    let visits = 0;
    let visitors = 0;
    let sessions = 0;
    let convHits = 0;
    let convVis = 0;
    for (const r of overview.rows) {
      visits += r.summary.total;
      visitors += r.summary.uniqueVisitors;
      sessions += r.summary.uniqueSessions;
      convHits += r.summary.conversionHits;
      convVis += r.summary.conversionVisitors;
    }
    const cr = visitors > 0 ? Math.round((10000 * convVis) / visitors) / 100 : 0;
    return { visits, visitors, sessions, convHits, convVis, cr };
  }, [overview]);

  function openSite(id) {
    setSiteId(id);
    setSiteTab("detail");
    setView("site");
  }

  async function submitDeal() {
    setError("");
    const amount = Number(String(dealAmount).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Введите корректную сумму сделки");
      return;
    }
    try {
      const r = await fetch(`${apiBase}/api/sites/${encodeURIComponent(siteId)}/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          title: dealTitle || "Сделка",
          utm_campaign: dealCampaign.trim() || null,
          source: "manual",
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Ошибка сохранения сделки");
      }
      await loadCross();
      if (siteTab === "detail") await loadSummary();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function submitSpend() {
    setError("");
    const amount = Number(String(spendAmount).replace(/\s/g, "").replace(",", "."));
    const from_ts = new Date(spendFrom + "T00:00:00").getTime();
    const to_ts = new Date(spendTo + "T23:59:59.999").getTime();
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(from_ts) || !Number.isFinite(to_ts)) {
      setError("Проверьте сумму и даты расхода");
      return;
    }
    if (to_ts < from_ts) {
      setError("Дата «по» раньше даты «с»");
      return;
    }
    try {
      const r = await fetch(`${apiBase}/api/sites/${encodeURIComponent(siteId)}/ad-spend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: spendName || "Реклама",
          amount,
          from_ts,
          to_ts,
          utm_campaign: spendCampaign.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Ошибка сохранения расхода");
      }
      await loadCross();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function removeDeal(dealId) {
    if (!confirm("Удалить сделку?")) return;
    try {
      const r = await fetch(
        `${apiBase}/api/sites/${encodeURIComponent(siteId)}/deals/${encodeURIComponent(dealId)}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error("Не удалось удалить");
      await loadCross();
      if (siteTab === "detail") await loadSummary();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function removeSpend(spendId) {
    if (!confirm("Удалить запись расхода?")) return;
    try {
      const r = await fetch(
        `${apiBase}/api/sites/${encodeURIComponent(siteId)}/ad-spend/${encodeURIComponent(spendId)}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error("Не удалось удалить");
      await loadCross();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  const uv = data?.summary?.uniqueVisitors || 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="layout">
        <h1>Аналитика по сайтам</h1>
        <p className="sub">
          Визиты, посетители, сессии, цели по URL и конверсия. В разделе «Сквозная аналитика» —
          сделки с выручкой, расходы на рекламу, отчёт по <strong>utm_campaign</strong>, группы
          каналов, первое касание посетителя (как основа для атрибуции). Интеграции с рекламой и
          CRM можно навесить через API сделок и расходов.
        </p>

        {error ? <div className="err">{error}</div> : null}

        <div className="tabs">
          <button
            type="button"
            className={`tab ${view === "overview" ? "active" : ""}`}
            onClick={() => setView("overview")}
          >
            Все сайты
          </button>
          <button
            type="button"
            className={`tab ${view === "site" ? "active" : ""}`}
            onClick={() => setView("site")}
            disabled={!sites.length}
          >
            Детализация проекта
          </button>
        </div>

        <div className="row">
          {view === "site" ? (
            <div>
              <label>Проект</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                disabled={!sites.length}
              >
                {sites.length === 0 ? (
                  <option value="">Нет проектов</option>
                ) : (
                  sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.site_url ? ` — ${s.site_url.replace(/^https?:\/\//, "").slice(0, 40)}` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : null}
          <div>
            <label>Период</label>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="1">24 часа</option>
              <option value="7">7 дней</option>
              <option value="30">30 дней</option>
            </select>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (view === "overview") loadOverview();
              else if (siteTab === "detail") loadSummary();
              else loadCross();
            }}
            disabled={loading}
          >
            Обновить
          </button>
        </div>

        {view === "site" ? (
          <div className="subtabs">
            <button
              type="button"
              className={`st ${siteTab === "detail" ? "active" : ""}`}
              onClick={() => setSiteTab("detail")}
            >
              Сводка и цели
            </button>
            <button
              type="button"
              className={`st ${siteTab === "cross" ? "active" : ""}`}
              onClick={() => setSiteTab("cross")}
            >
              Сквозная аналитика
            </button>
          </div>
        ) : null}

        {view === "overview" && overview ? (
          <div className="panel">
            <h2>Сводка по проектам</h2>
            <p className="sub" style={{ marginTop: 0, marginBottom: 12 }}>
              Строка «Итого» суммирует визиты и сессии; посетители и конверсии по сайтам
              суммируются приближённо (один человек на двух сайтах считается дважды).
            </p>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Проект / адрес сайта</th>
                    <th className="num">Визиты</th>
                    <th className="num">Посетители</th>
                    <th className="num">Сессии</th>
                    <th className="num">Целей (сраб.)</th>
                    <th className="num">Конв. посет.</th>
                    <th className="num">CR, %</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.map(({ site, summary }) => (
                    <tr key={site.id} className="clickable" onClick={() => openSite(site.id)}>
                      <td>
                        <strong>{site.name}</strong>
                        {site.site_url ? (
                          <div className="mono" style={{ color: "var(--muted)", marginTop: 2, fontSize: 12 }}>
                            {site.site_url}
                          </div>
                        ) : null}
                        <div className="mono" style={{ color: "var(--muted)", marginTop: 2 }}>
                          ключ: {shortId(site.tracking_key, 24)}
                        </div>
                      </td>
                      <td className="num mono">{summary.total}</td>
                      <td className="num mono">{summary.uniqueVisitors}</td>
                      <td className="num mono">{summary.uniqueSessions}</td>
                      <td className="num mono">{summary.conversionHits}</td>
                      <td className="num mono">{summary.conversionVisitors}</td>
                      <td className="num">
                        <span className="pill">{summary.crPercent} %</span>
                      </td>
                    </tr>
                  ))}
                  {overview.rows.length > 0 ? (
                    <tr className="totals">
                      <td>Итого</td>
                      <td className="num mono">{overviewTotals.visits}</td>
                      <td className="num mono">{overviewTotals.visitors}</td>
                      <td className="num mono">{overviewTotals.sessions}</td>
                      <td className="num mono">{overviewTotals.convHits}</td>
                      <td className="num mono">{overviewTotals.convVis}</td>
                      <td className="num">
                        <span className="pill">{overviewTotals.cr} %</span>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ color: "var(--muted)" }}>
                        Нет сайтов. Создайте первый в блоке ниже и установите счётчик.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {view === "site" && siteTab === "detail" && siteId ? (
          <div className="panel">
            <h2>Проект и проверка счётчика</h2>
            <p className="sub" style={{ marginTop: 0 }}>
              Укажите публичный URL сайта (главная или страница, где точно стоит код). Проверка
              скачивает HTML и ищет <span className="mono">tracker.js</span> и атрибут{" "}
              <span className="mono">data-site</span> с ключом этого проекта.
            </p>
            <div className="row" style={{ marginBottom: 12 }}>
              <div>
                <label>Название проекта</label>
                <input value={projectEditName} onChange={(e) => setProjectEditName(e.target.value)} />
              </div>
              <div style={{ flex: "1 1 280px", minWidth: 200 }}>
                <label>Адрес сайта (https://…)</label>
                <input
                  value={projectEditUrl}
                  onChange={(e) => setProjectEditUrl(e.target.value)}
                  placeholder="https://example.ru"
                />
              </div>
              <button type="button" className="secondary" onClick={saveProject}>
                Сохранить
              </button>
            </div>
            <div className="row" style={{ marginBottom: 0 }}>
              <div style={{ flex: "1 1 280px", minWidth: 200 }}>
                <label>Проверить другую страницу (необязательно)</label>
                <input
                  value={verifyPageUrl}
                  onChange={(e) => setVerifyPageUrl(e.target.value)}
                  placeholder="если пусто — берётся адрес сайта выше"
                />
              </div>
              <button type="button" onClick={verifyInstall} disabled={verifyLoading || !siteId}>
                {verifyLoading ? "Проверка…" : "Проверить установку"}
              </button>
            </div>
            {verifyResult ? (
              <div className={verifyResult.ok ? "verify-ok" : "verify-bad"}>
                {verifyResult.ok ? verifyResult.message : verifyResult.error}
                {verifyResult.urlChecked ? (
                  <div className="verify-muted mono">URL: {verifyResult.urlChecked}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {view === "site" && siteTab === "detail" && data ? (
          <>
            <div className="cards">
              <div className="card">
                <div className="v">{data.summary.total}</div>
                <div className="k">Визиты (просмотры страниц)</div>
              </div>
              <div className="card">
                <div className="v">{data.summary.uniqueVisitors}</div>
                <div className="k">Посетители (ID + запас по IP)</div>
              </div>
              <div className="card">
                <div className="v">{data.summary.uniqueSessions}</div>
                <div className="k">Сессии (30 мин бездействия)</div>
              </div>
              <div className="card">
                <div className="v">{data.summary.uniqueIp}</div>
                <div className="k">Уникальных IP</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">{data.summary.conversionHits}</div>
                <div className="k">Срабатываний целей</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">{data.summary.conversionVisitors}</div>
                <div className="k">Посетителей с конверсией</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">{data.summary.crPercent} %</div>
                <div className="k">CR — доля посетителей, дошедших до цели</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">{data.deals?.count ?? 0}</div>
                <div className="k">Сделок в периоде (ручной ввод / API)</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">{formatMoney(data.deals?.revenue)}</div>
                <div className="k">Выручка по сделкам</div>
              </div>
            </div>

            <div className="panel">
              <h2>Цели и конверсии</h2>
              <p className="sub" style={{ marginTop: 0 }}>
                При совпадении URL страницы с условием фиксируется конверсия. Несколько целей
                могут сработать на одном просмотре.
              </p>
              <div className="row" style={{ marginBottom: 12 }}>
                <div>
                  <label>Название цели</label>
                  <input value={goalName} onChange={(e) => setGoalName(e.target.value)} />
                </div>
                <div>
                  <label>Условие</label>
                  <select value={goalType} onChange={(e) => setGoalType(e.target.value)}>
                    <option value="path_contains">URL содержит текст</option>
                    <option value="path_prefix">URL начинается с</option>
                    <option value="path_equals">URL полностью равен</option>
                  </select>
                </div>
                <div style={{ flex: "1 1 200px", minWidth: 160 }}>
                  <label>Значение (часть адреса)</label>
                  <input
                    value={goalPattern}
                    onChange={(e) => setGoalPattern(e.target.value)}
                    placeholder="/spasibo или order"
                  />
                </div>
                <button type="button" onClick={createGoal}>
                  Добавить цель
                </button>
              </div>
              {data.goalStats?.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Цель</th>
                      <th>Условие</th>
                      <th className="num">Сраб.</th>
                      <th className="num">Посет.</th>
                      <th className="num">CR по цели</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.goalStats.map((g) => {
                      const crG =
                        uv > 0 ? Math.round((10000 * (g.reached_visitors || 0)) / uv) / 100 : 0;
                      return (
                        <tr key={g.id}>
                          <td>{g.name}</td>
                          <td className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>
                            {matchTypeLabel(g.match_type)} «{g.pattern}»
                          </td>
                          <td className="num mono">{g.hits}</td>
                          <td className="num mono">{g.reached_visitors}</td>
                          <td className="num">
                            <span className="pill">{crG} %</span>
                          </td>
                          <td>
                            <button type="button" className="danger" onClick={() => removeGoal(g.id)}>
                              Удалить
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: "var(--muted)", margin: 0 }}>Целей пока нет — добавьте хотя бы одну.</p>
              )}
            </div>

            {embedCode ? (
              <div className="panel">
                <h2>Код счётчика на сайт</h2>
                <p className="sub" style={{ marginTop: 0 }}>
                  Вставьте перед <span className="mono">&lt;/body&gt;</span>. В{" "}
                  <span className="mono">src</span> укажите URL вашего сервера аналитики; в{" "}
                  <span className="mono">data-site</span> — ключ из этого проекта (блок выше или в
                  списке проектов). После установки нажмите «Проверить установку».
                </p>
                <div className="snippet mono">{embedCode}</div>
              </div>
            ) : null}

            <div className="grid2">
              <div className="panel">
                <h2>Откуда пришли</h2>
                {data.referrers.map((r) => (
                  <div key={r.ref} className="bar">
                    <span
                      className="mono"
                      style={{
                        flex: "0 0 38%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={r.ref}
                    >
                      {r.ref}
                    </span>
                    <div className="track">
                      <div className="fill" style={{ width: `${(r.c / maxRef) * 100}%` }} />
                    </div>
                    <span className="mono" style={{ minWidth: 32, textAlign: "right" }}>
                      {r.c}
                    </span>
                  </div>
                ))}
              </div>
              <div className="panel">
                <h2>Город / страна</h2>
                {data.cities.map((c) => (
                  <div key={`${c.city}-${c.country}`} className="bar">
                    <span
                      style={{ flex: "0 0 42%", overflow: "hidden", textOverflow: "ellipsis" }}
                      title={c.city}
                    >
                      {c.city}
                      <span style={{ color: "var(--muted)", fontSize: 12 }}> · {c.country || "—"}</span>
                    </span>
                    <div className="track">
                      <div className="fill" style={{ width: `${(c.c / maxCity) * 100}%` }} />
                    </div>
                    <span className="mono" style={{ minWidth: 32, textAlign: "right" }}>
                      {c.c}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Журнал визитов</h2>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>Страница</th>
                      <th>Источник</th>
                      <th>Посетитель</th>
                      <th>Сессия</th>
                      <th>IP</th>
                      <th>Гео</th>
                      <th>Устройство</th>
                      <th>Браузер / ОС</th>
                      <th>Экран</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e) => (
                      <tr key={e.id}>
                        <td className="mono">{new Date(e.ts).toLocaleString("ru-RU")}</td>
                        <td className="mono" title={e.path}>
                          {(e.path || "").slice(0, 40)}
                          {(e.path || "").length > 40 ? "…" : ""}
                        </td>
                        <td className="mono" title={e.referrer || ""}>
                          {(e.referrer || "—").slice(0, 22)}
                        </td>
                        <td className="mono" title={e.visitor_id || ""}>
                          {shortId(e.visitor_id, 10)}
                        </td>
                        <td className="mono" title={e.session_id || ""}>
                          {shortId(e.session_id, 8)}
                        </td>
                        <td className="mono">{e.ip || "—"}</td>
                        <td>
                          {[e.city, e.region, e.country].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td>{deviceTypeRu(e.device_type)}</td>
                        <td>
                          <div>{e.browser || "—"}</div>
                          <div className="mono" style={{ color: "var(--muted)" }}>
                            {e.os || ""}
                          </div>
                        </td>
                        <td className="mono">
                          {e.screen_w != null ? `${e.screen_w}×${e.screen_h}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {view === "site" && siteTab === "cross" && loading && !crossData ? (
          <div className="panel" style={{ color: "var(--muted)" }}>
            Загрузка сквозной аналитики…
          </div>
        ) : null}

        {view === "site" && siteTab === "cross" && crossData ? (
          <>
            <div className="cards">
              <div className="card roi">
                <div className="v roi-c">{formatMoney(crossData.totals.revenue)}</div>
                <div className="k">Выручка (сделки за период)</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">{formatMoney(crossData.totals.spend)}</div>
                <div className="k">Рекламные расходы (пересечение с периодом)</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">{formatMoney(crossData.totals.profit)}</div>
                <div className="k">Прибыль (выручка − расход)</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">
                  {crossData.totals.roas != null ? `${crossData.totals.roas}×` : "—"}
                </div>
                <div className="k">ROAS (выручка / расход)</div>
              </div>
              <div className="card roi">
                <div className="v roi-c">
                  {crossData.totals.roiPercent != null ? `${crossData.totals.roiPercent} %` : "—"}
                </div>
                <div className="k">ROI % ((прибыль) / расход)</div>
              </div>
            </div>

            <div className="panel">
              <h2>По кампании (utm_campaign)</h2>
              <p className="sub" style={{ marginTop: 0 }}>
                Конверсии привязаны к UTM <strong>в момент цели</strong> (последнее касание на
                сайте). Сделки и расходы группируйте тем же значением utm_campaign.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Кампания</th>
                      <th className="num">Визиты</th>
                      <th className="num">Посет.</th>
                      <th className="num">Целей</th>
                      <th className="num">Конв. посет.</th>
                      <th className="num">Сделок</th>
                      <th className="num">Выручка</th>
                      <th className="num">Расход</th>
                      <th className="num">ROAS</th>
                      <th className="num">CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossData.byCampaign.map((r) => (
                      <tr key={r.campaign}>
                        <td className="mono">{r.campaign}</td>
                        <td className="num mono">{r.visits}</td>
                        <td className="num mono">{r.visitors}</td>
                        <td className="num mono">{r.conversionHits}</td>
                        <td className="num mono">{r.conversionVisitors}</td>
                        <td className="num mono">{r.dealsCount}</td>
                        <td className="num mono">{formatMoney(r.revenue)}</td>
                        <td className="num mono">{formatMoney(r.spend)}</td>
                        <td className="num mono">{r.roas != null ? `${r.roas}×` : "—"}</td>
                        <td className="num mono">{r.cpa != null ? formatMoney(r.cpa) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <h2>Каналы трафика (эвристика)</h2>
              <p className="sub" style={{ marginTop: 0 }}>
                Группировка по utm_medium / utm_source / рефереру — упрощённая модель, не
                замена отчётам рекламных кабинетов.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Канал</th>
                    <th className="num">Визиты</th>
                    <th className="num">Сраб. целей</th>
                  </tr>
                </thead>
                <tbody>
                  {crossData.byChannel.map((r) => (
                    <tr key={r.channel}>
                      <td>{r.channel}</td>
                      <td className="num mono">{r.visits}</td>
                      <td className="num mono">{r.conversion_hits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid2">
              <div className="panel">
                <h2>Добавить сделку (выручку)</h2>
                <p className="sub" style={{ marginTop: 0 }}>
                  Ручной ввод или вызов <span className="mono">POST /api/sites/…/deals</span> из CRM.
                </p>
                <div className="row" style={{ marginBottom: 0 }}>
                  <div>
                    <label>Сумма, ₽</label>
                    <input value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} />
                  </div>
                  <div style={{ flex: "1 1 160px" }}>
                    <label>Название</label>
                    <input value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} />
                  </div>
                  <div style={{ flex: "1 1 140px" }}>
                    <label>utm_campaign</label>
                    <input
                      value={dealCampaign}
                      onChange={(e) => setDealCampaign(e.target.value)}
                      placeholder="как в рекламе"
                    />
                  </div>
                  <button type="button" onClick={submitDeal}>
                    Сохранить сделку
                  </button>
                </div>
              </div>
              <div className="panel">
                <h2>Добавить расход на рекламу</h2>
                <p className="sub" style={{ marginTop: 0 }}>
                  Интервал дат задаёт период действия ставки; в отчёт попадает пересечение с
                  выбранным фильтром периода.
                </p>
                <div className="row" style={{ marginBottom: 0 }}>
                  <div>
                    <label>Название</label>
                    <input value={spendName} onChange={(e) => setSpendName(e.target.value)} />
                  </div>
                  <div>
                    <label>Сумма, ₽</label>
                    <input value={spendAmount} onChange={(e) => setSpendAmount(e.target.value)} />
                  </div>
                  <div>
                    <label>С даты</label>
                    <input type="date" value={spendFrom} onChange={(e) => setSpendFrom(e.target.value)} />
                  </div>
                  <div>
                    <label>По дату</label>
                    <input type="date" value={spendTo} onChange={(e) => setSpendTo(e.target.value)} />
                  </div>
                  <div>
                    <label>utm_campaign</label>
                    <input
                      value={spendCampaign}
                      onChange={(e) => setSpendCampaign(e.target.value)}
                      placeholder="привязка"
                    />
                  </div>
                  <button type="button" onClick={submitSpend}>
                    Сохранить расход
                  </button>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2>Первое касание (новые посетители)</h2>
              <p className="sub" style={{ marginTop: 0 }}>
                Запись создаётся при первом визите с известным visitor_id — основа для модели
                first-click по UTM.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>Посетитель</th>
                      <th>utm_campaign</th>
                      <th>utm_source</th>
                      <th>Реферер</th>
                      <th>Страница</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossData.firstTouches.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ color: "var(--muted)" }}>
                          Пока нет записей с visitor_id (нужен обновлённый счётчик на сайте).
                        </td>
                      </tr>
                    ) : null}
                    {crossData.firstTouches.map((ft) => (
                      <tr key={`${ft.visitor_id}-${ft.site_id}`}>
                        <td className="mono">{new Date(ft.ts).toLocaleString("ru-RU")}</td>
                        <td className="mono" title={ft.visitor_id}>
                          {shortId(ft.visitor_id, 12)}
                        </td>
                        <td className="mono">{ft.utm_campaign || "—"}</td>
                        <td className="mono">{ft.utm_source || "—"}</td>
                        <td className="mono" title={ft.referrer || ""}>
                          {(ft.referrer || "—").slice(0, 28)}
                        </td>
                        <td className="mono" title={ft.path || ""}>
                          {(ft.path || "—").slice(0, 36)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid2">
              <div className="panel">
                <h2>Сделки в периоде</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Сумма</th>
                      <th>Название</th>
                      <th>utm_campaign</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {crossData.dealsList.map((d) => (
                      <tr key={d.id}>
                        <td className="mono">{new Date(d.created_at).toLocaleString("ru-RU")}</td>
                        <td className="num mono">{formatMoney(d.amount)}</td>
                        <td>{d.title || "—"}</td>
                        <td className="mono">{d.utm_campaign || "—"}</td>
                        <td>
                          <button type="button" className="danger" onClick={() => removeDeal(d.id)}>
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel">
                <h2>Зарегистрированные расходы</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Период</th>
                      <th className="num">Сумма</th>
                      <th>utm_campaign</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {crossData.spendList.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td className="mono">
                          {new Date(s.from_ts).toLocaleDateString("ru-RU")} —{" "}
                          {new Date(s.to_ts).toLocaleDateString("ru-RU")}
                        </td>
                        <td className="num mono">{formatMoney(s.amount)}</td>
                        <td className="mono">{s.utm_campaign || "—"}</td>
                        <td>
                          <button type="button" className="danger" onClick={() => removeSpend(s.id)}>
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        <div className="panel">
          <h2>Новый проект</h2>
          <p className="sub" style={{ marginTop: 0 }}>
            Название — как в отчётах; адрес сайта нужен для проверки счётчика (можно добавить позже
            в карточке проекта).
          </p>
          <div className="row" style={{ marginBottom: 0 }}>
            <div>
              <label>Название проекта</label>
              <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 260px", minWidth: 200 }}>
              <label>Адрес сайта</label>
              <input
                value={newSiteUrl}
                onChange={(e) => setNewSiteUrl(e.target.value)}
                placeholder="https://mysite.ru"
              />
            </div>
            <button type="button" onClick={createSite}>
              Создать проект и ключ
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
