# JEE Main 2027 — Prep Website

A static website for tracking JEE Main 2027 preparation. Covers all 3 subjects across 4 phases, with detailed session plans, formula sheets, practice problems, and an interactive progress tracker.

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Dashboard — phases, month timeline, subject cards, milestones, exam strategy |
| `subjects/math.html` | Mathematics — Trigonometry Phase 1 (13 sessions) |
| `subjects/physics.html` | Physics — Units & Dimensions + 4 units (14 sessions) |
| `subjects/chemistry.html` | Chemistry — 4 Phase 1 units (12 sessions) |
| `progress.html` | Interactive progress tracker (saved in browser) |

## How to Host on GitHub Pages — Step by Step

### Step 1: Create a GitHub account
Go to https://github.com and sign up (free).

### Step 2: Create a new repository
1. Click the **+** icon → **New repository**
2. Name it: `jee-2027-prep` (or anything you like)
3. Set visibility to **Public**
4. Click **Create repository**

### Step 3: Upload the files
**Option A — Upload via browser (easiest):**
1. Open your new repository on GitHub
2. Click **Add file** → **Upload files**
3. Drag and drop the entire contents of this folder
4. Make sure the folder structure is maintained:
   ```
   index.html
   progress.html
   README.md
   css/
     style.css
   js/
     main.js
   subjects/
     math.html
     physics.html
     chemistry.html
   ```
5. Scroll down, write a commit message like "Initial upload"
6. Click **Commit changes**

**Option B — Using Git (if you have Git installed):**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/jee-2027-prep.git
git push -u origin main
```

### Step 4: Enable GitHub Pages
1. In your repository, go to **Settings** tab
2. Scroll down to **Pages** section (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Under **Branch**, select **main** and folder **/ (root)**
5. Click **Save**

### Step 5: Access your website
GitHub will show you a URL like:
```
https://YOUR_USERNAME.github.io/jee-2027-prep/
```
It may take 1–2 minutes to go live the first time.

### Step 6: Update anytime
- Go to the file on GitHub → click the pencil (edit) icon → make changes → commit
- Or re-upload files via **Add file** → **Upload files**
- Changes go live automatically within 1–2 minutes

## Progress Tracker Note
Progress checkboxes and scores are saved in the **browser's localStorage** on whatever device you use. They are NOT synced across devices — this is a static site with no server. If you clear browser data, progress resets. Use the Save button regularly.

## Structure
```
jee-2027-prep/
├── index.html          ← Dashboard / homepage
├── progress.html       ← Progress tracker
├── README.md
├── css/
│   └── style.css       ← All styles
├── js/
│   └── main.js         ← Nav, accordion, progress tracker
└── subjects/
    ├── math.html       ← Mathematics
    ├── physics.html    ← Physics
    └── chemistry.html  ← Chemistry
```
