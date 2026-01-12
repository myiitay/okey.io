# 🚀 Okey Project Hosting Rehberi (Adım Adım)

Bu proje iki ana parçadan oluşur: **Frontend (Next.js)** ve **Backend (Socket.io/Node.js)**. Bunları başarılı bir şekilde canlıya almak için aşağıdaki adımları izlemelisin.

---

## 1. Hazırlık: Environment Variables (Çevre Değişkenleri)

Canlıya çıkmadan önce client ve server'ın birbirini tanıması gerekir.

### Server Tarafı (`/server/.env`)
Server'ın hangi portta çalışacağını ve hangi adresten gelen bağlantıları kabul edeceğini belirtmelisin.
```env
PORT=3001
CORS_ORIGIN=https://okey-client.vercel.app  # Frontend adresin buraya gelecek
NODE_ENV=production
```

### Client Tarafı (`/client/.env.local`)
Client'ın server'a bağlanabilmesi için server adresini bilmesi gerekir.
```env
NEXT_PUBLIC_SOCKET_URL=https://okey-server-api.railway.app # Server adresin buraya gelecek
```

---

## 2. Seçenek A: Railway.app (En Kolay Yol)

Socket.io (WebSocket) kullandığımız için Vercel'in kendisi backend için uygun değildir (serverless olduğu için bağlantı kopar). Railway hem frontend hem backend için harikadır.

### Adımlar:
1. **GitHub'a Yükle**: Projeni bir GitHub reposuna pushla.
2. **Railway'e Bağlan**: Railway.app'e git ve GitHub deponu bağla.
3. **Servisleri Ayır**:
   - **Server Servisi**: 
     - Root Directory: `server`
     - Build Command: `npm install && npm run build`
     - Start Command: `npm start`
     - Variables: `PORT=3001`, `CORS_ORIGIN=*` (Şimdilik her şeyi kabul etsin).
   - **Client Servisi**:
     - Root Directory: `client`
     - Build Command: `npm run build`
     - Start Command: `npm start`
     - Variables: `NEXT_PUBLIC_SOCKET_URL` (Server'ın Railway'deki URL'i).

---

## 3. Seçenek B: VPS (Ubuntu + Nginx + PM2)

Kendi sunucuna (DigitalOcean, Hetzner, AWS) kurmak istersen adımlar:

### I. Sunucu Hazırlığı
```bash
sudo apt update
sudo apt install nodejs npm nginx git
sudo npm install -g pm2
```

### II. Proje Kurulumu
```bash
git clone <repo-url>
cd okey
```

### III. Server Başlatma
```bash
cd server
npm install
npm run build
pm2 start dist/index.js --name "okey-server"
```

### IV. Client Başlatma
```bash
cd ../client
npm install
npm run build
pm2 start npm --name "okey-client" -- start
```

### V. Nginx Config (SSL ve Reverse Proxy)
Hassas nokta: WebSocket bağlantısını geçirmek için Nginx ayarı yapmalısın. `/etc/nginx/sites-available/default` dosyasını düzenle:

```nginx
server {
    server_name senin-siten.com;

    location / {
        proxy_pass http://localhost:3000; # Client
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001; # Server
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```
Sonra: `sudo systemctl restart nginx`

---

## 💡 Kritik İpucu: SSL (HTTPS)
Socket.io canlıda **WSS (WebSocket Secure)** protokolünü kullanmalıdır. Eğer siten HTTPS ise (ki öyle olmalı), `socket.io` bağlantısı da güvenli olmalıdır.
- Cloudflare veya Certbot (Let's Encrypt) kullanarak bedava SSL alabilirsin.

## 📋 Özet Checklist
- [ ] Server'daki `CORS_ORIGIN` değişkenini güncelledin mi?
- [ ] Client'taki `NEXT_PUBLIC_SOCKET_URL` değişkenini güncelledin mi?
- [ ] Port 3001 (Server) ve 3000 (Client) portlarının sunucuda açık olduğundan emin misin?
- [ ] `npm run build` komutlarının hata vermediğini kontrol ettin mi?
