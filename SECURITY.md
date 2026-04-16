# 🛡️ Security Policy

本文件紀錄 SMES 專案的安全設計與常見安全 alert 處理原則。

---

## 🔑 Firebase Web API Key 政策

### TL;DR
**Firebase Web API Key 會出現在 build 後的 `dist/assets/*.js` 中,這是正常且不可避免的。**
它不是傳統意義的 secret,不需要試圖藏起來,而是透過 **網域限制 + API 限制 + Firestore Rules** 來保護。

### 為什麼 Firebase API Key 不是 secret
引用自 [Firebase 官方文件](https://firebase.google.com/docs/projects/api-keys):
> *"Firebase API keys are different from typical API keys. Unlike how API keys are typically used, API keys for Firebase services are not used to control access to backend resources; that can only be done with Firebase Security Rules ... and App Check. Because of this, it is OK for these to be publicly exposed."*

### 真正的安全層(而非藏 key)
| 層 | 保護對象 | 專案現況 |
|:---|:---|:---|
| **Firestore Security Rules** | 資料讀寫 | ✅ `firestore.rules` + 23 個 unit tests |
| **Firebase Auth Authorized Domains** | 登入來源限制 | 需在 Firebase Console 設定 |
| **API Key HTTP Referrer Restriction** | 防止 key 被其他網域濫用 | 需在 GCP Console 設定 |
| **API Key API Restriction** | 限制可呼叫的 Google API | 需在 GCP Console 設定 |
| **Firebase App Check**(未啟用) | 對抗濫用與爬蟲 | 🔜 未來升級項目 |

---

## 📋 Secret Scanning Alert 處理標準流程

當 GitHub Secret Scanning 偵測到 `AIza...` 開頭的 key 時:

### ✅ 正確做法

1. **先確認 key 類型**:若是 Firebase Web API Key(Project Settings → Web apps 顯示的那把),此警告屬於預期行為
2. **到 [GCP Console Credentials](https://console.cloud.google.com/apis/credentials)** 確認該 key 有設定:
   - HTTP referrer = 僅 `cagoooo.github.io/course/*` + `localhost`
   - API restrictions = 僅 Identity Toolkit / Firestore / Storage / 其他有用的 Firebase API
3. **Dismiss alert**,選 "Used in tests" 或 "False positive" 並留下 comment
4. 若擔心歷史 key 被記下,執行**金鑰輪替**(見下節)

### ❌ 不要做的事

- ❌ 用 `git filter-repo` / BFG 把歷史 commit 中的 key 砍掉
  - 這把 key 已被 Google / GitHub / archive.org 索引,rewrite 歷史無實際幫助
  - 卻會讓所有 collaborator 的 local clone 壞掉
- ❌ 把 API key 改成從後端 proxy fetch(complicates architecture,獲益有限)
- ❌ 忽略警告不處理 restriction — 這是真正的漏洞

---

## 🔄 Firebase API Key 輪替 SOP

當需要換 key 時(例如確信被主動濫用):

1. **建立新 key**
   - GCP Console → Credentials → **+ CREATE CREDENTIALS → API key**
   - 立刻為新 key 設定 referrer + API restrictions(見上方政策)
2. **更新 CI/CD Secret**
   - GitHub repo → Settings → Secrets and variables → Actions
   - 更新 `VITE_FIREBASE_API_KEY`(其他欄位通常不用換)
3. **更新本地 `.env`**
4. **觸發 deploy**(push 任意 commit 或手動跑 workflow)
5. **驗證上線正常** — 測試登入、讀寫 Firestore
6. **刪除舊 key**(GCP Console,確認沒其他地方用)
7. **Dismiss GitHub alert**,選 "Revoked"

---

## 🧪 Firestore Rules 驗證

本專案 Firestore Security Rules 有 **23 個單元測試**,覆蓋:
- `semesters/*`:read 全開,write 僅 admin
- `users/{uid}`:自讀自寫 + 禁止自我提權(viewer → admin)
- 預設 deny:未定義 collection 全擋
- Firestore fallback admin 識別

執行方式:
```bash
firebase emulators:exec --only firestore "npm run test:rules"
```

CI 會自動跑這些測試(`.github/workflows/ci.yml`),Rules 改動會即時驗證。

---

## 📮 回報安全問題

若發現疑似安全漏洞:
- **不要**開 public issue
- 透過 GitHub repo → Security → **"Report a vulnerability"** 私訊給 maintainer
- 或直接聯絡 repo owner

---

**最後更新:** 2026-04-16  
**對應版本:** v2.12.0
