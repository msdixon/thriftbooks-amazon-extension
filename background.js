/* global chrome */
(function initBrowserCompat() {
  // Firefox uses `browser`, Chrome uses `chrome`.
  // This simple shim avoids needing a build step right now.
  if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
    globalThis.browser = globalThis.chrome;
  }
})();

// Configuration
const FETCH_TIMEOUT_MS = 8000; // 8 seconds

async function handleLookup(message) {
  if (!message || message.type !== "TB_LOOKUP") return;

  const { isbn, title, author } = message.payload || {};
  // For now, prefer ISBN. Fall back to title/author later if you choose.
  const query = normalizeIsbn(isbn) || buildFallbackQuery(title, author);
  if (!query) return { ok: false, reason: "no_query" };

  const queryType = normalizeIsbn(isbn) ? "isbn" : "text";

  const links = [
    await buildThriftBooksLink(query),
    { id: "worldofbooks", name: "World of Books", url: worldofbooksSearchUrl(query) },
    { id: "bookshop", name: "Bookshop.org", url: bookshopSearchUrl(query) }
  ];

  return { ok: true, queryType, links };
}

async function buildThriftBooksLink(query) {
  const url = thriftbooksSearchUrl(query);
  const link = { id: "thriftbooks", name: "ThriftBooks", url };

  // Check if we have permission to fetch prices
  const hasPermission = await checkThriftBooksPermission();
  if (!hasPermission) {
    return { ...link, permissionDenied: true };
  }

  // Fetch live price
  try {
    const priceData = await fetchThriftBooksPrice(url, query);
    if (priceData) {
      return { ...link, ...priceData };
    }
  } catch (err) {
    console.warn("ThriftBooks price fetch failed:", err);
    // Return link-only on error
  }

  return link;
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

function worldofbooksSearchUrl(query) {
  const base = "https://www.worldofbooks.com/en-gb/search";
  const url = new URL(base);
  url.searchParams.set("q", query);
  return url.toString();
}

function bookshopSearchUrl(query) {
  const base = "https://bookshop.org/search";
  const url = new URL(base);
  url.searchParams.set("keywords", query);
  return url.toString();
}

// Permission management
async function checkThriftBooksPermission() {
  try {
    return await browser.permissions.contains({
      origins: ["*://*.thriftbooks.com/*"]
    });
  } catch (err) {
    console.warn("Permission check failed:", err);
    return false;
  }
}

async function requestThriftBooksPermission() {
  try {
    return await browser.permissions.request({
      origins: ["*://*.thriftbooks.com/*"]
    });
  } catch (err) {
    console.warn("Permission request failed:", err);
    return false;
  }
}

// ThriftBooks price fetching
async function fetchThriftBooksPrice(searchUrl, isbn) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ThriftBooks Link Extension)"
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("ThriftBooks fetch failed:", response.status);
      return null;
    }

    const html = await response.text();
    return parseThriftBooksPrice(html, isbn, searchUrl);
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("ThriftBooks fetch timed out");
    } else {
      console.warn("ThriftBooks fetch error:", err);
    }
    return null;
  }
}

function parseThriftBooksPrice(html, isbn, url) {
  // ThriftBooks search/browse pages have prices we can extract
  // Strategy 1: Exact ISBN match (highest confidence)
  // Strategy 2: Work-level "from" price (multiple editions available)
  // Strategy 3: vpitem global variable (if redirected to work page)

  const isbnNormalized = isbn.replace(/[^0-9X]/gi, "");

  // Strategy 1: Look for exact ISBN nearby price (within 500 chars)
  const isbnPattern = new RegExp(`${isbnNormalized}.{0,500}?\\$(\\d+\\.\\d{2})`, "i");
  const reversePattern = new RegExp(`\\$(\\d+\\.\\d{2}).{0,500}?${isbnNormalized}`, "i");

  let match = html.match(isbnPattern) || html.match(reversePattern);

  if (match && match[1]) {
    return {
      price: parseFloat(match[1]),
      currency: "USD",
      priceType: "exact"
    };
  }

  // Strategy 2: Extract work-level "from" price
  // Pattern: "See All X Editions from $XX.XX" or "from $XX.XX"
  const fromPricePattern = /(?:editions?\s+)?from\s+\$(\d+\.\d{2})/i;
  const fromMatch = html.match(fromPricePattern);

  if (fromMatch && fromMatch[1]) {
    return {
      price: parseFloat(fromMatch[1]),
      currency: "USD",
      priceType: "from"
    };
  }

  // Strategy 3: Extract vpitem.price from embedded JSON
  // ThriftBooks embeds this on work pages when ISBN redirects
  const vpitemPattern = /"price":\s*(\d+\.\d{2})/;
  const vpitemMatch = html.match(vpitemPattern);

  if (vpitemMatch && vpitemMatch[1]) {
    const price = parseFloat(vpitemMatch[1]);
    // Sanity check: book prices are typically $1-$100
    if (price >= 1 && price <= 100) {
      return {
        price,
        currency: "USD",
        priceType: "from"
      };
    }
  }

  return null;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Support both promise and callback styles.
  Promise.resolve(handleLookup(message))
    .then((resp) => sendResponse(resp))
    .catch((err) => sendResponse({ ok: false, reason: "error", error: String(err) }));
  return true;
});
