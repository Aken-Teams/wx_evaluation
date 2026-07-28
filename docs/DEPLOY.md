# 部署指南

## 快速部署步驟

### 1. 準備階段

#### 在本地建置前端
```bash
# 安裝依賴
npm install

# 建置生產版本
npm run build
```

#### 上傳到服務器
```
/path/to/app/
├── dist/              # 前端建置產物
├── server/            # 後端代碼
├── start.sh           # 啟動腳本
└── .env.production    # 環境配置
```

---

### 2. 配置環境變數

#### 前端 `.env.production`
```env
VITE_API_URL=/api
```

#### 後端 `server/.env`
```env
PORT=12017
DATABASE_URL=mysql://username:password@host:port/database
JWT_SECRET=<使用 crypto.randomBytes(32).toString('base64') 生成>
NODE_ENV=production
```

---

### 3. 啟動應用

#### 使用啟動腳本（推薦，Linux/Mac）

**Linux/Mac**:
```bash
chmod +x start.sh
./start.sh
```

> 💡 **Windows 提示**：目前專案未提供對應的 `start.bat`，請改用手動啟動（或在伺服器上透過 PM2 啟動 `server/src/index.js`）。

#### 使用 PM2（生產環境推薦）
```bash
cd server
npm install --production

# 啟動
pm2 start src/index.js --name vendor-assessment

# 自動重啟
pm2 startup
pm2 save
```

---

### 4. 配置反向代理

#### Nginx 配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:12017;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api {
        proxy_pass http://127.0.0.1:12017/api;
    }
}
```

---

## 故障排除

### 前端顯示空白
```bash
# 確認 dist/ 存在
ls -la dist/

# 重新建置
npm run build
```

### API 連接失敗
```bash
# 檢查後端狀態
pm2 status

# 查看日誌
pm2 logs vendor-assessment

# 測試端口
curl http://localhost:12017/api/health
```

### 資料庫連接錯誤
```bash
# 檢查 DATABASE_URL
cat server/.env | grep DATABASE_URL

# 測試連接
mysql -h host -u user -p -e "SELECT 1"
```

---

## 更新部署

```bash
# 1. 本地建置
npm run build

# 2. 上傳 dist/
rsync -avz dist/ user@server:/path/to/app/dist/

# 3. 上傳後端更新
rsync -avz server/ user@server:/path/to/app/server/

# 4. 重啟服務
pm2 restart vendor-assessment
```

---

## 安全檢查清單

- [ ] `.env` 文件不在版本控制中
- [ ] JWT_SECRET 使用強隨機密鑰
- [ ] 資料庫密碼足夠強壯
- [ ] 生產環境使用 HTTPS
- [ ] 防火牆僅開放必要端口
- [ ] 定期更新依賴包

---

**最後更新**: 2025-10-31
