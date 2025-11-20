# How to Create a GitHub Personal Access Token

## Step-by-Step Instructions

### 1. Go to GitHub Settings
- Visit: https://github.com/settings/tokens
- Or: GitHub.com → Your Profile (top right) → Settings → Developer settings → Personal access tokens → Tokens (classic)

### 2. Generate New Token
- Click **"Generate new token"** → **"Generate new token (classic)"**
- You may need to enter your GitHub password

### 3. Configure Token
- **Note:** Give it a descriptive name like "Branch360 Cursor Push"
- **Expiration:** Choose how long it should last (30 days, 90 days, or no expiration)
- **Select scopes:** Check the box for **`repo`** (this gives full repository access)
  - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`

### 4. Generate and Copy
- Click **"Generate token"** at the bottom
- **IMPORTANT:** Copy the token immediately - you won't be able to see it again!
- It will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 5. Use the Token
Once you have the token, you can either:
- Share it with me and I'll configure git to use it for this push
- Or use it yourself in the terminal

---

## Quick Method (If you have GitHub CLI installed)

If you have `gh` CLI installed:
```bash
gh auth login
# Follow the prompts - it will open a browser
# This automatically creates and stores a token
```

---

## Security Notes

⚠️ **Keep your token secret!**
- Never commit tokens to git
- Don't share tokens publicly
- If a token is exposed, revoke it immediately in GitHub settings

---

## After Creating the Token

Once you have the token, you can:
1. Share it with me (I'll use it just for this push)
2. Or configure it yourself:
   ```bash
   git remote set-url origin https://YOUR_TOKEN@github.com/clasak/Branch360-Cursor.git
   git push origin main
   ```

---

**Token URL:** https://github.com/settings/tokens

