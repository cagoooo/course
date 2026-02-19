import React, { useState, useEffect, useRef } from 'react';
import { findSubstitutes, periodIndexToLabel } from '../services/SubstituteService';
import './SubstitutePanel.css';

const DAYS = ['週一', '週二', '週三', '週四', '週五'];
const PERIODS = ['第1節', '第2節', '第3節', '第4節', '第5節', '第6節', '第7節'];

/**
 * SubstitutePanel - 智慧代課推薦側邊抽屜
 * Props:
 *   isOpen        {boolean}
 *   onClose       {() => void}
 *   teachers      {Array}   - 全部教師陣列
 *   allSchedules  {Array}   - 全校 schedules
 *   courses       {Array}   - 全部科目（用於顯示科目名稱）
 */
const SubstitutePanel = ({ isOpen, onClose, teachers = [], allSchedules = [], courses = [] }) => {
    const [absentTeacherId, setAbsentTeacherId] = useState('');
    const [selectedDay, setSelectedDay] = useState(0);
    const [selectedPeriod, setSelectedPeriod] = useState(0);
    const [result, setResult] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const panelRef = useRef(null);

    // 關閉時重設狀態
    useEffect(() => {
        if (!isOpen) {
            setResult(null);
            setHasSearched(false);
        }
    }, [isOpen]);

    // 建立科目名稱 Map
    const courseNameMap = new Map(
        courses.map(c => [c.id, typeof c.name === 'string' ? c.name : (c.name?.name || c.id)])
    );

    const handleSearch = () => {
        if (!absentTeacherId) return;
        const periodIndex = selectedDay * 7 + selectedPeriod;
        const res = findSubstitutes(absentTeacherId, periodIndex, allSchedules, teachers);
        setResult(res);
        setHasSearched(true);
    };

    const getTeacherName = (id) => {
        const t = teachers.find(t => t.id === id);
        if (!t) return id;
        return typeof t.name === 'string' ? t.name : (t.name?.name || id);
    };

    const tierConfig = {
        best: { label: '🥇 最佳推薦', color: '#059669', bg: '#d1fae5', border: '#6ee7b7' },
        ok: { label: '✅ 可考慮', color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc' },
        backup: { label: '📌 備選', color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
    };

    if (!isOpen) return null;

    return (
        <div className="sp-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div ref={panelRef} className="sp-panel">
                {/* Header */}
                <div className="sp-header">
                    <div className="sp-header-left">
                        <div className="sp-header-icon">🔁</div>
                        <div>
                            <h3>智慧代課推薦</h3>
                            <p>自動找出最適合的代課老師</p>
                        </div>
                    </div>
                    <button className="sp-close" onClick={onClose}>✕</button>
                </div>

                {/* Search Form */}
                <div className="sp-form">
                    <div className="sp-form-group">
                        <label>缺課教師</label>
                        <select
                            value={absentTeacherId}
                            onChange={e => setAbsentTeacherId(e.target.value)}
                            className="sp-select"
                        >
                            <option value="">— 請選擇教師 —</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>
                                    {typeof t.name === 'string' ? t.name : (t.name?.name || t.id)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sp-form-row">
                        <div className="sp-form-group">
                            <label>星期幾</label>
                            <div className="sp-pill-row">
                                {DAYS.map((d, i) => (
                                    <button
                                        key={d}
                                        className={`sp-pill ${selectedDay === i ? 'active' : ''}`}
                                        onClick={() => setSelectedDay(i)}
                                    >{d}</button>
                                ))}
                            </div>
                        </div>
                        <div className="sp-form-group">
                            <label>第幾節</label>
                            <div className="sp-pill-row">
                                {PERIODS.map((p, i) => (
                                    <button
                                        key={p}
                                        className={`sp-pill ${selectedPeriod === i ? 'active' : ''}`}
                                        onClick={() => setSelectedPeriod(i)}
                                    >{p}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        className="sp-search-btn"
                        onClick={handleSearch}
                        disabled={!absentTeacherId}
                    >
                        🔍 查詢可用代課老師
                    </button>

                    {allSchedules.length === 0 && (
                        <div className="sp-no-schedule-warning">
                            ⚠️ 尚無課表資料，科目相符度無法判斷。<br />
                            <small>請先執行排課演算或從快照載入課表，再使用此功能。</small>
                        </div>
                    )}
                </div>

                {/* Results */}
                {hasSearched && result && (
                    <div className="sp-results">
                        {/* 缺課資訊摘要 */}
                        <div className="sp-absent-info">
                            <span className="sp-absent-tag">
                                ⚠️ {getTeacherName(result.absentInfo.teacherId)}
                            </span>
                            <span className="sp-absent-detail">
                                {periodIndexToLabel(result.absentInfo.periodIndex)}
                                {result.absentInfo.courseId &&
                                    `・${courseNameMap.get(result.absentInfo.courseId) || result.absentInfo.courseId}`
                                }
                                {result.absentInfo.classId && `・${result.absentInfo.classId}`}
                            </span>
                        </div>

                        {result.candidates.length === 0 ? (
                            <div className="sp-empty">
                                <div className="sp-empty-icon">😔</div>
                                <p>目前沒有可用的代課老師</p>
                                <small>該節次所有老師均有課，請改天或手動安排</small>
                            </div>
                        ) : (
                            <>
                                <div className="sp-result-count">
                                    找到 <strong>{result.candidates.length}</strong> 位可能代課老師
                                </div>
                                <div className="sp-candidate-list">
                                    {result.candidates.map((c, i) => {
                                        const cfg = tierConfig[c.tier];
                                        return (
                                            <div
                                                key={c.teacher.id}
                                                className="sp-candidate-card"
                                                style={{
                                                    background: cfg.bg,
                                                    borderColor: cfg.border,
                                                }}
                                            >
                                                <div className="sp-candidate-rank">#{i + 1}</div>
                                                <div className="sp-candidate-info">
                                                    <div className="sp-candidate-name">
                                                        {typeof c.teacher.name === 'string'
                                                            ? c.teacher.name
                                                            : (c.teacher.name?.name || c.teacher.id)}
                                                        <span
                                                            className="sp-candidate-tier"
                                                            style={{ color: cfg.color, background: `${cfg.border}55` }}
                                                        >
                                                            {cfg.label}
                                                        </span>
                                                    </div>
                                                    <div className="sp-candidate-reason" style={{ color: cfg.color }}>
                                                        {c.reason}
                                                    </div>
                                                    <div className="sp-candidate-workload">
                                                        <span>📅 今日</span>
                                                        <strong style={{ margin: '0 4px', color: cfg.color }}>
                                                            {c.dayPeriods}
                                                        </strong>
                                                        <span>節課</span>
                                                        {c.dayPeriods > 0 && (
                                                            <span className="sp-workload-bar">
                                                                {Array.from({ length: 7 }, (_, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className={`sp-workload-dot ${idx < c.dayPeriods ? 'filled' : ''}`}
                                                                        style={idx < c.dayPeriods ? { background: cfg.color } : {}}
                                                                    />
                                                                ))}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Footer hint */}
                <div className="sp-footer">
                    <small>💡 推薦依據：科目相符、當節空堂、今日課少。不自動修改課表，僅供參考。</small>
                </div>
            </div>
        </div>
    );
};

export default SubstitutePanel;
