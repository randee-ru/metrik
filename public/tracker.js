/**
 * Счётчик посещений: просмотр при загрузке страницы.
 * Подключение: <script async src="…/tracker.js" data-site="КЛЮЧ"></script>
 * Отправляет path, title, referrer, UTM, экран, язык, visitor_id и session_id (localStorage).
 */
(function () {
  var sc = document.currentScript;
  if (!sc || !sc.getAttribute("data-site")) return;
  var site = sc.getAttribute("data-site").trim();
  var base = sc.src.replace(/\/tracker\.js(\?.*)?$/, "");
  var LS_V = "metrik_vid_" + site;
  var LS_S = "metrik_sid_" + site;
  var LS_ST = "metrik_st_" + site;
  var SESSION_MS = 30 * 60 * 1000;

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getVisitorId() {
    try {
      var v = localStorage.getItem(LS_V);
      if (!v) {
        v = uuid();
        localStorage.setItem(LS_V, v);
      }
      return v;
    } catch (e) {
      return null;
    }
  }

  function getSessionId() {
    try {
      var now = Date.now();
      var raw = localStorage.getItem(LS_S);
      var t0 = parseInt(localStorage.getItem(LS_ST) || "0", 10);
      if (!raw || !t0 || now - t0 > SESSION_MS) {
        raw = uuid();
        localStorage.setItem(LS_S, raw);
        localStorage.setItem(LS_ST, String(now));
      } else {
        localStorage.setItem(LS_ST, String(now));
      }
      return raw;
    } catch (e) {
      return null;
    }
  }

  function params() {
    var q = {};
    var s = window.location.search;
    if (!s || s.length < 2) return q;
    s.slice(1).split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      var k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      var v = decodeURIComponent(i < 0 ? "" : pair.slice(i + 1));
      if (k) q[k] = v;
    });
    return q;
  }

  function pickUtm(q) {
    return {
      utm_source: q.utm_source || null,
      utm_medium: q.utm_medium || null,
      utm_campaign: q.utm_campaign || null,
      utm_term: q.utm_term || null,
      utm_content: q.utm_content || null,
    };
  }

  function send() {
    var q = params();
    var utm = pickUtm(q);
    var payload = {
      site: site,
      path: window.location.pathname + window.location.search + window.location.hash,
      title: document.title || null,
      referrer: document.referrer || "",
      user_agent: navigator.userAgent || "",
      screen_w: window.screen && window.screen.width,
      screen_h: window.screen && window.screen.height,
      lang: navigator.language || navigator.userLanguage || null,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
    };
    Object.assign(payload, utm);
    var body = JSON.stringify(payload);
    var url = base + "/collect";

    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      mode: "cors",
      keepalive: true,
    }).catch(function () {});
  }

  if (document.readyState === "complete") send();
  else window.addEventListener("load", send);
})();
