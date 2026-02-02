# Firestore 手動備份腳本 (Roadmap 8.0 預備)
# 使用方式: 在專案根目錄執行 `powershell scripts\backup-firestore.ps1`

$PROJECT_ID = "cour-e2efd"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BUCKET_NAME = "gs://${PROJECT_ID}-backups"

Write-Host "--- 開始執行 Firestore 備份 ---" -ForegroundColor Cyan
Write-Host "專案 ID: $PROJECT_ID"
Write-Host "備份時間: $TIMESTAMP"
Write-Host "目標空間: $BUCKET_NAME"

# 1. 檢查 GCS Bucket 是否存在，若不存在則建立 (需要 Billing)
# Write-Host "正在確認 Bucket..."
# gsutil mb -p $PROJECT_ID $BUCKET_NAME

# 2. 執行匯出
# 注意：此指令需要專案已啟動 Cloud Firestore API 且具備匯出權限
Write-Host "正在執行匯出指令..." -ForegroundColor Yellow
gcloud firestore export $BUCKET_NAME --project=$PROJECT_ID

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 備份指令已成功送出！" -ForegroundColor Green
    Write-Host "請前往 GCP Console 查看進度：https://console.cloud.google.com/firestore/databases/-default-/import-export"
} else {
    Write-Host "❌ 備份失敗，請檢查 GCP 權限或是否已啟動 Blaze 計畫。" -ForegroundColor Red
}

Write-Host "--- 備份任務結束 ---"
