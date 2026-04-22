/**
 * Проверка HTML страницы: подключён ли наш tracker.js и верный ли data-site.
 */

export function normalizeSiteUrl(raw) {
  let u = String(raw ?? "").trim();
  if (!u) return null;
  if (u.startsWith("//")) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * @param {string} pageUrl — полный URL страницы для GET
 * @param {string} trackingKey — ключ из панели (без дефисов)
 * @returns {Promise<{ ok: boolean, message?: string, error?: string, urlChecked: string }>}
 */
export async function verifyOurTrackerInstalled(pageUrl, trackingKey) {
  const url = normalizeSiteUrl(pageUrl);
  if (!url) {
    return {
      ok: false,
      error: "Некорректный или пустой URL сайта.",
      urlChecked: String(pageUrl || "").trim(),
    };
  }
  const key = String(trackingKey || "").trim();
  if (!key) {
    return { ok: false, error: "Нет ключа счётчика.", urlChecked: url };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; MetrikInstallCheck/1.0; +https://github.com/randee-ru/metrik)",
      },
    });

    const buf = await res.arrayBuffer();
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf).slice(0, 2_000_000);

    if (!res.ok) {
      return {
        ok: false,
        error: `Сайт ответил кодом ${res.status}. Установите счётчик или проверьте URL.`,
        urlChecked: url,
      };
    }

    const hasTracker = /tracker\.js/i.test(text);
    if (!hasTracker) {
      return {
        ok: false,
        error:
          "В HTML этой страницы не найдено подключение tracker.js. Укажите URL страницы, где есть счётчик (часто главная).",
        urlChecked: url,
      };
    }

    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dataSiteRe = new RegExp(`data-site\\s*=\\s*["']?${esc}["']?`, "i");
    if (!dataSiteRe.test(text)) {
      return {
        ok: false,
        error:
          "Найден tracker.js, но не найден атрибут data-site с ключом этого проекта — проверьте, что вставлен актуальный код из панели.",
        urlChecked: url,
      };
    }

    return {
      ok: true,
      message: "Счётчик установлен: найдены tracker.js и верный data-site.",
      urlChecked: url,
    };
  } catch (e) {
    const name = e && e.name;
    const msg =
      name === "AbortError"
        ? "Таймаут 12 с: сайт не ответил или ответ слишком долгий."
        : e.message || String(e);
    return { ok: false, error: msg, urlChecked: url };
  } finally {
    clearTimeout(timer);
  }
}
