import React, { useEffect, useMemo, useState } from "react";

const css = `
:root {
  --bg: #0c0f14;
  --panel: #141a22;
  --border: #243044;
  --text: #e8edf4;
  --muted: #8b9cb3;
  --accent: #3d8bfd;
  --accent-dim: #1e4a7a;
  --success: #34c759;
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
.layout { max-width: 1200px; margin: 0 auto; padding: 24px 20px 48px; }
h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.02em; }
.sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 24px; }
.row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 20px; }
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
button:disabled { opacity: 0.5; cursor: not-allowed; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
.card .v { font-size: 1.75rem; font-weight: 600; letter-spacing: -0.03em; }
.card .k { color: var(--muted); font-size: 12px; margin-top: 4px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
@media (max-width: 800px) { .grid2 { grid-template-columns: 1fr; } }
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
tr:last-child td { border-bottom: none; }
.snippet {
  background: #0a0d12;
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
.bar .track { flex: 1; height: 6px; background: #0a0d12; border-radius: 4px; overflow: hidden; }
.bar .fill { height: 100%; background: var(--accent); border-radius: 4px; }
.err { color: #ff6b6b; font-size: 14px; margin: 8px 0; }
`;

function daysAgo(n) {
  return Date.now() - n * 86400000;
}

export default function App() {
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [range, setRange] = useState("7");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("Мой сайт");

  const apiBase =
    typeof import.meta !== "undefined" && import.meta.env?.DEV
      ? ""
      : "";

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

  async function loadSummary() {
    if (!siteId) return;
    setLoading(true);
    setError("");
    const d = Number(range);
    const from = daysAgo(d);
    const to = Date.now();
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

  async function createSite() {
    setError("");
    try {
      const r = await fetch(`${apiBase}/api/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName || "Сайт" }),
      });
      if (!r.ok) throw new Error("Не создался сайт");
      const s = await r.json();
      await loadSites();
      setSiteId(s.id);
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    loadSummary();
  }, [siteId, range]);

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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="layout">
        <h1>Статистика и аналитика</h1>
        <p className="sub">
          Сбор просмотров по встраиваемому скрипту: источник, UTM, IP, гео по IP (MaxMind
          GeoLite), устройство, экран, язык.
        </p>

        {error ? <div className="err">{error}</div> : null}

        <div className="row">
          <div>
            <label>Сайт</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Период</label>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="1">24 часа</option>
              <option value="7">7 дней</option>
              <option value="30">30 дней</option>
            </select>
          </div>
          <button type="button" className="secondary" onClick={loadSummary} disabled={loading}>
            Обновить
          </button>
        </div>

        <div className="panel">
          <h2>Новый сайт</h2>
          <div className="row" style={{ marginBottom: 0 }}>
            <div>
              <label>Название</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <button type="button" onClick={createSite}>
              Создать и получить ключ
            </button>
          </div>
        </div>

        {embedCode ? (
          <div className="panel">
            <h2>Код для вставки на сайт</h2>
            <p className="sub" style={{ marginTop: 0 }}>
              Вставьте перед закрывающим <span className="mono">&lt;/body&gt;</span>. Для
              сторонних доменов замените URL на адрес вашего сервера аналитики.
            </p>
            <div className="snippet mono">{embedCode}</div>
          </div>
        ) : null}

        {data ? (
          <>
            <div className="cards">
              <div className="card">
                <div className="v">{data.summary.total}</div>
                <div className="k">Просмотров</div>
              </div>
              <div className="card">
                <div className="v">{data.summary.uniqueIp}</div>
                <div className="k">Уникальных IP</div>
              </div>
            </div>

            <div className="grid2">
              <div className="panel">
                <h2>Откуда пришли</h2>
                {data.referrers.map((r) => (
                  <div key={r.ref} className="bar">
                    <span className="mono" style={{ flex: "0 0 38%", overflow: "hidden", textOverflow: "ellipsis" }} title={r.ref}>
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
                    <span style={{ flex: "0 0 42%", overflow: "hidden", textOverflow: "ellipsis" }} title={c.city}>
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
              <h2>Последние визиты</h2>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>Страница</th>
                      <th>Referrer</th>
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
                          {(e.path || "").slice(0, 48)}
                          {(e.path || "").length > 48 ? "…" : ""}
                        </td>
                        <td className="mono" title={e.referrer || ""}>
                          {(e.referrer || "—").slice(0, 28)}
                        </td>
                        <td className="mono">{e.ip || "—"}</td>
                        <td>
                          {[e.city, e.region, e.country].filter(Boolean).join(", ") || "—"}
                          {e.ll_lat != null && e.ll_lon != null ? (
                            <div className="mono" style={{ color: "var(--muted)", marginTop: 2 }}>
                              {Number(e.ll_lat).toFixed(2)}, {Number(e.ll_lon).toFixed(2)}
                            </div>
                          ) : null}
                        </td>
                        <td>{e.device_type || "—"}</td>
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
      </div>
    </>
  );
}
