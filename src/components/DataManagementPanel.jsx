import React, { useState, useEffect } from 'react';
import './DataManagementPanel.css'; // Import the new CSS
import PreScheduleManager from './PreScheduleManager';

function DataManagementPanel({
    classes,
    teachers,
    courses,
    requirements,
    onUpdateRequirements,
    onAddTeacher,
    onDeleteTeacher,
    onAddCourse,
    onUpdateCourse,
    onDeleteCourse,
    onUpdateClassCounts,
    onAssignHomeroom,
    onAutoAssignHomeroom,
    onNavigateToWorkload
}) {
    const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');

    // Class Management State
    const [gradeCounts, setGradeCounts] = useState({});

    // Initialize grade counts from classes
    useEffect(() => {
        const counts = {};
        [1, 2, 3, 4, 5, 6].forEach(g => {
            counts[g] = classes.filter(c => c.grade === g).length;
        });
        setGradeCounts(counts);
    }, [classes]);

    const handleClassCountChange = (grade, count) => {
        setGradeCounts(prev => ({ ...prev, [grade]: count }));
    };

    const applyClassCountChange = (grade) => {
        const current = classes.filter(c => c.grade === grade).length;
        const newCount = gradeCounts[grade];
        if (newCount !== current) {
            if (confirm(`確定要將 ${grade} 年級的班級數量從 ${current} 改為 ${newCount} 嗎？\n這可能會刪除多餘的班級資料！`)) {
                onUpdateClassCounts(grade, newCount);
            }
        }
    };

    // Helper: Days and Periods
    const DAYS = ['一', '二', '三', '四', '五'];
    const PERIODS = [1, 2, 3, 4, 5, 6, 7];

    return (
        <div className="management-panel">


            {/* Class Configuration Section */}
            <div className="panel-row">
                <div className="card" style={{ flex: 1 }}>
                    <div className="card-header-with-action">
                        <h3>🏫 班級與導師設定</h3>
                        <div className="quick-action-btns">
                            <button className="btn btn-primary btn-small" onClick={onAutoAssignHomeroom}>
                                ⚡ 自動分配國語/數學給導師
                            </button>
                        </div>
                    </div>

                    <div className="grade-config-grid">
                        {[1, 2, 3, 4, 5, 6].map(grade => (
                            <div key={grade} className={`grade-card grade-${grade}`}>
                                <div className="grade-header">
                                    <span className="grade-title">{grade} 年級</span>
                                    <div className="grade-controls">
                                        <input
                                            type="number"
                                            min="0" max="20"
                                            value={gradeCounts[grade] || 0}
                                            onChange={(e) => handleClassCountChange(grade, parseInt(e.target.value) || 0)}
                                            className="input-class-count"
                                        />
                                        <span>班</span>
                                        <button
                                            className="btn-small"
                                            onClick={() => applyClassCountChange(grade)}
                                            disabled={gradeCounts[grade] === classes.filter(c => c.grade === grade).length}
                                        >
                                            更新
                                        </button>
                                    </div>
                                </div>
                                <div className="class-list">
                                    {classes.filter(c => c.grade === grade).map(cls => {
                                        const assignedTeacherIds = classes
                                            .filter(c => c.id !== cls.id && c.homeroomTeacherId)
                                            .map(c => c.homeroomTeacherId);

                                        const availableTeachers = teachers.filter(t =>
                                            !assignedTeacherIds.includes(t.id) || t.id === cls.homeroomTeacherId
                                        );

                                        return (
                                            <div key={cls.id} className="class-item">
                                                <span className="class-label">{cls.name}:</span>
                                                <select
                                                    value={cls.homeroomTeacherId || ''}
                                                    onChange={(e) => onAssignHomeroom(cls.id, e.target.value)}
                                                    className="select-teacher"
                                                >
                                                    <option value="">(未設定導師)</option>
                                                    {availableTeachers.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Pre-Schedule Section */}
            <div className="panel-row">
                <PreScheduleManager
                    classes={classes}
                    teachers={teachers}
                    courses={courses}
                    requirements={requirements}
                    onUpdateRequirements={onUpdateRequirements}
                    onNavigateToWorkload={onNavigateToWorkload}
                />
            </div>
        </div >
    );
}

export default DataManagementPanel;
