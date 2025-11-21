# Cache-Busting Testing Instructions

## What Was Implemented

✅ Created `service-worker.js` v1.0.0 with version-based cache management  
✅ Created `cache-clear.html` page with one-click cache clearing  
✅ Updated all dashboard HTML files with:
- Service worker registration with version parameter
- Cache-busting query parameters (`?_=timestamp`) on all API calls
- Direct links to cache-clear page

## Testing Instructions

### Step 1: Push Changes to Server
```bash
cd /Users/codylytle/Documents/Branch360
git push origin main
```

### Step 2: Deploy to Your Server
Deploy the updated files from `branch360-territory-manager/public/` to your hosting server.

### Step 3: Clear Cache Before Testing
1. Navigate to: `http://YOUR-SERVER/cache-clear.html`
2. Click the big **"🗑️ Clear All Cache & Reload"** button
3. Wait 2 seconds for automatic redirect

### Step 4: Test the Dashboard
1. Navigate to: `http://YOUR-SERVER/dashboard`
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to the **Console** tab
4. Look for these messages:
   ```
   [SW] Registered successfully: http://YOUR-SERVER/
   ```

### Step 5: Verify API Calls Have Cache-Busting
1. In DevTools, go to the **Network** tab
2. Refresh the page
3. Find the API call to `/api/territories`
4. Verify the URL includes `?_=` followed by a timestamp like:
   ```
   /api/territories?_=1700000000000
   ```

### Step 6: Verify Fresh Data
1. Check that the Salesforce parser data is now correct
2. Expected behavior:
   - Account Name should NOT be "BY:"
   - POC Email should NOT show your email incorrectly
   - All data should be fresh from the server

### Step 7: Test Cache-Clear Page Works
1. Navigate to: `http://YOUR-SERVER/cache-clear.html`
2. Should see a clean page with:
   - "🧹 Clear Browser Cache" heading
   - Big clear button
   - List of what gets cleared
3. Click button - should clear everything and reload

## What You Should See in Console

✅ **Good Output:**
```
[SW] Registered successfully: http://YOUR-SERVER/
✓ localStorage cleared
✓ sessionStorage cleared
✓ Cookies cleared
✓ Service worker unregistered
✓ Cache deleted: branch360-cache-v1.0.0
```

❌ **Bad Output (means caching still an issue):**
```
[SW] Registration failed: ...
(or no SW messages at all)
```

## Force Cache Update in Future

When you need to force all users to refresh their cache:

1. Edit `service-worker.js`
2. Change line 3:
   ```javascript
   const CACHE_VERSION = 'v1.0.1';  // Increment version
   ```
3. Edit all HTML files
4. Change `SW_VERSION`:
   ```javascript
   const SW_VERSION = '1.0.1';  // Match service worker version
   ```
5. Commit and deploy

All users will automatically get the new version on next page load.

## Manual Cache Clear (If Needed)

If the automatic solution doesn't work:
1. Visit `http://YOUR-SERVER/cache-clear.html`
2. Or use browser:
   - **Chrome/Edge**: Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)
   - **Firefox**: Ctrl+Shift+Delete
   - **Safari**: Cmd+Option+E
3. Select "Cached images and files"
4. Click "Clear data"

## Troubleshooting

**Problem**: Still seeing old data after clearing cache  
**Solution**: 
1. Close ALL browser tabs with your app
2. Visit `cache-clear.html` directly
3. Hard reload: Ctrl+Shift+R (Cmd+Shift+R on Mac)

**Problem**: Service Worker not registering  
**Solution**:
1. Check browser console for errors
2. Ensure server serves `.js` files with correct MIME type
3. Verify `service-worker.js` is accessible at root path

**Problem**: Data still incorrect  
**Solution**: The parser logic itself may still have issues. This cache solution only ensures fresh data is loaded - it doesn't fix backend parsing bugs.

## Quick Links

- Cache Clear Page: `/cache-clear.html`
- Unified Dashboard: `/dashboard`
- Territory Manager: `/territories`

## Files Changed

```
branch360-territory-manager/public/
├── service-worker.js (NEW)
├── cache-clear.html (NEW)
├── index.html (UPDATED)
├── dashboard.html (UPDATED)
└── territory-manager.html (UPDATED)
```

## Success Criteria

✅ Console shows service worker registered  
✅ API calls include timestamp parameter  
✅ Cache-clear page works  
✅ Salesforce data displays correctly  
✅ No "BY:" in Account Name field  
✅ POC Email shows correct value

