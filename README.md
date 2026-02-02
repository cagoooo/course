# SMES AI 智慧排課系統 (v2.5.0)

![Roadmap 2.5](https://img.shields.io/badge/Roadmap-2.5.0-blue?style=for-the-badge&logo=react)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-orange?style=for-the-badge&logo=firebase)

本系統是針對「石門國民小學」開發的智慧化自動排課與管理平台，旨在取代傳統的桌機版 STC 系統，提供雲端同步、AI 衝突解決與現代化的使用者體驗。

## ✨ 最新更新 (v2.5.0) - User Management & Mobile UX
*   **📱 手機端體驗優化**：新增 LINE/Facebook 內建瀏覽器偵測阻擋 (In-App Browser Guard)，引導使用者開啟預設瀏覽器以解決 Google 登入錯誤。
*   **👥 用戶權限管理強化**：新增「刪除帳號」功能，並內建防止刪除管理員的安全機制 (Admin-safe deletion)。
*   **🖨️ "Editorial Luxury" 列印排版**：全面升級課表匯出樣式，採用 4px/2px 粗黑高對比格線與 16pt 特粗字體，確保清晰的紙本閱讀體驗。
*   **🔧 部署穩定性**：修復 GitHub Pages 路徑 (404) 問題與 CI/CD 環境變數注入邏輯。

## ✨ 核心特色 (Roadmap 2.1)
*   **PWA 全面支援**：支援離線查看課表，並可將系統安裝至手機桌面（Add to Home Screen）。
*   **離線資料同步**：實作 IndexedDB 本地資料庫，在網路不穩時仍能讀取教師與班級設定。

## ✨ 核心特色 (Roadmap 2.0)

### 🧠 AI 智慧建議引擎
*   **鏈式衝突解決**：採用深度 BFS 演算法，自動搜尋多步交換路徑（如 A->B, B->C），一鍵解決複雜排課僵局。
*   **語意化建議**：提供清晰的中文操作指令，讓排課人員能理解 AI 的修正邏輯。

### 🎨 進階排課規則 (Advanced Rules)
*   **學科權重定向**：實作美勞、體育等科目「下午優先」權重。
*   **智能連堂控制**：確保美勞等需要連續操作的學科自動排成 2 節連堂，減少老師與學生的負擔。
*   **課程分配優化**：針對國語、數學等核心學科進行合理的週分配保護。

### 📸 版本快照管理
*   **雲端備份**：隨時記錄當前排課進度至 Firestore。
*   **一鍵還原**：在進行自動演算或大幅度手動調整時，可隨時退回到先前的安全版本。

### 📱 現代化響應式 UI (RWD)
*   **Premium 設計**：採用現代色彩系統、毛玻璃效果與流暢的動態過場。
*   **行動端優化**：針對手機/平版提供優化的橫向捲動課表與操作介面。

---

## 🛠️ 技術棧
*   **前端**：React 19, Vite, Vanilla CSS
*   **後端/資料庫**：Firebase Auth, Firestore
*   **核心演算法**：遺傳演算法 (Genetic Algorithm) + 啟發式搜索

---

## 🚀 快速開始

### 本地開發
1. 克隆專案並進入目錄。
2. 執行 `npm install`。
3. 建立 `.env` 檔案並填入 Firebase 配置（詳見 `.env.example`）。
4. 啟動開發伺服器：
   ```bash
   npm run dev
   ```

### 部署至 GitHub Pages
1. 執行打包指令：
   ```bash
   npm run build
   ```
2. 將 `dist` 資料夾內容部署至您的 GitHub Repository。

---

## 🔐 安全規範
*   所有 API Key 均透過 `.env` 隔離，禁止硬編碼。
*   管理權限採用 Firebase Custom Claims (admin/editor) 嚴格控管。

---

## 📅 未來展望 (Roadmap 3.0 - 4.0)
*   [ ] 權限分級管理 (RBAC)。
*   [ ] 多語系語系檔 (i18n) 擴充。
*   [ ] 視覺化版本差異對比 (Visual Diff)。

---
**Developed with ❤️ for SMES by Antigravity AI.**
