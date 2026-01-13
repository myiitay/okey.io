# Okey.io Deployment Guide

Bu proje iki parçadan oluşur:
1. **Client (Frontend):** Vercel üzerinde çalışır.
2. **Server (Backend):** 7/24 çalışan bir sunucu (Render, Railway vb.) gerektirir.

Şu an yaşadığınız **404 Not Found** ve **WebSocket connection failed** hatalarının sebebi, Client'ın Vercel'de çalışması ama Server'ın Vercel'de çalışmamasıdır (veya Client'ın backend adresini bilmemesidir).

---

## Adım 1: Backend'i (Server) Kurma (Render.com Kullanarak - Ücretsiz)

Vercel, WebSocket (Socket.io) sunucuları için uygun değildir. Bunun yerine ücretsiz olan **Render**'ı kullanacağız.

1. [Render.com](https://render.com) adresine gidin ve GitHub hesabınızla giriş yapın.
2. "New +" butonuna tıklayın ve **"Web Service"** seçin.
3. GitHub reponuzu seçin (`okey` projeniz).
4. Ayarları şu şekilde yapın:
   - **Name:** `okey-server`
   - **Root Directory:** `server` (Burası çok önemli!)
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. "Create Web Service" butonuna tıklayın.
6. Deploy işlemi bitince sol üstte size bir URL verecek (örn: `https://okey-server-xyz.onrender.com`). **Bu adresi kopyalayın.**

---

## Adım 2: Frontend'i (Client) Ayarlama (Vercel)

Şimdi Vercel'deki Client uygulamanıza, az önce kurduğumuz Server'ın adresini tanıtacağız.

1. Vercel panelinizde projenize gidin.
2. **Settings** -> **Environment Variables** sekmesine tıklayın.
3. Yeni bir değişken ekleyin:
   - **Key:** `NEXT_PUBLIC_SOCKET_URL`
   - **Value:** (Render'dan kopyaladığınız adres, örn: `https://okey-server-xyz.onrender.com`)
4. **Save** deyin.
5. **Deployments** sekmesine geri dönün, son deploy'un yanındaki üç noktaya tıklayıp **Redeploy** seçeneğini seçin.

---

## Özet

Bu işlemleri yaptığınızda:
1. Kullanıcılar `okey-io.vercel.app` adresine girecek.
2. Uygulama arkaplanda `okey-server-xyz.onrender.com` adresindeki sunucuya bağlanacak.
3. Odalar oluşturulacak ve herkes birbirini görebilecek.
