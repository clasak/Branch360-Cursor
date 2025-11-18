# Clasp Setup Guide for Branch360

This guide will help you set up clasp to sync your local files with Google Apps Script.

## Prerequisites

✅ Clasp is already installed as a dev dependency (via `npm install`)

## Setup Steps

### 1. Login to Google

Run this command to authenticate with your Google account:

```bash
npm run clasp:login
```

This will open a browser window for you to authorize clasp with your Google account.

### 2. Get Your Apps Script Project ID

You need to create or connect to an existing Google Apps Script project:

**Option A: Create a new Apps Script project**
1. Go to https://script.google.com
2. Click "New Project"
3. The Script ID is in the URL: `https://script.google.com/home/projects/YOUR_SCRIPT_ID/edit`
   - Or go to Project Settings (⚙️) → Scroll down to "Script ID"

**Option B: Use an existing project**
1. Open your existing Apps Script project
2. Project Settings (⚙️) → Script ID

### 3. Create `.clasp.json` File

Copy the example file and add your Script ID:

```bash
cp .clasp.json.example .clasp.json
```

Then edit `.clasp.json` and replace `YOUR_SCRIPT_ID_HERE` with your actual Script ID:

```json
{
  "scriptId": "1Ab2Cd3Ef4Gh5Ij6Kl7Mn8Op9Qr0St1Uv2Wx3Yz",
  "rootDir": "src"
}
```

## Usage

### Push files to Apps Script (one-time)
```bash
npm run clasp:push
```

### Watch for changes and auto-push (development)
```bash
npm run clasp:watch
```

This will automatically push changes whenever you save a file in the `src/` directory.

**To stop watching:** Press `Ctrl+C` in the terminal

### Pull files from Apps Script (download remote changes)
```bash
npm run clasp:pull
```

### Open Apps Script project in browser
```bash
npm run clasp:open
```

## Development Workflow

1. **Start development:**
   ```bash
   npm run clasp:watch
   ```

2. **Make changes** to files in `src/` directory

3. **Save files** - clasp will automatically push to Apps Script

4. **Test in Apps Script:**
   - Open: `npm run clasp:open`
   - Or manually go to https://script.google.com
   - Test functions in the editor

5. **When done coding:**
   - Stop watching (`Ctrl+C`)
   - Optional: Do a final manual push: `npm run clasp:push`

## Important Notes

- **File limits:** Apps Script has a 20-file limit per project
- **File size:** Each file max ~1MB, total project ~20MB
- **`.js` files:** These need to be either:
  - Inlined into HTML files as `<script>` tags, OR
  - Renamed to `.html` (they'll work as client-side scripts)

## Troubleshooting

**Error: "Not logged in"**
- Run: `npm run clasp:login`

**Error: "Script ID not found"**
- Check your `.clasp.json` file has the correct Script ID
- Make sure the Apps Script project exists and you have access

**Files not syncing:**
- Make sure you're in the project root directory
- Check that `rootDir` in `.clasp.json` points to `src`
- Verify files are in the `src/` directory

**Permission errors:**
- Make sure you have edit access to the Apps Script project
- The project owner may need to grant you access

## Next Steps

After setting up clasp:
1. Run `npm run clasp:push` to upload all files
2. Set up your Apps Script `manifest.json` if needed
3. Deploy as a Web App in Apps Script
4. Start developing with `npm run clasp:watch`!

