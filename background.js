/* global chrome */
(function initBrowserCompat() {
  // Firefox uses `browser`, Chrome uses `chrome`.
  // This simple shim avoids needing a build step right now.
  if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
    globalThis.browser = globalThis.chrome;
  }
})();

// Cache configuration
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 8000; // 8 seconds

async function handleLookup(message) {
  if (!message || message.type !== "TB_LOOKUP") return;

  const { isbn, title, author } = message.payload || {};
  // For now, prefer ISBN. Fall back to title/author later if you choose.
  const query = normalizeIsbn(isbn) || buildFallbackQuery(title, author);
  if (!query) return { ok: false, reason: "no_query" };

  const url = thriftbooksSearchUrl(query);
  const queryType = normalizeIsbn(isbn) ? "isbn" : "text";

  // Base response (link-only mode)
  const response = { ok: true, url, queryType };

  // Check if we have permission to fetch prices
  const hasPermission = await checkThriftBooksPermission();
  if (!hasPermission) {
    // Permission denied - return link-only mode with flag
    return { ...response, permissionDenied: true };
  }

  // Check cache first
  const cached = await getCachedPrice(query);
  if (cached) {
    return { ...response, price: cached.price, currency: cached.currency, cached: true };
  }

  // Fetch live price
  try {
    const priceData = await fetchThriftBooksPrice(url, query);
    if (priceData) {
      // Cache the result
      await cachePrice(query, priceData);
      return { ...response, ...priceData };
    }
  } catch (err) {
    console.warn("ThriftBooks price fetch failed:", err);
    // Return link-only on error
  }

  return response;
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

// Cache management
async function getCachedPrice(query) {
  try {
    const key = `price_${query}`;
    const result = await browser.storage.local.get(key);
    if (!result[key]) return null;

    const cached = result[key];
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_DURATION_MS) {
      // Expired, remove it
      await browser.storage.local.remove(key);
      return null;
    }

    return cached;
  } catch (err) {
    console.warn("Cache read failed:", err);
    return null;
  }
}

async function cachePrice(query, priceData) {
  try {
    const key = `price_${query}`;
    await browser.storage.local.set({
      [key]: {
        ...priceData,
        timestamp: Date.now()
      }
    });
  } catch (err) {
    console.warn("Cache write failed:", err);
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
    return parseThriftBooksPrice(html, isbn);
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("ThriftBooks fetch timed out");
    } else {
      console.warn("ThriftBooks fetch error:", err);
    }
    return null;
  }
}

function parseThriftBooksPrice(html, isbn) {
  // ThriftBooks search results have a specific structure
  // We're looking for the first book listing that matches our ISBN

  // Strategy 1: Look for ISBN in data attributes or nearby text
  // Strategy 2: Extract the first price from search results (assuming first result is best match)

  // Common price pattern: $X.XX or $XX.XX
  const priceRegex = /\$(\d+\.\d{2})/g;

  // Try to find book cards/listings
  // ThriftBooks uses class names like "SearchResults-item" or similar
  // Since HTML structure can change, we'll use a robust regex approach

  // Look for ISBN nearby price (within 500 chars)
  const isbnNormalized = isbn.replace(/[^0-9X]/gi, "");
  const isbnPattern = new RegExp(`${isbnNormalized}.{0,500}?\\$(\\d+\\.\\d{2})`, "i");
  const reversePattern = new RegExp(`\\$(\\d+\\.\\d{2}).{0,500}?${isbnNormalized}`, "i");

  let match = html.match(isbnPattern) || html.match(reversePattern);

  if (match && match[1]) {
    return {
      price: parseFloat(match[1]),
      currency: "USD",
      found: true
    };
  }

  // Fallback: Just get the first price from the page (less reliable)
  // Only use if we're on a search results page (has "SearchResults" or "results" in HTML)
  if (/search.*results|results.*search/i.test(html)) {
    const firstPrice = html.match(priceRegex);
    if (firstPrice && firstPrice[0]) {
      const price = parseFloat(firstPrice[0].replace("$", ""));
      // Sanity check: book prices are typically $1-$100
      if (price >= 1 && price <= 100) {
        return {
          price,
          currency: "USD",
          found: true,
          confidence: "low" // Mark as low confidence
        };
      }
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
