(function () {
  var sc = document.currentScript;
  if (!sc || !sc.getAttribute("data-site")) return;
  var site = sc.getAttribute("data-site").trim();
  var base = sc.src.replace(/\/tracker\.js(\?.*)?$/, "");

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
