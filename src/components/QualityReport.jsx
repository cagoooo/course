import { useState } from 'react';
import { ConstraintChecker } from '../algorithms/ConstraintChecker.js';
import './QualityReport.css';

/**
 * QualityReport: 排課品質分析面板
 * 顯示 Top N 扣分項目、教師疲勞警告、整體摘要
 */
export default function QualityReport({ solution, teachers, courses, classrooms }) {
    const [report, setReport] = useState(null);
    const [showAll, setShowAll] = useState(false);

    const handleAnalyze = () => {
        if (!solution || solution.length === 0) return;

        const checker = new ConstraintChecker();
        if (teachers) checker.setTeachers(teachers);
        if (courses) checker.setCourses(courses);
        if (classrooms) checker.setClassrooms(classrooms);

        const result = checker.analyzePenalties(solution);
        setReport(result);
    };

    if (!solution || solution.length === 0) return null;

    const displayPenalties = report?.penalties
        ? (showAll ? report.penalties : report.penalties.slice(0, 15))
        : [];

    return (
        <div className="quality-report">
            <div className="qr-header">
                <h3>📊 排課品質分析</h3>
                {!report && (
                    <button className="btn-analyze" onClick={handleAnalyze}>
                        🔍 分析排課品質
                    </button>
                )}
                {report && (
                    <button className="btn-analyze btn-refresh" onClick={handleAnalyze}>
                        🔄 重新分析
                    </button>
                )}
            </div>

            {report && (
                <>
                    {/* Summary Cards */}
                    <div className="qr-summary">
                        <div className={`qr-card ${report.summary.hard > 0 ? 'card-danger' : 'card-success'}`}>
                            <span className="card-value">{report.summary.hard}</span>
                            <span className="card-label">🔴 嚴重衝突</span>
                        </div>
                        <div className={`qr-card ${report.summary.soft > 0 ? 'card-warning' : 'card-success'}`}>
                            <span className="card-value">{report.summary.soft}</span>
                            <span className="card-label">🟡 軟性扣分</span>
                        </div>
                        <div className={`qr-card ${report.summary.fatigue > 0 ? 'card-warning' : 'card-success'}`}>
                            <span className="card-value">{report.summary.fatigue}</span>
                            <span className="card-label">⚠️ 疲勞警告</span>
                        </div>
                        <div className="qr-card card-info">
                            <span className="card-value">{report.summary.total}</span>
                            <span className="card-label">📋 總計項目</span>
                        </div>
                    </div>

                    {/* Penalty Details */}
                    {displayPenalties.length > 0 ? (
                        <div className="qr-details">
                            <h4>🏷️ 扣分明細（依嚴重程度排序）</h4>
                            <ul className="penalty-list">
                                {displayPenalties.map((p, i) => (
                                    <li key={i} className={`penalty-item severity-${p.severity}`}>
                                        <span className="penalty-desc">{p.description}</span>
                                        <span className="penalty-score">-{p.penalty}</span>
                                    </li>
                                ))}
                            </ul>
                            {report.penalties.length > 15 && !showAll && (
                                <button className="btn-show-all" onClick={() => setShowAll(true)}>
                                    顯示全部 {report.penalties.length} 項 ▼
                                </button>
                            )}
                            {showAll && report.penalties.length > 15 && (
                                <button className="btn-show-all" onClick={() => setShowAll(false)}>
                                    收合 ▲
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="qr-perfect">
                            ✨ 完美課表！沒有發現任何扣分項目。
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
