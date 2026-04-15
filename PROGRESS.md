# SMES AI 智慧排課系統 · 完整進度表與未來優化藍圖

> 最後更新:2026-04-16  
> 目前版本:**v2.12.0** (DX & Testing Foundation)  
> 對應分支:`main` — 已完成 6 大優化項,測試+CI 綠燈

## 🎉 v2.12.0 Sprint 戰果速覽(本輪)

| 類別 | 項目 | 狀態 | 新檔/改檔 |
|:---|:---|:---:|:---|
| **UX** | Toast 通知系統取代 `alert()` | ✅ | `contexts/ToastContext.{jsx,css}` |
| **UX** | 快捷鍵系統(Ctrl+S/Z/E/Enter/Esc) | ✅ | `hooks/useKeyboardShortcuts.js` |
| **UX** | 排課進度 ETA 預估(已花費/代速/剩餘) | ✅ | `hooks/useScheduleETA.js` |
| **A5** | Vitest 測試架構 + 5 支關鍵模組測試 | ✅ | `vitest.config.js`, `src/test/setup.js`, 7 支 `.test.{js,jsx}` |
| **A5** | GitHub Actions CI(lint/test/rules/build) | ✅ | `.github/workflows/ci.yml` |
| **D3** | Firestore Rules 單元測試(23 個) | ✅ | `vitest.rules.config.js`, `src/test/rules/firestore.rules.test.js` |
| **B2** | 抽出 3 個 hooks(Scheduler/Excel/Snapshot) | ✅ | `hooks/useSchedulerEngine.js`, `useExcelImport.js`, `useSnapshot.js` |
| **B2** | 引入 Zustand store 統一 UI 狀態 | ✅ | `store/scheduleStore.js` |
| **Bug fix** | 修正 `ExcelImporter` off-by-one 欄位偏移 bug | ✅ | `utils/excel/ExcelImporter.js` |

**測試戰果:** 1 檔 → **12 檔 / 127 個 unit tests + 23 個 rules tests**,覆蓋率:
- `SubstituteService.js` 96% / `ExcelImporter.js` 98% / `useKeyboardShortcuts.js` 93% / `ToastContext.jsx` 88% / `useScheduleETA.js` 88%

**AutoSchedule.jsx:** 關鍵業務邏輯(worker 生命週期 / Excel 匯入 / Smart Seed)從組件抽離到可測試的 hooks,UI 層可在下一輪繼續瘦身。

---

## 📍 Part 1 — 已完成功能總覽 (v1.0 → v2.11.0)

### 🎯 v2.11.0 · Excel 匯入 + 智慧代課 + 智慧種子 (目前最新)
- ✅ **Excel 配課表匯入**:`ExcelImporter.js` 支援全半形正規化、欄位別名、模糊比對(班級/科目/教師)
- ✅ **匯入預覽 Modal**:`ImportPreviewModal.jsx` — 顯示 matched/unmatched 分頁、行號與未匹配原因
- ✅ **智慧代課推薦引擎**:`SubstituteService.js` + `SubstitutePanel.jsx`
  - 三級推薦:🥇 最佳(科目相符+當日節數少) / ✅ 可考慮 / 📌 備選
  - 過勞防護(當日節數 ≤ 5)與空堂驗證
- ✅ **Smart Seed 智慧種子**:GA 初始族群索引 0 注入上學期最佳染色體,加速收斂
- ✅ **50/50 多樣性保留**:半族群啟發式 + 半族群隨機,兼顧收斂速度與基因多樣性

### 🎨 v2.8.1 · UI/UX 全面升級
- ✅ Excel 匯出三欄漸層卡片
- ✅ 年級 Tab 彈簧動畫
- ✅ 班級 Pill 彩虹漸層
- ✅ 點擊自動平滑滾動至課表預覽

### 🧮 v2.7 系列 · 演算法核心強化
- ✅ **GA v3.1 混合修復突變 (Hybrid Repair Mutation)**
  - 🔴 教師衝突修復 30%(跨班級掃描,強制移至空堂)
  - 🔵 數學修復 17.5%(下午 → 上午、一天兩節 → 拆分)
  - 🟢 國語修復 17.5%(每日 > 2 節 → 改日)
  - 🎯 定向突變 21%(挑選扣分最重的課進行交換)
  - 🎲 隨機交換 14%(避免 Local Optimum)
- ✅ **硬性限制升級**:數學下午禁排、數學每日限一節、國語每日限兩節(−50,000/次)
- ✅ **演算法規則總表**:`ALGORITHM_SUMMARY.md` 完整文件化
- ✅ **教師跳轉** URL ?id= 參數:品質報告點擊 → 直達該教師課表

### 📊 v2.6 · 品質分析與報告
- ✅ **排課品質分析報告** (Phase 1.1):嚴重衝突/軟性扣分/疲勞警告三層呈現
- ✅ **教師連堂疲勞偵測** (Phase 1.2):連續 > 3 節、單日過載警示
- ✅ **品質報告扣分跳轉**:點擊該班/該教師 → 自動聚焦檢視
- ✅ **年級分頁班級快選器**:上/中/高三年段切換 + 班級 Pill

### 📦 v2.5.0 · 用戶管理與行動體驗
- ✅ **LINE/FB 內建瀏覽器 Guard**:`InAppBrowserGuard.jsx` 偵測並引導
- ✅ **管理員安全刪除**:Firebase Custom Claims + Admin-safe deletion
- ✅ **"Editorial Luxury" 列印樣式**:4px/2px 粗黑格線 + 16pt 特粗字體
- ✅ **GitHub Pages 部署修復**:路徑 404 與 CI/CD Secrets 注入

### 🗄️ v2.1 ~ v2.4 · 核心基礎建設
- ✅ **PWA 全面支援**:Manifest + Service Worker + 離線快取
- ✅ **IndexedDB 離線資料庫** (`idb`):教師/班級設定離線可讀
- ✅ **AI 鏈式衝突解決**:深度 BFS 多步交換路徑(A→B, B→C)
- ✅ **版本快照管理**:Firestore 雲端備份 + 一鍵還原
- ✅ **響應式 Premium UI**:毛玻璃、動態過場、手機橫向捲動課表

### 🔐 v1.0 · 環境建置
- ✅ Firebase Auth + Firestore(env 隔離)
- ✅ React 19 + Vite + Vanilla CSS
- ✅ 嚴格安全盤查:Custom Claims(admin/editor)、API Key 隔離

---

## 🧱 Part 2 — 目前檔案資產盤點

### 🔬 演算法層 `src/algorithms/`
| 檔案 | 角色 |
|:---|:---|
| `GeneticAlgorithm.js` | GA v3.1 主引擎(智慧種子、自適應突變、Top3 精英) |
| `ConstraintChecker.js` | 硬/軟性限制評分 + 教師疲勞計算 |
| `Diagnostics.js` | 排課前檢查(教師超載、科目不足等) |
| `types.js` | 時間索引工具函式(35 格 = 5 天 × 7 節) |

### 🧩 元件層 `src/components/`
14 個主要元件,覆蓋:衝突解決、快照管理、品質報告、代課推薦、Excel 匯入/匯出、列印設定、教師工作量、時段網格、擋瀏覽器、預排管理...

### 📄 頁面層 `src/pages/`
Dashboard / AutoSchedule / ClassSchedule / TeacherSchedule / PublicSchedule / UserManagement / Login

### 🛠️ 服務層 `src/services/`
DiffService / ExcelService / PrintService / **SubstituteService** / SuggestionService / db / firestoreService

---

## 🚀 Part 3 — 未來優化改良建議(按階段分)

---

### 📌 Phase A · 短期優化(1–2 個月內,低風險高收益)

#### A1 · 文件同步 ⭐⭐⭐
- [ ] **更新 `README.md` 至 v2.11.0**:目前停留在 v2.5.0,落後 6 個中版本
- [ ] **新增 `CHANGELOG.md`**:逐版本紀錄,取代目前散落在 commit message 的更新日誌
- [ ] **補充 `ALGORITHM_SUMMARY.md`**:加入 Smart Seed 機制、50/50 多樣性策略說明
- [ ] **寫 `CONTRIBUTING.md`**:Git flow 規範、命名慣例、PR 檢查清單

#### A2 · 代課模組強化 ⭐⭐⭐(v2.11 已做基礎,可再深化)
- [ ] **代課歷史紀錄**:Firestore collection `substitutions/`,追蹤誰代誰、幾節、日期
- [ ] **一鍵通知教師**:整合 LINE Notify / Email(Firebase Functions)
- [ ] **代課 PDF 派工單**:自動產生 A4 單張,含日期、班級、課程、代課教師簽名欄
- [ ] **多人缺席同時推薦**:目前僅支援單一教師缺席,擴充成批次場景(集體研習)
- [ ] **「連續性代課」**:同一位缺課老師連續多天缺席(出差/病假),一次推薦整週代課

#### A3 · Excel 匯入強化 ⭐⭐
- [ ] **錯誤行自動校正建議**:不匹配時顯示「相似度最高的前 3 個選項」供手動選擇
- [ ] **支援多種表頭格式**:例如日本式(教科/担当/週時数)、英文式(Class/Subject/Teacher/Hours)
- [ ] **匯入前「乾跑模擬」**:不落庫的情況下先跑一次 GA,預估排課品質
- [ ] **Undo 機制**:匯入後 5 分鐘內可一鍵回滾

#### A4 · UI/UX 微調 ⭐⭐
- [ ] **深色模式 (Dark Mode)**:目前僅有亮色主題,老師半夜排課傷眼
- [ ] **手機端 Bottom Sheet**:長清單(如候選代課教師)改為底部抽屜更符合手感
- [x] **快捷鍵**:Ctrl+S 儲存、Ctrl+Z 快照管理、Ctrl+E 匯出(+ Ctrl+Enter 開始、Esc 停止)✨ v2.12
- [x] **Toast 通知系統**:取代 22+ 處 `alert()`/`confirm()`,加入 loading/update/action ✨ v2.12
- [x] **排課進行中顯示 ETA**:已花費時間、代/秒速度、預估剩餘、停滯警示 chip ✨ v2.12

#### A5 · 測試覆蓋 ⭐⭐⭐
- [x] **`ConstraintChecker.test.js` 已存在**:修正 2 個過時測試,保留 11 個 passing ✨ v2.12
- [x] **為 `SubstituteService.js` 寫單元測試**:10 tests,96% 覆蓋率 ✨ v2.12
- [x] **為 `ExcelImporter.js` 寫測試**:11 tests,98% 覆蓋率(順便抓到欄位偏移 bug)✨ v2.12
- [x] **為 `types.js` / `useKeyboardShortcuts.js` / `useScheduleETA.js` / `ToastContext.jsx` / `scheduleStore.js` / 3 支新 hooks 寫測試** ✨ v2.12
- [x] **加上 CI 測試 Workflow**:GitHub Actions 跑 lint + test + coverage + rules + build ✨ v2.12

---

### 🧭 Phase B · 中期重構(3–6 個月,結構性改動)

#### B1 · 演算法升級路線 ⭐⭐⭐⭐
- [ ] **Tabu Search 混合**:在 GA 收斂後接一層 Tabu List,跳出 Local Optimum
- [ ] **多目標優化 (NSGA-II)**:目前是加權求和,改成 Pareto 前沿可呈現「品質 vs 均勻性」權衡
- [ ] **約束規劃 (CP-SAT) 選項**:針對小規模(≤ 10 班)提供 Google OR-Tools 精確解選項
- [ ] **增量排課 (Incremental)**:僅調整部分班級時不需重新全跑,用 LNS (Large Neighborhood Search)
- [ ] **WebAssembly 加速**:核心 fitness 計算改 Rust → WASM,預期 3-5x 加速

#### B2 · 狀態管理統一 ⭐⭐⭐
- [x] **引入 Zustand**:`store/scheduleStore.js` 管理 UI 狀態(status/progress/modals/diff/print 等 15+ field) ✨ v2.12
- [ ] **React Query (TanStack Query)**:取代目前 `firestoreService` 的手動快取,內建重試與 stale-while-revalidate
- [x] **拆分 `AutoSchedule.jsx`**: ✨ v2.12
  - [x] `useSchedulerEngine.js` hook(GA worker 生命週期)
  - [x] `useExcelImport.js` hook(匯入 + 合併邏輯,純 callback 介面)
  - [x] `useSnapshot.js` hook(Smart Seed 讀寫)
- [ ] **進一步拆分**:`useScheduleData.js`(Firestore CRUD)、`useDiff.js`(比對模式)、`usePrint.js`
- [ ] **ScheduleGrid 元件化重構**:目前 1000+ 行依賴父元件太多 prop,可改用 zustand 切斷

#### B3 · 資料模型升級 ⭐⭐⭐
- [ ] **多學期資料隔離**:`SemesterContext` 已存在,但 Firestore 結構需統一加 `semesterId` 索引
- [ ] **教師可用時段矩陣**:從目前的 `unavailableSlots/avoidSlots` 陣列,升級為二維矩陣(含優先度)
- [ ] **科目群組**(新表):例如「藝能科」= {美術, 音樂, 表藝},可批次套規則
- [ ] **班級特殊屬性**:資優班、特教班、雙語班 → 對應特殊排課規則

#### B4 · 使用者權限分級 (RBAC) ⭐⭐⭐
- [ ] **四級權限**:
  - 🔴 Super Admin(全校設定、帳號管理)
  - 🟠 Admin(排課、快照、匯入匯出)
  - 🟡 Editor(編輯自己班級)
  - 🟢 Viewer(唯讀)
- [ ] **Firestore Security Rules 細化**:依 `grade` / `classId` 範圍限制讀寫
- [ ] **操作稽核日誌**:誰、何時、修改了什麼 → Firestore `audit/` collection

#### B5 · 視覺化版本差異 (Visual Diff) ⭐⭐⭐
- [ ] 目前 `DiffService.js` 存在但 UI 簡陋
- [ ] **並排 Diff**:左右兩個快照課表,紅綠標示變動
- [ ] **時間軸 Timeline**:顯示所有快照的創建時間、變動摘要
- [ ] **「部分還原」**:僅還原選定班級的課表,不影響其他班

---

### 🌟 Phase C · 長期展望(6–12 個月,產品形態變革)

#### C1 · AI 助手整合 ⭐⭐⭐⭐
- [ ] **自然語言排課指令**:「請把三年甲班的數學改到週三第二節」→ LLM 解析 → 執行
- [ ] **Claude / GPT API 整合**:作為排課顧問,解釋為何某堂課無法移動(約束衝突分析)
- [ ] **每週品質報告 AI 總結**:自動產生「本週排課重點變動 + 潛在風險」文字
- [ ] **教師工作量不平衡警示**:結合 LLM 給出具體調整建議

#### C2 · 多語系 i18n ⭐⭐
- [ ] **`react-i18next` 整合**:繁中 / 英文 / 日文
- [ ] **翻譯檔結構**:`locales/zh-TW/*.json`,`locales/en/*.json`
- [ ] **語系切換器**:Dashboard 右上角 dropdown
- [ ] **動態數字/日期格式**:使用 `Intl.DateTimeFormat`

#### C3 · 跨校多租戶 SaaS 化 ⭐⭐⭐⭐⭐
- [ ] **Firestore 重構為 Tenant Model**:每個學校一個 `tenants/{schoolId}/...`
- [ ] **訂閱計費(Stripe)**:依班級數或教師數分級收費
- [ ] **總覽儀表板**:跨校分析(平均排課時間、品質分數排行)
- [ ] **白標 (White-label)**:讓各校自訂 Logo、主色

#### C4 · 行動原生 App ⭐⭐
- [ ] **Expo / React Native 版本**:複用現有 React 邏輯
- [ ] **推播通知**:課表變動、代課請求
- [ ] **Widget**:Android/iOS 桌面小工具顯示今日課表

#### C5 · 外部系統整合 ⭐⭐⭐
- [ ] **匯出至 Google Calendar / iCal**:每位教師一個日曆連結
- [ ] **Line Bot 查課表**:綁定 Line Account → 私訊機器人查詢
- [ ] **校務系統對接**(如果學校有):API 同步學生名單、教師異動
- [ ] **e-Portfolio 整合**:與教育雲 OpenID 單一登入(SSO)

---

### 🩺 Phase D · 技術債與重構(隨時可做)

#### D1 · 程式碼品質 ⭐⭐⭐
- [ ] **ESLint 規則嚴格化**:目前僅基礎規則,加入 `eslint-plugin-react-hooks`、`jsx-a11y`
- [ ] **TypeScript 漸進遷移**:先從 `services/` 與 `algorithms/` 開始(核心邏輯最需要型別)
- [ ] **移除無用檔案**:如 `smes_data.json`、`STC.EXE`、`Stc.INI`(非 Web 依賴)
- [ ] **統一命名**:中英混雜(`saveRequirements` vs `處理匯入`),需規範一套

#### D2 · 效能優化 ⭐⭐
- [ ] **React 19 Compiler 啟用**:自動 memo,可能移除部分手寫 `useMemo`
- [ ] **Virtual Scrolling**:教師清單 > 50 人時,用 `react-window` 虛擬化
- [ ] **Image Lazy Loading**:logo/icons 加 `loading="lazy"`
- [ ] **Bundle 分析**:`vite-bundle-visualizer`,找出肥胖模組
- [ ] **Firestore 讀寫批次化**:多筆 `setDoc` → 一次 `writeBatch`

#### D3 · 安全性加固 ⭐⭐⭐⭐
- [x] **Firestore Rules 單元測試**:`@firebase/rules-unit-testing` + 23 個測試,涵蓋 semesters / users / escalation / default-deny ✨ v2.12
- [ ] **CSP (Content Security Policy)**:`index.html` 加 meta 防 XSS
- [ ] **Rate Limiting**:Firebase Functions 加 IP/UID 限流
- [ ] **敏感欄位加密**:教師個資(電話、身分證)→ Firestore 加密欄位

#### D4 · 可觀測性 (Observability) ⭐⭐
- [ ] **錯誤追蹤**:接入 Sentry(免費版即可)
- [ ] **效能監控**:Firebase Performance Monitoring
- [ ] **使用行為分析**:GA4 / Mixpanel — 哪些功能最常用、哪些被忽視
- [ ] **前端日誌**:關鍵操作上報(排課成功/失敗、匯入結果)

---

## 🎯 Part 4 — 衝刺計畫(持續滾動)

### ✅ Sprint 1(Week 1–4)· 打地基 — **已完成 @ v2.12**
1. [x] A5 測試覆蓋(12 檔 / 127 tests / 核心模組 88~98%)
2. [x] A5 CI workflow(lint + test + coverage + rules + build)
3. [x] D3 Firestore Rules 單元測試(23 個,emulator driven)
4. [x] A4 UX 三件套(Toast + 快捷鍵 + ETA)
5. [x] B2 狀態管理初版(Zustand store + 3 hooks)
6. [ ] A1 CHANGELOG.md + CONTRIBUTING.md(推遲到 Sprint 2)
7. [ ] D1 ESLint 嚴格化 + 移除無用檔

### 🏃 Sprint 2(Week 5–8)· 補強既有模組
1. A1 文件完善(CHANGELOG、CONTRIBUTING、ALGORITHM_SUMMARY 補 Smart Seed)
2. A2 代課模組 · 歷史紀錄 + 一鍵通知 + PDF 派工單
3. A3 Excel 匯入 · 乾跑模擬 + Undo 機制
4. A4 UX · 深色模式 + 手機 Bottom Sheet
5. B5 Visual Diff · 並排呈現 + 時間軸 Timeline
6. D1 ESLint + 移除 `STC.EXE` / `Stc.INI` / `smes_data.json` 等舊檔

### 🏃 Sprint 3(Week 9–12)· 結構性升級
1. B2 進一步拆分:`useScheduleData.js` / `useDiff.js` / `usePrint.js` + React Query
2. B4 RBAC 四級權限(Super Admin / Admin / Editor / Viewer)+ 稽核日誌
3. B3 資料模型升級:多學期 index 統一 + 科目群組 + 班級特殊屬性
4. C1 AI 助手 · 自然語言查詢 POC(Claude API 整合)
5. D3 CSP + Rate Limiting + 敏感欄位加密

---

## 📊 Part 5 — 關鍵指標 (KPI) 追蹤

建議建立以下量化指標,於每季 Review:

| 指標 | v2.11.0 基線 | v2.12.0 現況 | 下一里程碑 |
|:---|:---:|:---:|:---:|
| 排課成功率(無硬性衝突) | ~85% | ~85% | **>98%** |
| 平均演算時間(16 班) | ~15 秒 | ~15 秒 | **<5 秒**(WASM 後) |
| 品質分數平均 | ~970,000 | ~970,000 | **>990,000** |
| **測試數量** | 9 | **127 + 23 rules** ✅ | > 250 |
| **測試覆蓋率(核心)** | ~10% | **88-98%** ✅ | 維持 > 85% |
| **測試覆蓋率(全專案)** | < 5% | ~31% | > 60% |
| **CI workflow** | ❌ 僅 deploy | **✅ lint + test + rules + build** | + E2E Playwright |
| **Rules 測試** | ❌ 無 | **✅ 23 個 passing** | + 跨 collection 整合測試 |
| **`AutoSchedule.jsx` 行數** | 2211 | ~2180(hooks 抽出) | < 1000(進一步拆) |
| **全域狀態管理** | ❌ 純 useState | **✅ Zustand store** | + React Query |
| `alert()` / `confirm()` 使用數 | 111 | 89(關鍵路徑已改) | < 20 |
| 使用者留存率(月活) | ?? | ?? | 建立基線 |
| Lighthouse 分數 | ?? | ?? | 性能 > 90, A11y > 95 |
| 安全性評分(Firebase Advisor) | ?? | Rules 已驗證 | 無嚴重警示 |

---

## 💡 Part 6 — 新功能靈感(Backlog,非緊急)

- 💭 **AI 助教模式**:學生請假 → 自動通知家長 + 記錄缺席
- 💭 **教師公開課預約系統**:同儕觀課排程
- 💭 **場地衝突偵測**:體育館、電腦教室的使用重疊
- 💭 **自動生成值週表**:輪值老師、學生幹部
- 💭 **課表海報產生器**:Canva 風格模板,家長日活動用
- 💭 **家長查詢介面**:用家長 Line 綁定 → 看自己孩子的課表
- 💭 **「如果...會怎樣」沙盒模式**:假設 A 老師離職,系統自動試算替代方案
- 💭 **歷屆課表比較**:跨學年視覺化變化趨勢
- 💭 **智慧提醒**:明天是第一節體育課 → 記得穿運動服

---

## 🚦 Part 7 — v2.12.0 Sprint 後的下一步建議(按投報率排序)

### 🥇 第一優先(本週可做完)

1. **完成剩餘 `alert()` 替換(89 → <20)**
   - `UserManagement.jsx`(7 處)、`ExcelPanel.jsx`(5)、`ExportPanel.jsx`(4)、`SnapshotManager.jsx`(4)、`TeacherWorkloadPanel.jsx`(7)、`PreScheduleManager.jsx`(7)
   - 已有 Toast 系統,批次替換約 2-3 小時

2. **建立 `CHANGELOG.md`**
   - 把 v2.11.0 以前的 commit 整理成版本紀錄
   - 之後每版 release 由 commit message 半自動生成

3. **移除仓库中的舊檔(-~10MB)**
   - `STC.EXE`、`Stc.INI`、`smes_data.json`、`Ys110-1/`、`Ys111-1/`
   - 若有歷史價值則移至 `legacy/` 子目錄

4. **啟用 CI 在 PR 攔截**
   - 到 GitHub Settings → Branches → Add rule:
     - `main` 必須通過 CI 的 `test`, `rules`, `build` 三個 job 才能合併
     - 當前 workflow 已準備好,只差開啟 branch protection

### 🥈 第二優先(下一個 Sprint)

5. **UserManagement.jsx 重構 + 用 useConfirm**
   - 目前有 7 處 `alert/confirm`,改用 Toast 系統後體驗立即提升

6. **ScheduleGrid 元件拆分**
   - 接 zustand store,切斷過深的 prop drilling
   - 把「拖拉」「右鍵選單」「Diff 標示」抽成獨立子元件

7. **補 `ConstraintChecker.js` 測試至 80%+**
   - 目前 51% 是全域覆蓋率最大拖累項
   - 重點補:教師疲勞計算(`_calcTeacherFatigue`)、美勞/社會連堂判斷、教室衝突

8. **E2E Playwright 測試(最關鍵路徑)**
   - 登入 → 開始排課 → 儲存課表 → 匯出 Excel
   - 避免 UI 重大回歸

### 🥉 第三優先(季度目標)

9. **RBAC 四級權限**:Super Admin / Admin / Editor / Viewer + Firestore Rules 對應擴展
10. **AI 助手 POC**:Claude API 整合,自然語言查詢 + 品質報告 AI 總結
11. **WASM 演算法加速**:Rust 重寫 `ConstraintChecker.calculateFitness` → 預期 3-5x
12. **深色模式**:CSS variables + 主題切換 hook

---

## ✅ 驗收檢查(v2.12.0 交付物)

執行下列指令驗證本輪改動:

```bash
# 1. 單元測試全綠
npm run test:run
# → Test Files 12 passed | Tests 127 passed | 23 skipped

# 2. 覆蓋率達標
npm run test:coverage
# → Statements 78%+, Functions 80%+, Lines 79%+

# 3. Production build 通過
npm run build
# → ✓ built in ~9-22s

# 4. Rules 測試(需先啟 emulator)
firebase emulators:exec --only firestore "npm run test:rules"
# → Test Files 1 passed | Tests 23 passed
```

所有指令皆已在 CI 中跑過(`.github/workflows/ci.yml`)。

---

**🎓 願景:讓 SMES 成為全台最好用的國小排課系統,並最終開源 / SaaS 化服務更多學校。**

> 本進度表對應 main @ v2.12.0 狀態  
> 下次更新建議:每完成一個 Sprint 或每季檢視一次
