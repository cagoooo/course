import React, { useState } from 'react';
import './ImportPreviewModal.css';

/**
 * ImportPreviewModal - 匯入前預覽 & 確認 Modal
 * Props:
 *   isOpen        {boolean}
 *   onClose       {() => void}
 *   matched       {Array}  - parseRequirementsExcel 回傳的 matched 陣列
 *   unmatched     {Array}  - parseRequirementsExcel 回傳的 unmatched 陣列
 *   onConfirm     {(matched) => Promise<void>}  確認匯入的回呼
 */
const ImportPreviewModal = ({ isOpen, onClose, matched = [], unmatched = [], onConfirm }) => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('matched');

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (matched.length === 0) return;
        setLoading(true);
        try {
            await onConfirm(matched);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ipm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ipm-modal">
                {/* Header */}
                <div className="ipm-header">
                    <div className="ipm-header-icon">📥</div>
                    <div className="ipm-header-text">
                        <h2>匯入配課表預覽</h2>
                        <p>請確認資料正確後再按「確認匯入」</p>
                    </div>
                    <button className="ipm-close" onClick={onClose}>✕</button>
                </div>

                {/* Summary Stats */}
                <div className="ipm-stats">
                    <div className="ipm-stat ipm-stat-success">
                        <span className="ipm-stat-icon">✅</span>
                        <span className="ipm-stat-number">{matched.length}</span>
                        <span className="ipm-stat-label">成功配對</span>
                    </div>
                    <div className="ipm-stat ipm-stat-warn">
                        <span className="ipm-stat-icon">⚠️</span>
                        <span className="ipm-stat-number">{unmatched.length}</span>
                        <span className="ipm-stat-label">無法配對</span>
                    </div>
                    <div className="ipm-stat ipm-stat-info">
                        <span className="ipm-stat-icon">⚙️</span>
                        <span className="ipm-stat-number">
                            {matched.filter(m => m.teacherNotFound).length}
                        </span>
                        <span className="ipm-stat-label">教師待指定</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="ipm-tabs">
                    <button
                        className={`ipm-tab ${activeTab === 'matched' ? 'active' : ''}`}
                        onClick={() => setActiveTab('matched')}
                    >
                        ✅ 成功配對（{matched.length}）
                    </button>
                    <button
                        className={`ipm-tab ${activeTab === 'unmatched' ? 'active' : ''}`}
                        onClick={() => setActiveTab('unmatched')}
                    >
                        ⚠️ 無法配對（{unmatched.length}）
                    </button>
                </div>

                {/* Table */}
                <div className="ipm-table-wrapper">
                    {activeTab === 'matched' ? (
                        <table className="ipm-table">
                            <thead>
                                <tr>
                                    <th>列號</th>
                                    <th>班級</th>
                                    <th>科目</th>
                                    <th>教師</th>
                                    <th>節數/週</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matched.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="ipm-empty">無成功配對資料</td>
                                    </tr>
                                ) : matched.map((m, i) => (
                                    <tr key={i} className={m.teacherNotFound ? 'ipm-row-warn' : ''}>
                                        <td className="ipm-row-num">{m.rowNumber}</td>
                                        <td><span className="ipm-tag ipm-tag-class">{m.className}</span></td>
                                        <td><span className="ipm-tag ipm-tag-course">{m.courseName}</span></td>
                                        <td>
                                            {m.teacherNotFound
                                                ? <span className="ipm-badge-warn">⚠️ {m.rawTeacher}（找不到）</span>
                                                : <span className="ipm-badge-ok">✅ {m.teacherName}</span>
                                            }
                                        </td>
                                        <td className="ipm-center">{m.periodsNeeded}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="ipm-table">
                            <thead>
                                <tr>
                                    <th>列號</th>
                                    <th>原始班級</th>
                                    <th>原始科目</th>
                                    <th>原始教師</th>
                                    <th>錯誤原因</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unmatched.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="ipm-empty">🎉 所有資料均成功配對！</td>
                                    </tr>
                                ) : unmatched.map((u, i) => (
                                    <tr key={i} className="ipm-row-error">
                                        <td className="ipm-row-num">{u.rowNumber}</td>
                                        <td>{u.rawClass || '—'}</td>
                                        <td>{u.rawCourse || '—'}</td>
                                        <td>{u.rawTeacher || '—'}</td>
                                        <td><span className="ipm-badge-error">❌ {u.reason}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="ipm-footer">
                    {unmatched.length > 0 && (
                        <p className="ipm-footer-warn">
                            ⚠️ {unmatched.length} 筆資料無法自動配對，匯入後請手動新增。
                        </p>
                    )}
                    <div className="ipm-footer-actions">
                        <button className="ipm-btn-cancel" onClick={onClose} disabled={loading}>
                            取消
                        </button>
                        <button
                            className="ipm-btn-confirm"
                            onClick={handleConfirm}
                            disabled={loading || matched.length === 0}
                        >
                            {loading
                                ? <><span className="ipm-spinner" />處理中...</>
                                : `✅ 確認匯入（${matched.length} 筆）`
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportPreviewModal;
