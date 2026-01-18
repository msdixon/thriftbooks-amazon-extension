# v0.1 Packaging & Testing Checklist

## Pre-flight Check

- [ ] All files committed to git
- [ ] Version number updated in `manifest.json`
- [ ] README reflects current feature set
- [ ] No debug `console.log()` statements in production code

## Chrome Packaging

### Load Unpacked (Development)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `thrift-on-amazon` directory
5. Note the extension ID (for debugging)

### Create .crx Package (Distribution)

1. Navigate to `chrome://extensions/`
2. Click **Pack extension**
3. Select extension root directory
4. Optional: Provide private key (for updates)
5. Chrome creates:
   - `thrift-on-amazon.crx` (installable)
   - `thrift-on-amazon.pem` (private key - **keep secure!**)

**Note**: For Chrome Web Store distribution, use the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) instead of .crx packaging.

## Firefox Packaging

### Load Temporary (Development)

1. Open Firefox → `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Navigate to the extension directory
4. Select `manifest.json`
5. Extension loads until Firefox restart

**Tip**: Use [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) for auto-reload:
```bash
npm install -g web-ext
web-ext run
```

### Create .xpi Package (Distribution)

#### Option 1: web-ext CLI
```bash
cd thrift-on-amazon
web-ext build
# Creates: web-ext-artifacts/thrift_books_link_on_amazon-0.1.0.zip
```

#### Option 2: Manual ZIP
```bash
cd thrift-on-amazon
zip -r ../thrift-on-amazon-0.1.0.zip . -x "*.git*" -x "*.DS_Store"
mv ../thrift-on-amazon-0.1.0.zip ../thrift-on-amazon-0.1.0.xpi
```

**Note**: For AMO (addons.mozilla.org) distribution, you must:
1. Submit the .xpi to [AMO Developer Hub](https://addons.mozilla.org/developers/)
2. Mozilla will sign it (required for non-temporary installation)
3. Choose: Listed (public) or Unlisted (self-distribution)

## Testing Matrix

### Amazon Page Layouts

| Test Case | URL Pattern | Expected Behavior |
|-----------|-------------|-------------------|
| **Standard book** | `/dp/<ASIN>` | ISBN extracted, link injected |
| **Kindle edition** | `/dp/<ASIN>` (Kindle) | May not have ISBN (graceful no-op) |
| **Textbook** | `/dp/<ASIN>` | ISBN-13 preferred, fallback to ISBN-10 |
| **Used listing** | `/gp/offer-listing/` | ISBN from product details |
| **Non-book** | `/dp/<ASIN>` (electronics) | No ISBN, no injection |

### Cross-Browser Compatibility

| Test | Chrome | Firefox | Notes |
|------|--------|---------|-------|
| **Background loads** | ✓ Service worker | ✓ Document script | Check console for errors |
| **ISBN extraction** | ✓ | ✓ | Test JSON-LD and DOM fallback |
| **Link injection** | ✓ | ✓ | Verify position near buybox |
| **Message passing** | ✓ | ✓ | Content ↔ Background |
| **Browser API shim** | ✓ | ✓ | `chrome.*` vs `browser.*` |

### Manual Test Script

1. **Install extension** (see above)
2. **Navigate to test book**:
   - Example: https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882
3. **Verify ISBN detection**:
   - Open DevTools → Console
   - Look for ThriftBooks link in buy box area
   - Check injected ISBN matches Amazon's listed ISBN
4. **Click ThriftBooks link**:
   - Opens in new tab
   - URL contains `b.search=<ISBN>`
   - ThriftBooks search results load
5. **Test edge cases**:
   - No ISBN on page → no link injected
   - Multiple formats → correct ISBN chosen
   - SPA navigation → no duplicate links

## Debugging

### Chrome DevTools

- **Background script**: `chrome://extensions/` → Click "service worker" link
- **Content script**: F12 on Amazon page → Console/Sources tabs
- **Message logs**: Add `console.log()` in `background.js` and `content_script.js`

### Firefox DevTools

- **Background script**: `about:debugging` → Inspect (under extension)
- **Content script**: F12 on Amazon page → Console/Sources tabs
- **Extension logs**: `about:debugging` → This Firefox → Inspect

### Common Issues

| Issue | Chrome | Firefox | Fix |
|-------|--------|---------|-----|
| "browser is not defined" | ✓ | N/A | Check browser shim in `background.js:1-7` |
| Service worker not loading | ✓ | N/A | Verify `manifest.json` → `background.service_worker` |
| Background script not loading | N/A | ✓ | Verify `manifest.json` → `background.scripts` |
| ISBN not detected | ✓ | ✓ | Check console for errors, verify Amazon page structure |
| Link not injecting | ✓ | ✓ | Inspect DOM for `.tb-box`, check CSS load |

## Performance Checks

- [ ] Extension loads in <100ms
- [ ] ISBN extraction runs in <50ms
- [ ] No memory leaks on repeated navigation
- [ ] No console errors/warnings
- [ ] Minimal DOM impact (single div injection)

## Security Checks

- [ ] XSS prevention: `escapeHtml()` used for all injected content
- [ ] CSP compliance: No inline scripts
- [ ] HTTPS only for ThriftBooks links
- [ ] `rel="noopener noreferrer"` on external links
- [ ] No sensitive data in messages

## Pre-release Checklist

- [ ] All tests pass (Chrome + Firefox)
- [ ] No console errors in production
- [ ] README updated
- [ ] CHANGELOG.md created (if doing versioned releases)
- [ ] Git tag created: `git tag v0.1.0`
- [ ] Extension packaged (.crx for Chrome, .xpi for Firefox)
- [ ] Test install on clean browser profile

## Distribution

### Self-hosting (Unlisted)
- Provide `.crx` (Chrome) or signed `.xpi` (Firefox) for direct download
- Host on your website with installation instructions

### Chrome Web Store
1. Create developer account ($5 one-time fee)
2. Upload ZIP in [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Fill in store listing (description, screenshots, privacy policy)
4. Submit for review (~1-3 days)

### Firefox AMO
1. Create AMO account (free)
2. Submit `.xpi` to [Developer Hub](https://addons.mozilla.org/developers/)
3. Choose listed or unlisted
4. Fill in listing details
5. Mozilla review (~1-10 days for listed, instant signing for unlisted)

## Post-release Monitoring

- [ ] Monitor user reviews (Chrome Web Store / AMO)
- [ ] Check error reports in browser consoles
- [ ] Watch for Amazon DOM changes (may break ISBN extraction)
- [ ] Track ThriftBooks URL format changes

---

**Version**: 0.1.0
**Last Updated**: 2026-01-17
