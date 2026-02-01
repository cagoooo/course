import React, { useState } from 'react';
import { useSemester } from '../contexts/SemesterContext';
import './SemesterSelector.css';

function SemesterSelector() {
    const { semesters, currentSemesterId, currentSemesterName, changeSemester, createSemester, loading } = useSemester();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [newSemId, setNewSemId] = useState('');
    const [newSemName, setNewSemName] = useState('');
    const [copyFrom, setCopyFrom] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    if (loading) return <div className="semester-selector-loading">載入中...</div>;

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newSemId || !newSemName) {
            alert('請填寫完整資訊');
            return;
        }

        // Simple ID validation (e.g., 111-1)
        if (!/^\d{3}-\d$/.test(newSemId)) {
            if (!confirm('學期代碼建議格式為「學年-學期」，例如：111-1。確定要使用目前的格式嗎？')) return;
        }

        setIsCreating(true);
        try {
            await createSemester(newSemId, newSemName, copyFrom || null);
            setShowModal(false);
            alert(`已成功建立學期：${newSemName} (${newSemId})`);
            setNewSemId('');
            setNewSemName('');
            setCopyFrom('');
        } catch (err) {
            alert('建立失敗：' + err.message);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="semester-selector-container">
            <div className="semester-display">
                <span className="semester-label">目前學期:</span>
                <select
                    value={currentSemesterId || ''}
                    onChange={(e) => {
                        if (e.target.value === 'NEW') {
                            setShowModal(true);
                        } else {
                            changeSemester(e.target.value);
                        }
                    }}
                    className="semester-select"
                >
                    {semesters.map(s => (
                        <option key={s.id} value={s.id}>
                            {s.name} ({s.id})
                        </option>
                    ))}
                    <option disabled>──────────</option>
                    <option value="NEW">➕ 建立新學期...</option>
                </select>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="semester-modal-overlay">
                    <div className="semester-modal">
                        <h3>建立新學期</h3>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>學期代碼 (ID)</label>
                                <input
                                    type="text"
                                    placeholder="例如：111-1"
                                    value={newSemId}
                                    onChange={e => setNewSemId(e.target.value)}
                                    required
                                />
                                <small>建議使用「111-1」格式，將作為資料庫索引鍵。</small>
                            </div>

                            <div className="form-group">
                                <label>學期名稱</label>
                                <input
                                    type="text"
                                    placeholder="例如：111學年度第1學期"
                                    value={newSemName}
                                    onChange={e => setNewSemName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>複製資料來源 (選填)</label>
                                <select
                                    value={copyFrom}
                                    onChange={e => setCopyFrom(e.target.value)}
                                >
                                    <option value="">(不複製，建立空白學期)</option>
                                    {semesters.map(s => (
                                        <option key={s.id} value={s.id}>
                                            複製從：{s.name} ({s.id})
                                        </option>
                                    ))}
                                </select>
                                <small>若選擇複製，將自動帶入該學期的教師名單、科目與教室設定。</small>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)} disabled={isCreating}>取消</button>
                                <button type="submit" className="btn-save" disabled={isCreating}>
                                    {isCreating ? '建立中...' : '確認建立'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SemesterSelector;
