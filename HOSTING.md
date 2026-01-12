# 🚀 Professional Okey & 101 Hosting Guide

This guide provides exhaustive, click-by-click instructions to host your production-ready Okey game.

## 🏗️ Architecture Overview
For high-performance real-time gaming, we use a **Split Deployment**:
1. **Server**: Hosted on [Railway](https://railway.app) (Persistent WebSockets).
2. **Client**: Hosted on [Vercel](https://vercel.com) (Fast Next.js Edge Delivery).

---

## 🛠️ Phase 1: GitHub Preparation
Ensure your code is pushed to a GitHub repository.
1. Create a repository (Private or Public).
2. `git add .`
3. `git commit -m "Production ready"`
4. `git push origin main`

---

## 🌩️ Phase 2: Server Deployment (Railway)
Standard serverless (Vercel) does **not** support the persistent WebSocket connections needed for Okey. Railway is the best solution.

1. **Import**: Login to Railway and click `+ New Project` > `Deploy from GitHub repo`.
2. **Select Folder**: 
    - Click the project. 
    - Go to **Settings** > **General**.
    - Set **Root Directory** to `/server`.
3. **Environment Variables**:
    - Add `PORT` = `3001`.
    - Add `NODE_ENV` = `production`.
    - Add `CORS_ORIGIN` = `https://your-vercel-link.vercel.app` (Add this *after* you get your Vercel link).
4. **Networking**:
    - Go to **Settings** > **Networking**.
    - Click **Generate Domain**.
    - **COPY THIS DOMAIN** (e.g., `okey-server.up.railway.app`).

---

## 🌐 Phase 3: Client Deployment (Vercel)
Vercel optimized for Next.js.

1. **Import**: Login to Vercel, click `Add New` > `Project`, and select your repo.
2. **Configure Folder**:
    - Select **Root Directory** as `client`.
3. **Environment Variables**:
    - Add `NEXT_PUBLIC_SOCKET_URL` = `https://your-railway-domain.up.railway.app` (The one you copied in Phase 2).
4. **Deploy**: Click Deploy.

---

## 🌌 Phase 4: 101 Okey "Void Universe"
The 101 mode features a cinematic "Universe Transition".
- **Trigger**: Click the "101 OKEY" toggle on the home page.
- **Visuals**: Watch the universe shift from **Deep Blue (Standard)** to **Void Red (101)**.
- **Logic**: Automatically adjusts to 22-tile dealing logic and 101 scoring rules.

---

## 🔍 Troubleshooting
- **Gray Screen?**: Check browser console (`F12`). If you see "CORS error", make sure `CORS_ORIGIN` in Railway matches your Vercel URL exactly.
- **Port Error?**: Railway automatically assigns a port. The server code uses `process.env.PORT || 3001`, which is correct.
- **101 Mode not dealing 21 tiles?**: Ensure the Room Code was created while the 101 toggle was active.

### 🎯 Pro Tip
Use different branches if you want to test new logic before pushing to the `main` production branch!
