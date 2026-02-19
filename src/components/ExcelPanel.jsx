import { useState, useRef } from 'react';
import { exportScheduleToExcel, importRequirementsFromExcel } from '../services/ExcelService.js';
import './ExcelPanel.css';

/**
 * ExcelPanel: Excel 匯入/匯出面板
 */
export default function ExcelPanel({
    bestSolution,
    classes,
    teachers,
    courses,
    classrooms,
    onImportRequirements
}) {
    const [exporting, setExporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

    // === Export ===
    const handleExport = async (mode) => {
        if (!bestSolution || bestSolution.length === 0) {
            alert('尚無排課結果可匯出');
            return;
        }
        setExporting(true);
        try {
            const fileName = await exportScheduleToExcel({
                mode,
                bestSolution,
                classes,
                teachers,
                courses,
                classrooms,
                semesterLabel: ''
            });
            alert(`✅ 已下載：${fileName}`);
        } catch (err) {
            console.error('Export error:', err);
            alert('匯出失敗：' + err.message);
        }
        setExporting(false);
    };

    // === Import ===
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setImportResult(null);

        try {
            const result = await importRequirementsFromExcel(file, classes, courses, teachers);
            setImportResult(result);
        } catch (err) {
            console.error('Import error:', err);
            alert('匯入失敗：' + err.message);
        }
        setImporting(false);
        e.target.value = ''; // Reset file input
    };

    const handleConfirmImport = () => {
        if (importResult?.requirements?.length > 0 && onImportRequirements) {
            onImportRequirements(importResult.requirements);
            alert(`✅ 已匯入 ${importResult.requirements.length} 筆排課需求`);
            setImportResult(null);
        }
    };

    return (
        <div className="excel-panel">
            <div className="excel-header">
                <h3>📁 Excel 匯入/匯出</h3>
            </div>

            {/* Export Section */}
            <div className="excel-section">
                <h4>📤 匯出排課結果</h4>
                <p className="section-desc">將排課結果匯出為 Excel 檔案，含列印格式。</p>
                <div className="btn-row">
                    <button
                        className="excel-btn export-class"
                        onClick={() => handleExport('class')}
                        disabled={exporting || !bestSolution?.length}
                    >
                        🏫 班級課表
                    </button>
                    <button
                        className="excel-btn export-teacher"
                        onClick={() => handleExport('teacher')}
                        disabled={exporting || !bestSolution?.length}
                    >
                        👨‍🏫 教師課表
                    </button>
                </div>
                {exporting && <p className="status-text">⏳ 正在產生 Excel 檔案...</p>}
            </div>

            {/* Import Section */}
            <div className="excel-section">
                <h4>📥 匯入配課表</h4>
                <p className="section-desc">
                    從 Excel 讀取配課需求（欄位需包含：班級、科目、教師、節數）
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
                <button
                    className="excel-btn import-btn"
                    onClick={handleImportClick}
                    disabled={importing}
                >
                    {importing ? '⏳ 解析中...' : '📂 選擇 Excel 檔案'}
                </button>
            </div>

            {/* Import Preview */}
            {importResult && (
                <div className="import-preview">
                    <h4>📋 匯入預覽</h4>

                    {/* Stats */}
                    <div className="import-stats">
                        <span className="stat-badge stat-success">
                            ✅ 成功配對 {importResult.stats.matchedRows} 筆
                        </span>
                        {importResult.stats.failedRows > 0 && (
                            <span className="stat-badge stat-fail">
                                ❌ 未配對 {importResult.stats.failedRows} 筆
                            </span>
                        )}
                        <span className="stat-badge stat-info">
                            📄 掃描 {importResult.stats.sheetsScanned} 個工作表
                        </span>
                    </div>

                    {/* Warnings */}
                    {importResult.warnings.length > 0 && (
                        <div className="import-warnings">
                            <h5>⚠️ 警告 ({importResult.warnings.length})</h5>
                            <ul>
                                {importResult.warnings.slice(0, 10).map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                                {importResult.warnings.length > 10 && (
                                    <li>...還有 {importResult.warnings.length - 10} 筆警告</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* Requirements Preview Table */}
                    {importResult.requirements.length > 0 && (
                        <>
                            <div className="import-table-wrapper">
                                <table className="import-table">
                                    <thead>
                                        <tr>
                                            <th>班級</th>
                                            <th>科目</th>
                                            <th>教師</th>
                                            <th>節數</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importResult.requirements.slice(0, 20).map((r, i) => (
                                            <tr key={i}>
                                                <td>{r.className}</td>
                                                <td>{r.courseName}</td>
                                                <td>{r.teacherName}</td>
                                                <td>{r.periodsNeeded}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {importResult.requirements.length > 20 && (
                                    <p className="more-text">...共 {importResult.requirements.length} 筆</p>
                                )}
                            </div>
                            <div className="import-actions">
                                <button className="excel-btn confirm-btn" onClick={handleConfirmImport}>
                                    ✅ 確認匯入
                                </button>
                                <button className="excel-btn cancel-btn" onClick={() => setImportResult(null)}>
                                    ❌ 取消
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
