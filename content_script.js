/* global chrome */
(function initBrowserCompat() {
  // Firefox uses `browser`, Chrome uses `chrome`.
  // This simple shim avoids needing a build step right now.
  if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
    globalThis.browser = globalThis.chrome;
  }
})();

(async function main() {
  // Avoid double-injection on SPA-like navigations
  if (document.documentElement.dataset.tbInjected === "1") return;
  document.documentElement.dataset.tbInjected = "1";

  const isbn = findIsbnOnPage();
  if (!isbn) return;

  // Inject loading state immediately
  const container = injectLoadingState(isbn);
  if (!container) return;

  // Fetch data from background
  const resp = await browser.runtime.sendMessage({
    type: "TB_LOOKUP",
    payload: { isbn }
  });

  if (!resp || !resp.ok || !resp.url) {
    // Remove loading state if fetch failed
    container.remove();
    return;
  }

  // Update UI with result
  updateThriftbooksLink(container, resp, isbn);
})();

function findIsbnOnPage() {
  // Strategy 1: JSON-LD (if present)
  const isbnFromLd = findIsbnInJsonLd();
  if (isbnFromLd) return isbnFromLd;

  // Strategy 2: Product details text scan (robust to layout changes)
  const containers = [
    document.querySelector("#detailBullets_feature_div"),
    document.querySelector("#productDetails_feature_div"),
    document.querySelector("#prodDetails"),
    document.body
  ].filter(Boolean);

  for (const el of containers) {
    const text = el.innerText || "";
    const isbn = extractIsbn(text);
    if (isbn) return isbn;
  }

  return "";
}

function findIsbnInJsonLd() {
  const nodes = document.querySelectorAll('script[type="application/ld+json"]');
  for (const n of nodes) {
    const raw = n.textContent?.trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const found = deepFindIsbn(data);
      if (found) return found;
    } catch {
      // ignore
    }
  }
  return "";
}

function deepFindIsbn(obj) {
  if (!obj) return "";
  if (Array.isArray(obj)) {
    for (const x of obj) {
      const r = deepFindIsbn(x);
      if (r) return r;
    }
    return "";
  }
  if (typeof obj === "object") {
    // Common keys: isbn, isbn13, isbn10
    for (const k of ["isbn", "isbn13", "isbn10"]) {
      const v = obj[k];
      const r = extractIsbn(String(v || ""));
      if (r) return r;
    }
    for (const v of Object.values(obj)) {
      const r = deepFindIsbn(v);
      if (r) return r;
    }
  }
  return "";
}

function extractIsbn(text) {
  if (!text) return "";

  // Prefer ISBN-13 if both exist
  const isbn13 = text.match(/ISBN-13\s*[:\)]?\s*([0-9][0-9\-\s]{11,}[0-9])/i);
  if (isbn13) {
    const cleaned = isbn13[1].replace(/[^0-9]/g, "");
    if (/^\d{13}$/.test(cleaned)) return cleaned;
  }

  const isbn10 = text.match(/ISBN-10\s*[:\)]?\s*([0-9X][0-9X\-\s]{8,}[0-9X])/i);
  if (isbn10) {
    const cleaned = isbn10[1].toUpperCase().replace(/[^0-9X]/g, "");
    if (/^\d{9}[\dX]$/.test(cleaned)) return cleaned;
  }

  // Fallback: any 13-digit sequence that often shows up as ISBN
  const any13 = text.match(/\b97[89][0-9]{10}\b/);
  if (any13) return any13[0];

  return "";
}

function injectLoadingState(isbn) {
  const anchorTarget =
    document.querySelector("#buybox") ||
    document.querySelector("#rightCol") ||
    document.querySelector("#centerCol") ||
    document.body;

  const box = document.createElement("div");
  box.className = "tb-box tb-loading";
  box.innerHTML = `
    <div class="tb-row">
      <div class="tb-header">
        <span class="tb-spinner"></span>
        <span class="tb-link-text">Checking ThriftBooks...</span>
      </div>
      <div class="tb-sub">ISBN: ${escapeHtml(isbn)}</div>
    </div>
  `;

  anchorTarget.prepend(box);
  return box;
}

function updateThriftbooksLink(container, resp, isbn) {
  const { url, price, currency, cached, confidence } = resp;

  // Build price display
  let priceHtml = "";
  if (price !== undefined) {
    const priceText = `${currency || "$"}${price.toFixed(2)}`;
    const cacheIndicator = cached ? ' <span class="tb-cached">(cached)</span>' : "";
    const confidenceWarning = confidence === "low" ? ' <span class="tb-low-conf">~</span>' : "";
    priceHtml = `<div class="tb-price">${priceText}${confidenceWarning}${cacheIndicator}</div>`;
  }

  // Update container
  container.className = "tb-box";
  container.innerHTML = `
    <div class="tb-row">
      <div class="tb-header">
        <a class="tb-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
          Find on ThriftBooks
        </a>
        ${priceHtml}
      </div>
      <div class="tb-sub">
        ISBN: ${escapeHtml(isbn)}
        ${price === undefined ? " • Price not available" : ""}
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
