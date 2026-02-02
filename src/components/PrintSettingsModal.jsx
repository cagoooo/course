import React, { useState } from 'react';
import './PrintSettingsModal.css';

const PrintSettingsModal = ({ show, onClose, onConfirm, initialSettings, type }) => {
    const [settings, setSettings] = useState(initialSettings || {
        fontSize: 14,
        paperSize: 'A4',
        layout: 'portrait',
        showTeacherName: true,
        showCourseName: true,
        showClassName: true,
        titleTemplate: type === 'class' ? '{grade}年{name}班 課表' : '{name} 老師課表'
    });

    if (!show) return null;

    const handleConfirm = () => {
        onConfirm(settings);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content print-settings-modal">
                <div className="modal-header">
                    <h2>🖨️ 列印與導出設定</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <div className="settings-section">
                        <h3>基本配置</h3>
                        <div className="form-group">
                            <label>報表標題模板</label>
                            <input
                                type="text"
                                value={settings.titleTemplate}
                                onChange={(e) => setSettings({ ...settings, titleTemplate: e.target.value })}
                                placeholder="例如: {grade}年{name}班 課表"
                            />
                            <p className="hint">可用變數: {'{grade}'}, {'{name}'}</p>
                        </div>

                        <div className="settings-grid">
                            <div className="form-group">
                                <label>紙張規格</label>
                                <select
                                    value={settings.paperSize}
                                    onChange={(e) => setSettings({ ...settings, paperSize: e.target.value })}
                                >
                                    <option value="A4">A4 (標準)</option>
                                    <option value="A3">A3 (大海報)</option>
                                    <option value="B4">B4 (大尺寸)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>版面配置</label>
                                <select
                                    value={settings.layout}
                                    onChange={(e) => setSettings({ ...settings, layout: e.target.value })}
                                >
                                    <option value="portrait">直向 (Portrait)</option>
                                    <option value="landscape">橫向 (Landscape)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>樣式設定</h3>
                        <div className="form-group">
                            <label>內容字體大小 ({settings.fontSize}px)</label>
                            <div className="range-container">
                                <input
                                    type="range"
                                    min="10"
                                    max="32"
                                    step="1"
                                    value={settings.fontSize}
                                    onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                                />
                                <span className="range-value">{settings.fontSize}px</span>
                            </div>
                        </div>

                        <div className="checkbox-group">
                            <label className="checkbox-item">
                                <input
                                    type="checkbox"
                                    checked={settings.showCourseName}
                                    onChange={(e) => setSettings({ ...settings, showCourseName: e.target.checked })}
                                />
                                顯示課程名稱
                            </label>
                            <label className="checkbox-item">
                                <input
                                    type="checkbox"
                                    checked={type === 'class' ? settings.showTeacherName : settings.showClassName}
                                    onChange={(e) => {
                                        if (type === 'class') {
                                            setSettings({ ...settings, showTeacherName: e.target.checked });
                                        } else {
                                            setSettings({ ...settings, showClassName: e.target.checked });
                                        }
                                    }}
                                />
                                {type === 'class' ? '顯示教師姓名' : '顯示班級名稱'}
                            </label>
                        </div>
                    </div>

                    <div className="print-preview-hint">
                        💡 提示：點擊「確認並列印」後，瀏覽器會彈出列印對話框。請在該對話框中將目標設定為「另存為 PDF」即可完成導出。
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>取消</button>
                    <button className="btn btn-primary" onClick={handleConfirm}>確認並列印</button>
                </div>
            </div>
        </div>
    );
};

export default PrintSettingsModal;
