# ThriftBooks Link on Amazon

A cross-browser extension (Chrome + Firefox) that adds ThriftBooks search links to Amazon book pages when an ISBN is detected.

## Features

- **Cross-browser compatible**: Works on both Chrome and Firefox with a single codebase
- **Smart ISBN detection**: Extracts ISBN-10 or ISBN-13 from Amazon product pages via JSON-LD and DOM parsing
- **Live price fetching**: Displays current ThriftBooks prices inline on Amazon pages (opt-in)
- **Intelligent caching**: 24-hour cache to minimize network requests and improve performance
- **Clean UI injection**: Adds a subtle ThriftBooks link with price near the buy box
- **Permission-aware**: Optional ThriftBooks access - works in link-only mode if permission denied
- **US-only for now**: Targets `amazon.com` (expandable to worldwide marketplaces)
- **No build step required**: Pure JavaScript, no bundler needed

## Architecture

### Manifest V3 Cross-Browser Strategy

The extension uses a clever manifest configuration that works on both Chrome and Firefox:

```json
"background": {
  "service_worker": "background.js",
  "scripts": ["background.js"]
}
```

- **Chrome MV3**: Uses `service_worker` for background processing
- **Firefox MV3**: Falls back to `scripts` (document-style event pages) since Firefox doesn't yet support background service workers

### Components

1. **content_script.js** (runs on Amazon pages)
   - Extracts ISBN from Amazon's DOM/JSON-LD
   - Shows loading state while fetching
   - Sends lookup request to background
   - Displays price and link in Amazon UI

2. **background.js** (Chrome SW / Firefox doc-script)
   - Browser compatibility shim (`browser` API normalization)
   - Permission management (optional ThriftBooks access)
   - Price caching (chrome.storage.local, 24-hour TTL)
   - ThriftBooks HTML fetching and parsing
   - ISBN normalization and validation
   - Message handling between content script and background

3. **providers/thriftbooks.js** (provider module)
   - ThriftBooks search URL builder
   - Structured for easy addition of more providers later

4. **ui/injected.css** (styling)
   - Amazon-matched color palette
   - Loading spinner animation
   - Price display with cached/confidence indicators

## Installation

### Chrome (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `thrift-on-amazon` directory
5. The extension should now appear in your extensions list

### Firefox (Temporary Add-on)

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Navigate to the `thrift-on-amazon` directory
4. Select `manifest.json`
5. The extension will be loaded until you restart Firefox

**Note**: For permanent installation in Firefox, you need to sign the extension through [addons.mozilla.org](https://addons.mozilla.org).

## How Price Fetching Works

### Permission Flow

1. **First use**: When you load an Amazon book page, the extension requests optional permission to access ThriftBooks.com
2. **User choice**:
   - **Grant**: Extension fetches live prices and shows them inline
   - **Deny**: Extension works in link-only mode (no prices, just the search link)
3. **Subsequent uses**: Permission is remembered, no additional prompts

### Price Fetching Process

When permission is granted:

1. **Loading state** (immediate): Shows spinner with "Checking ThriftBooks..."
2. **Cache check** (< 1ms): Looks for cached price from last 24 hours
3. **Live fetch** (if not cached, ~2-5 seconds):
   - Fetches ThriftBooks search results page
   - Parses HTML for ISBN match and price
   - Uses proximity matching (ISBN near price in HTML)
   - 8-second timeout with graceful fallback
4. **Display**:
   - **Price found**: Shows `$X.XX` with optional indicators
   - **Cached**: Shows `(cached)` label
   - **Low confidence**: Shows `~` symbol (fallback to first result)
   - **Not found**: Shows "Price not available"

### Caching Strategy

- **Duration**: 24 hours
- **Storage**: `chrome.storage.local` (per-ISBN key)
- **Invalidation**: Automatic expiry after 24 hours
- **Benefits**:
  - Instant price display on repeat visits
  - Reduced network load on ThriftBooks
  - Works offline (if previously cached)

### Privacy & Performance

- **Opt-in**: ThriftBooks access is optional, not required
- **No tracking**: No analytics, no user data collection
- **Minimal data**: Only fetches ThriftBooks search results, no cookies
- **Timeout protection**: 8-second max fetch time
- **Graceful degradation**: Link-only mode if fetch fails

## Testing

### Test Plan

Test on various Amazon book page layouts:

1. **Standard hardcover/paperback** (e.g., popular fiction)
   - Navigate to: https://www.amazon.com/dp/0735219095
   - Verify: ISBN extracted, ThriftBooks link appears

2. **Textbook with multiple formats** (e.g., technical book)
   - Navigate to: https://www.amazon.com/dp/0134685997
   - Verify: Handles multiple ISBNs, picks primary

3. **Used/old listing** (minimal product details)
   - Find a used book with sparse details
   - Verify: Fallback ISBN extraction works

4. **Non-book product** (e.g., electronics)
   - Navigate to any non-book product
   - Verify: No link injected (graceful no-op)

5. **Page navigation** (SPA-style updates)
   - Browse from one book to another
   - Verify: No duplicate links, proper cleanup

### Expected Behavior

- ✅ Link appears near the buy box (`#buybox`, `#rightCol`, or `#centerCol`)
- ✅ Opens ThriftBooks search in a new tab
- ✅ Shows detected ISBN in small text below link
- ✅ Styled to match Amazon's UI (subtle, non-intrusive)

## Development

### Project Structure

```
thrift-on-amazon/
├── manifest.json          # MV3 manifest (Chrome + Firefox)
├── background.js          # Background service worker / script
├── content_script.js      # Content script (Amazon page injection)
├── providers/
│   └── thriftbooks.js     # ThriftBooks provider module
└── ui/
    └── injected.css       # Injected UI styling
```

### Key Design Decisions

**Why inline the provider in background.js?**
- Avoids bundler complexity for v0.1
- Easy to refactor to ES modules later with `"type": "module"`

**Why both JSON-LD and DOM text parsing?**
- Amazon's product pages vary by category and A/B tests
- JSON-LD is reliable when present, DOM text is fallback

**Why prefer ISBN-13 over ISBN-10?**
- ISBN-13 is the modern standard and more globally unique
- Falls back to ISBN-10 if only that is available

**Why optional_host_permissions for ThriftBooks?**
- Better privacy: users opt-in to cross-origin requests
- Graceful degradation: link-only mode works without permission
- Firefox handles optional permissions more smoothly than required

**Why regex-based HTML parsing instead of DOM parsing?**
- ThriftBooks search results structure can change
- Regex with proximity matching is more resilient than CSS selectors
- Avoids needing a full HTML parser in background script

**Why 24-hour cache instead of real-time pricing?**
- Book prices change slowly (typically weeks/months)
- Reduces load on ThriftBooks servers
- Improves user experience (instant display on repeat visits)
- Still fresh enough for price comparison decisions

## Future Enhancements

### Phase 1: Price Comparison ✅ **COMPLETED**
- ✅ Fetch actual ThriftBooks prices
- ✅ Display inline on Amazon page with loading states
- ✅ Confidence indicators (low-confidence warnings)
- 🔲 Future: Add shipping cost and condition details

### Phase 2: Worldwide Support
- Add `markets.json` mapping:
  - `amazon.co.uk` → World of Books, AbeBooks UK
  - `amazon.de` → AbeBooks DE, Medimops
  - `amazon.ca` → ThriftBooks (ships to Canada)
- Locale-aware currency formatting
- Provider selection based on detected region

### Phase 3: Better Matching
- "Match found" verification (requires network check)
- Inline preview of ThriftBooks listing
- Multi-provider comparison table

### Phase 4: Firefox Specific
- Optional: Move to background service worker when Firefox MV3 adds support
- For now: Document-style background works perfectly

## Assumptions

**Assumption A**: Most Amazon US book pages expose ISBN-10 or ISBN-13 in:
- Structured data (`<script type="application/ld+json">`)
- Product details sections (`#detailBullets_feature_div`, `#productDetails_feature_div`)

**Assumption B**: ThriftBooks search URL format is:
- `https://www.thriftbooks.com/browse/?b.search=<query>`
- Supports ISBN-13, ISBN-10, and title/author text queries

## License

MIT (or specify your preferred license)

## Contributing

Contributions welcome! Please:
1. Test on both Chrome and Firefox
2. Maintain cross-browser compatibility
3. Add test cases for new Amazon page layouts
4. Document any new assumptions

## Support

For issues or feature requests, please open an issue on GitHub.
