# Cloudflare China Optimization Guide

針對中國區同仁的訪問優化，請按照以下步驟在 Cloudflare Dashboard 中進行配置。

## 1. Smart Routing (Argo)
開啟 Argo Smart Routing 可以顯著優化跨國網絡路徑，尤其是針對中國的訪問。

- **位置**: Dashboard > Select Domain > **Traffic** > **Argo**
- **操作**: 啟用 **Argo Smart Routing**。
- **注意**: 這是一項付費功能（基於流量計費）。

## 2. Custom Domain (CNAME Setup) & SaaS
若是 Enterprise 方案或使用了 Cloudflare for SaaS，可以利用 CNAME 接入來優化中國路由（例如配合自定義的接入點）。
對於標準 Pages 專案：
- **位置**: Dashboard > Workers & Pages > [Project Name] > **Custom Domains**
- **操作**: 綁定自定義域名（例如 `app.intenza.com`）。
- **DNS 配置**: 在 DNS 設置中，確保該域名的 Proxy Status 為 **Proxied (Orange Cloud)**。

## 3. SSL/TLS Full Mode
確保端到端加密並避免重定向循環。

- **位置**: Dashboard > Select Domain > **SSL/TLS** > **Overview**
- **操作**: 選擇 **Full** 或 **Full (strict)**。
  - **Full**: 允許後端使用自簽名證書 (Pages 通常不需要此項，但為了安全建議開啟)。
  - **Full (strict)**: 要求後端有有效證書 (Cloudflare Pages 內部已處理，建議使用 Strict)。

## 4. Edge Certificate (Optional for Legacy Client Support)
如果中國區存在較舊的設備，可能需要調整 TLS 版本。
- **位置**: Dashboard > SSL/TLS > **Edge Certificates**
- **Minimum TLS Version**: 默認 1.2，若有兼容性問題可測試 1.0 (不推薦)。

## 5. D1 & R2 Setup Verification
已在 `wrangler.jsonc` 中配置了綁定。請運行以下命令實際創建資源並獲取 ID：

```bash
# 1. 登錄 Cloudflare
npx wrangler login

# 2. 創建 D1 數據庫 (如果尚未創建)
npx wrangler d1 create intenza_product_0127

# 3. 獲取輸出的 database_id 並替換 wrangler.jsonc 中的 "REPLACE_WITH_YOUR_D1_DATABASE_ID"

# 4. 創建 R2 Bucket (如果尚未創建)
npx wrangler r2 bucket create intenza-product-0127-bucket
```

## 6. Entry Point Error Fix
原本的 `Missing entry-point` 錯誤是因為 Wrangler 找不到 Worker 入口。
我們已經建立了 `wrangler.jsonc` 並指定了 `pages_build_output_dir: "dist"`，這明確告知 Wrangler 這是一個 **Pages** 專案以及靜態資源的位置。

**啟動開發服務器:**
```bash
npm run pages:dev
# 或者
npx wrangler pages dev dist
```
