# Quick Setup Instructions for Clasp

## ✅ Step 1: Login - DONE!
You're already logged in as: cody.lytle@prestox.com

## Step 2: Enable Apps Script API

1. Go to: https://script.google.com/home/usersettings
2. Turn ON "Google Apps Script API"
3. Wait 1-2 minutes for it to activate

## Step 3: Get Your Script ID

**Option A: Create a NEW Apps Script project**

After enabling the API, run this command in your terminal:
```bash
cd /Users/codylytle/Documents/Branch360
npx clasp create --type standalone --title "Branch360 CRM" --rootDir src
```

This will automatically create `.clasp.json` with your Script ID.

**Option B: Use an EXISTING Apps Script project**

1. Go to https://script.google.com
2. Open your existing project
3. Click the ⚙️ (Settings/Project Settings) icon
4. Find "Script ID" and copy it
5. Edit `.clasp.json` in this folder and paste the Script ID:
   ```json
   {
     "scriptId": "PASTE_YOUR_SCRIPT_ID_HERE",
     "rootDir": "src"
   }
   ```

## Step 4: Push Your Files

Once `.clasp.json` has your Script ID, run:
```bash
npm run clasp:push
```

## Step 5: Start Watching (for development)

To auto-sync changes as you code:
```bash
npm run clasp:watch
```

---

## Current Status
- ✅ Clasp installed
- ✅ Logged in as cody.lytle@prestox.com  
- ⏳ Need to enable Apps Script API (visit the link above)
- ⏳ Need Script ID in `.clasp.json`

