# Testing Guide

## Quick Start: Load Extension in Chrome

### Step 1: Open Chrome Extensions Page
1. Open Chrome
2. Navigate to: `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)

### Step 2: Load the Extension
1. Click **"Load unpacked"**
2. Navigate to: `/Users/alexandervyhmeister/GitHub/thrift-on-amazon`
3. Select the folder and click **"Open"**

### Step 3: Verify Installation
You should see:
```
ThriftBooks Link on Amazon
Version 0.2.0
ID: [some random ID]
```

### Step 4: Test on Amazon
1. Navigate to: https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882
2. You should see a ThriftBooks box appear with:
   - Loading spinner (briefly)
   - ISBN detected: 9780132350884
   - Permission prompt (first time only)
   - Price after ~2-5 seconds (if permission granted)

## Expected Behavior

### First Visit (Permission Request)
```
[Spinner] Checking ThriftBooks...
ISBN: 9780132350884
```

**Permission Prompt:**
> ThriftBooks Link on Amazon wants to:
> - Read and change your data on thriftbooks.com

**Click "Allow"** to enable price fetching.

### After Permission Granted
```
Find on ThriftBooks          $12.49
ISBN: 9780132350884
```

### Subsequent Visits (Cached)
```
Find on ThriftBooks          $12.49 (cached)
ISBN: 9780132350884
```

### If Permission Denied
```
Find on ThriftBooks          [no price]
ISBN: 9780132350884 • Price not available
```

## Debugging

### Check Extension Status
1. Go to `chrome://extensions/`
2. Verify extension is **Enabled**
3. Click **"service worker"** link to view background console
4. Click **"Errors"** button if any errors exist

### Check Content Script
1. On Amazon page, press **F12** (open DevTools)
2. Go to **Console** tab
3. Run: `document.documentElement.dataset.tbInjected`
   - Should return: `"1"`
4. Run: `document.querySelector(".tb-box")`
   - Should return: `<div class="tb-box">...</div>`

### Check Permissions
1. Go to `chrome://extensions/`
2. Click **"Details"** on ThriftBooks extension
3. Scroll to **"Permissions"**
4. Check if `thriftbooks.com` is listed under optional permissions

### Clear Cache (for testing)
In DevTools console on Amazon page:
```javascript
chrome.storage.local.clear()
```

## Common Issues

### Issue: Extension doesn't appear
**Solution:**
- Refresh the Amazon page
- Check extension is enabled in `chrome://extensions/`

### Issue: No permission prompt
**Solution:**
- Permission may have been denied previously
- Go to extension details → Permissions → Remove thriftbooks.com
- Refresh Amazon page

### Issue: Price not showing
**Solution:**
- Check permission was granted
- Check browser console for errors
- Check background service worker console
- Try clearing cache and refreshing

### Issue: "Failed to fetch" errors
**Solution:**
- ThriftBooks may be rate-limiting
- Wait 30 seconds and try again
- Check internet connection

## Test Matrix

| Scenario | Expected Result |
|----------|----------------|
| First load, grant permission | Shows price after 2-5s |
| Second load (cached) | Shows price instantly with "(cached)" |
| First load, deny permission | Shows link only, no price |
| Non-book product page | No injection (graceful no-op) |
| Book without ISBN | No injection (no ISBN found) |
| Offline (cached price exists) | Shows cached price |
| Offline (no cache) | Shows link only |

## Performance Benchmarks

- **ISBN detection**: < 10ms
- **Cache hit**: < 1ms
- **Live fetch**: 2-5 seconds (typical)
- **Timeout**: 8 seconds (max)
- **DOM injection**: < 5ms
