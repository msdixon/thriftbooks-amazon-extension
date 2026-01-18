/* global chrome */
(function initBrowserCompat() {
  // Firefox uses `browser`, Chrome uses `chrome`.
  // This simple shim avoids needing a build step right now.
  if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
    globalThis.browser = globalThis.chrome;
  }
})();

async function handleLookup(message) {
  if (!message || message.type !== "TB_LOOKUP") return;

  const { isbn, title, author } = message.payload || {};
  // For now, prefer ISBN. Fall back to title/author later if you choose.
  const query = normalizeIsbn(isbn) || buildFallbackQuery(title, author);
  if (!query) return { ok: false, reason: "no_query" };

  // Lazy-load provider function so we can evolve structure.
  // NOTE: If you later switch to ES modules in background, set background.type="module".
  const url = thriftbooksSearchUrl(query);

  return { ok: true, url, queryType: normalizeIsbn(isbn) ? "isbn" : "text" };
}

function normalizeIsbn(isbn) {
  if (!isbn) return "";
  const cleaned = String(isbn).toUpperCase().replace(/[^0-9X]/g, "");
  // Accept ISBN-10 (10 chars) or ISBN-13 (13 digits)
  if (/^\d{13}$/.test(cleaned)) return cleaned;
  if (/^\d{9}[\dX]$/.test(cleaned)) return cleaned;
  return "";
}

function buildFallbackQuery(title, author) {
  const t = (title || "").trim();
  const a = (author || "").trim();
  if (!t) return "";
  return a ? `${t} ${a}` : t;
}

// Provider import without bundling: copy/paste the function for now.
// If you prefer a bundler later, you can do proper imports.
function thriftbooksSearchUrl(query) {
  const base = "https://www.thriftbooks.com/browse/";
  const url = new URL(base);
  url.searchParams.set("b.search", query);
  return url.toString();
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Support both promise and callback styles.
  Promise.resolve(handleLookup(message))
    .then((resp) => sendResponse(resp))
    .catch((err) => sendResponse({ ok: false, reason: "error", error: String(err) }));
  return true;
});
