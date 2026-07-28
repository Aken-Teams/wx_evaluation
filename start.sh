#!/bin/bash
set -e

echo "🚀 啟動供應商評核系統..."

# 獲取腳本所在目錄
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 檢查 dist 目錄是否存在
if [ ! -d "dist" ]; then
    echo "❌ 錯誤: dist/ 目錄不存在！"
    echo "請先執行以下命令建置前端:"
    echo "  npm run build"
    exit 1
fi

echo "✅ 找到前端建置檔案: dist/"

# 進入後端目錄
cd server

# 檢查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 安裝後端依賴..."
    npm install --production
else
    echo "✅ 後端依賴已安裝"
fi

# 檢查 .env 是否存在
if [ ! -f ".env" ]; then
    echo "⚠️  警告: server/.env 檔案不存在"
    echo "請確認環境變數已正確配置"
fi

echo "✅ 準備完成，啟動服務..."
echo "📍 端口: ${PORT:-3001}"
echo "📂 靜態檔案: $(pwd)/../dist"
echo ""

# 啟動後端（會自動提供前端靜態檔案）
exec node src/index.js
