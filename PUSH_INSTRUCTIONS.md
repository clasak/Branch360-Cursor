# Fix: Duplicate File Issue

## Problem
There's already an `options-data` file in your Apps Script project, which is causing the push to fail.

## Solution: Delete the existing file

1. **Go to your Apps Script project:**
   - Open: https://script.google.com/d/12vzYyfq9ooUhKbpbE5jvnvRvwIiF2CBWsRVYzDVjs8tnOWffDNC1Y1Rg/edit

2. **Find and delete the `options-data` file:**
   - Look in the left sidebar file list
   - Find any file named `options-data` (it might be `options-data`, `options-data.js`, or similar)
   - Right-click on it → Delete

3. **Then run the push command again:**
   ```bash
   npm run clasp:push
   ```

## Alternative: Manual push (if needed)

If you want to manually delete all files and start fresh:

1. In Apps Script editor, delete all existing files
2. Then run: `npm run clasp:push`

## What we fixed locally:

✅ Renamed `options-data.js` → `options-data.html`  
✅ Renamed `activity-client.js` → `activity-client.html`  
✅ Updated all HTML files to reference `.html` instead of `.js`  
✅ Updated `.clasp.json` with your Script ID  
✅ You're logged in and ready to push

Once you delete the duplicate file in Apps Script, the push should work!

