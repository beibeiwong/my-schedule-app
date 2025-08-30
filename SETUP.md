# 📱 Schedule App Setup Guide

## 🚀 Deploy to GitHub Pages

### Step 1: Create GitHub Repository
1. Go to [github.com](https://github.com) and sign up/login
2. Click "New repository" (green button)
3. Name it: `my-schedule-app`
4. Make it **Public** (required for free GitHub Pages)
5. Check "Add a README file"
6. Click "Create repository"

### Step 2: Generate App Icons
1. Open `create-icons.html` in your browser
2. It will auto-download `icon-192.png` and `icon-512.png`
3. Save these files to your project folder

### Step 3: Upload Files to GitHub
1. In your repository, click "uploading an existing file"
2. Drag and drop ALL these files:
   - `index.html`
   - `styles.css`
   - `script.js`
   - `manifest.json`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
3. Write commit message: "Add PWA files"
4. Click "Commit changes"

### Step 4: Enable GitHub Pages
1. Go to repository **Settings** tab
2. Click **Pages** in left sidebar
3. Under "Source": select "Deploy from a branch"
4. Choose "main" branch and "/ (root)"
5. Click "Save"
6. Your app will be live at: `https://yourusername.github.io/my-schedule-app`

## ☁️ Cross-Device Sync Setup

### Step 1: Create GitHub Token
1. Go to GitHub → Settings → Developer settings
2. Click "Personal access tokens" → "Tokens (classic)"
3. Click "Generate new token (classic)"
4. Give it a name like "Schedule App Sync"
5. Check the **"gist"** permission only
6. Click "Generate token"
7. **Copy the token** (you won't see it again!)

### Step 2: Enable Sync in App
1. Open your deployed app
2. Click "☁️ Setup Sync" button
3. Paste your GitHub token
4. Your data will now sync across all devices!

## 📱 Install on Mobile

### Android:
1. Open app in Chrome
2. Tap "📱 Install App" button
3. Or: Menu → "Add to Home screen"

### iPhone:
1. Open app in Safari
2. Tap Share button (square with arrow)
3. Tap "Add to Home Screen"

## ✨ Features
- ✅ Works offline
- ✅ Syncs across devices
- ✅ Native app experience
- ✅ Home screen installation
- ✅ Auto-updates

Your schedule app is now a full PWA! 🎉