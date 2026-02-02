import React, { useState, useEffect } from 'react';
import { firestoreService } from '../services/firestoreService';
import './SnapshotManager.css';

const SnapshotManager = ({ currentSchedules, currentRequirements, onRestore, onCompare, onClose }) => {
    const [snapshots, setSnapshots] = useState([]);
    const [newSnapshotName, setNewSnapshotName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadSnapshots();
    }, []);

    const loadSnapshots = async () => {
        setLoading(true);
        try {
            const data = await firestoreService.getSnapshots();
            setSnapshots(data);
        } catch (err) {
            setError('載入快照失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentSchedules || currentSchedules.length === 0) {
            alert('目前無課表資料可存檔');
            return;
        }
        setLoading(true);
        try {
            await firestoreService.createSnapshot(newSnapshotName, currentSchedules, currentRequirements);
            setNewSnapshotName('');
            await loadSnapshots();
            alert('快照儲存成功！');
        } catch (err) {
            console.error('Snapshot save error:', err);
            setError(`儲存快照失敗: ${err.message || '未知錯誤'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('確定要刪除此快照嗎？')) return;
        try {
            await firestoreService.deleteSnapshot(id);
            await loadSnapshots();
        } catch (err) {
            setError('刪除快照失敗');
        }
    };

    return (
        <div className="snapshot-modal-overlay">
            <div className="snapshot-modal">
                <div className="snapshot-header">
                    <h3>排課版本快照管理</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="snapshot-save-section">
                    <input
                        type="text"
                        placeholder="輸入快照名稱 (例如：10/24 穩定版)"
                        value={newSnapshotName}
                        onChange={(e) => setNewSnapshotName(e.target.value)}
                    />
                    <button className="save-btn" onClick={handleSave} disabled={loading}>
                        {loading ? '儲存中...' : '儲存目前版本'}
                    </button>
                </div>

                {error && <div className="snapshot-error">{error}</div>}

                <div className="snapshot-list">
                    <h4>歷史快照</h4>
                    {snapshots.length === 0 ? (
                        <p className="no-snapshots">尚無歷史紀錄</p>
                    ) : (
                        snapshots.map(s => (
                            <div key={s.id} className="snapshot-item">
                                <div className="snapshot-info">
                                    <span className="snapshot-name">{s.name}</span>
                                    <span className="snapshot-date">{new Date(s.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="snapshot-actions">
                                    <button
                                        className="btn-text btn-small"
                                        style={{ marginRight: '8px', color: '#6366f1' }}
                                        onClick={() => {
                                            if (onCompare) {
                                                onCompare(s);
                                                onClose();
                                            }
                                        }}
                                    >
                                        🔍 比對
                                    </button>
                                    <button
                                        className="restore-btn"
                                        onClick={() => {
                                            if (confirm(`確定要還原至「${s.name}」嗎？這將覆蓋目前所有排課進度。`)) {
                                                onRestore(s);
                                                onClose();
                                            }
                                        }}
                                    >
                                        還原
                                    </button>
                                    <button className="delete-btn" onClick={() => handleDelete(s.id)}>刪除</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default SnapshotManager;
