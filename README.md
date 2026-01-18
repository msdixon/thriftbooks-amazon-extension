# ThriftBooks Link on Amazon

A cross-browser extension (Chrome + Firefox) that adds ThriftBooks search links to Amazon book pages when an ISBN is detected.

## Features

- **Cross-browser compatible**: Works on both Chrome and Firefox with a single codebase
- **Smart ISBN detection**: Extracts ISBN-10 or ISBN-13 from Amazon product pages via JSON-LD and DOM parsing
- **Clean UI injection**: Adds a subtle ThriftBooks link near the buy box
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
   - Sends lookup request to background
   - Injects ThriftBooks link UI

2. **background.js** (Chrome SW / Firefox doc-script)
   - Browser compatibility shim (`browser` API normalization)
   - ISBN normalization and validation
   - ThriftBooks URL generation
   - Message handling between content script and background

3. **providers/thriftbooks.js** (provider module)
   - ThriftBooks search URL builder
   - Structured for easy addition of more providers later

4. **ui/injected.css** (styling)
   - Amazon-matched styling for seamless integration

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

## Future Enhancements

### Phase 1: Price Comparison
- Fetch actual ThriftBooks prices (requires `optional_permissions` for cross-origin)
- Display lowest price inline on Amazon page
- Add confidence indicators (shipping, condition)

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
