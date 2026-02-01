import React, { useState, useMemo, useEffect } from 'react';
import TimeSlotGrid from './TimeSlotGrid';
import './TeacherWorkloadPanel.css';

function TeacherWorkloadPanel({
    teachers,
    courses,
    classrooms,
    classes,
    requirements,
    onAddTeacher,
    onUpdateTeacher,
    onDeleteTeacher,
    onAddCourse,
    onUpdateCourse,
    onDeleteCourse,
    onAddClassroom,
    onUpdateClassroom,
    onDeleteClassroom,
    onUpdateRequirements,
    onBatchAddTeachers,
    onBatchAddCourses,
    onBatchAddClassrooms,
    // Controlled props
    selectedTeacherId,
    onSelectTeacher
}) {
    // UI State
    const [activeTab, setActiveTab] = useState('teachers'); // teachers | classrooms | courses
    const [leftPanelSearchTerm, setLeftPanelSearchTerm] = useState('');

    // Editing States
    const [editingTeacherId, setEditingTeacherId] = useState(null);
    const [editName, setEditName] = useState('');
    // Simple edit states for courses/classrooms (using prompts for now or inline later, kept simple for RWD)

    // Allocation Logic State
    const [newAllocation, setNewAllocation] = useState({ classId: '', courseId: '', periods: 1 });
    const [showAllTeachers, setShowAllTeachers] = useState(false);

    // --- Helpers ---
    const renderName = (nameVal) => {
        if (!nameVal) return '';
        if (typeof nameVal === 'string') return nameVal;
        if (typeof nameVal === 'object') return nameVal.name || Object.values(nameVal)[0] || 'Unknown';
        return String(nameVal);
    };

    const getTeacherLabel = (teacherId) => {
        const cls = (classes || []).find(c => c.homeroomTeacherId === teacherId);
        if (cls) return `(${cls.name}導師)`;
        return '';
    };

    // --- Memos ---
    const homeroomTeacherIds = useMemo(() => {
        const ids = new Set();
        (classes || []).forEach(c => {
            if (c.homeroomTeacherId) ids.add(c.homeroomTeacherId);
        });
        return ids;
    }, [classes]);

    // Filter Logic for Lists
    const displayList = useMemo(() => {
        const term = leftPanelSearchTerm.toLowerCase().trim();

        if (activeTab === 'teachers') {
            let list = teachers;
            if (!showAllTeachers) {
                list = list.filter(t => !homeroomTeacherIds.has(t.id));
            }
            if (!term) return list;

            return list.filter(t => {
                const name = renderName(t.name).toLowerCase();
                // Also search by their homeroom class if any
                const cls = classes.find(c => c.homeroomTeacherId === t.id);
                const clsName = cls ? renderName(cls.name).toLowerCase() : '';
                return name.includes(term) || clsName.includes(term);
            });
        }

        if (activeTab === 'classrooms') {
            if (!term) return classrooms;
            return classrooms.filter(c => renderName(c.name).toLowerCase().includes(term));
        }

        if (activeTab === 'courses') {
            if (!term) return courses;
            return courses.filter(c => renderName(c.name).toLowerCase().includes(term));
        }

        return [];
    }, [activeTab, teachers, classrooms, courses, leftPanelSearchTerm, showAllTeachers, homeroomTeacherIds, classes]);

    // Workload Calculation
    const teacherWorkloads = useMemo(() => {
        const workloads = {};
        teachers.forEach(t => {
            workloads[t.id] = { name: renderName(t.name), total: 0, details: [] };
        });

        requirements.forEach(req => {
            if (req.teacherId && workloads[req.teacherId]) {
                const course = courses.find(c => c.id === req.courseId);
                const cls = classes.find(c => c.id === req.classId);
                workloads[req.teacherId].total += (req.periodsNeeded || 0);
                workloads[req.teacherId].details.push({
                    classId: req.classId,
                    className: cls?.name || req.classId,
                    courseId: req.courseId,
                    courseName: course ? renderName(course.name) : '未知科目',
                    periods: req.periodsNeeded
                });
            }
        });
        return workloads;
    }, [teachers, requirements, courses, classes]);

    const listRef = React.useRef(null);

    // Auto-scroll to top when sorting/filtering changes for better UX
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [activeTab, showAllTeachers, leftPanelSearchTerm]);

    // --- Actions ---
    const handleAddAction = () => {
        if (activeTab === 'teachers') {
            const name = prompt('請輸入新教師姓名:');
            if (name) onAddTeacher(name);
        } else if (activeTab === 'classrooms') {
            const name = prompt('請輸入新教室名稱:');
            if (name) onAddClassroom(name);
        } else if (activeTab === 'courses') {
            const name = prompt('請輸入新科目名稱:');
            if (name) onAddCourse(name);
        }
    };

    const handleEditItem = (item) => {
        if (activeTab === 'teachers') {
            setEditName(renderName(item.name));
            setEditingTeacherId(item.id);
        } else if (activeTab === 'classrooms') {
            const newName = prompt('修改教室名稱:', renderName(item.name));
            if (newName) onUpdateClassroom(item.id, { name: newName });
        } else if (activeTab === 'courses') {
            const newName = prompt('修改科目名稱:', renderName(item.name));
            if (newName) onUpdateCourse(item.id, { name: newName });
        }
    };

    const handleDeleteItem = (id) => {
        if (!window.confirm('確定要刪除嗎？這可能會影響現有的排課資料。')) return;

        if (activeTab === 'teachers') onDeleteTeacher(id);
        else if (activeTab === 'classrooms') onDeleteClassroom(id);
        else if (activeTab === 'courses') onDeleteCourse(id);
    };

    // Updates
    const handleUpdateTeacherName = (id) => {
        if (editName.trim()) {
            onUpdateTeacher(id, { name: editName.trim() });
            setEditingTeacherId(null);
        }
    };

    const handleTeacherClassroomChange = (teacherId, classroomId) => {
        onUpdateTeacher(teacherId, { classroomId: classroomId || null });
    };

    // Allocation Handlers
    const handleAddAllocation = () => {
        if (!newAllocation.classId || !newAllocation.courseId) return;

        // Check duplicate
        const exists = requirements.find(r =>
            r.teacherId === selectedTeacherId &&
            r.classId === newAllocation.classId &&
            r.courseId === newAllocation.courseId
        );

        if (exists) {
            const newReqs = requirements.map(r =>
                r === exists ? { ...r, periodsNeeded: r.periodsNeeded + newAllocation.periods } : r
            );
            onUpdateRequirements(newReqs);
        } else {
            const newReq = {
                id: Date.now().toString(),
                teacherId: selectedTeacherId,
                classId: newAllocation.classId,
                courseId: newAllocation.courseId,
                periodsNeeded: newAllocation.periods
            };
            onUpdateRequirements([...requirements, newReq]);
        }
        setNewAllocation(prev => ({ ...prev, courseId: '', periods: 1 }));
    };

    const handleReqChange = (classId, courseId, field, value) => {
        setRequirements(prev => prev.map(r =>
            (r.teacherId === selectedTeacherId && r.classId === classId && r.courseId === courseId)
                ? { ...r, [field]: value } : r
        ));
    };

    const handleRemoveAllocation = (classId, courseId) => {
        setRequirements(prev => prev.filter(r =>
            !(r.teacherId === selectedTeacherId && r.classId === classId && r.courseId === courseId)
        ));
    };

    // Auto-select class if teacher is homeroom
    useEffect(() => {
        if (selectedTeacherId) {
            const cls = classes.find(c => c.homeroomTeacherId === selectedTeacherId);
            if (cls) setNewAllocation(prev => ({ ...prev, classId: cls.id }));
        }
    }, [selectedTeacherId, classes]);

    return (
        <div className="workload-panel">
            <div className="panel-grid">
                {/* --- Left Side --- */}
                <div className="management-side">
                    <div className="management-section">
                        {/* Tab Headers */}
                        <div className="tab-header">
                            <button className={`tab-btn ${activeTab === 'teachers' ? 'active' : ''}`} onClick={() => setActiveTab('teachers')}>教師</button>
                            <button className={`tab-btn ${activeTab === 'classrooms' ? 'active' : ''}`} onClick={() => setActiveTab('classrooms')}>教室</button>
                            <button className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>科目</button>
                        </div>

                        {/* Search & Actions */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                            <div className="search-group" style={{ flex: 1 }}>
                                <input
                                    type="text"
                                    placeholder={`搜尋${activeTab === 'teachers' ? '教師' : activeTab === 'classrooms' ? '教室' : '科目'}...`}
                                    value={leftPanelSearchTerm}
                                    onChange={e => setLeftPanelSearchTerm(e.target.value)}
                                />
                            </div>
                            <button className="btn btn-primary btn-small" onClick={handleAddAction}>+ 新增</button>
                        </div>

                        {activeTab === 'teachers' && (
                            <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                <input type="checkbox" checked={showAllTeachers} onChange={e => setShowAllTeachers(e.target.checked)} />
                                顯示導師 (預設隱藏)
                            </label>
                        )}

                        {/* List Area */}
                        {activeTab === 'teachers' ? (
                            <div className="teacher-list" ref={listRef}>
                                {displayList.map(t => {
                                    const isSelected = selectedTeacherId === t.id;
                                    const workload = teacherWorkloads[t.id]?.total || 0;
                                    const isHomeroom = homeroomTeacherIds.has(t.id);

                                    return (
                                        <div
                                            key={t.id}
                                            className={`teacher-item-complex ${isSelected ? 'active' : ''}`}
                                            onClick={() => onSelectTeacher(t.id)}
                                        >
                                            <div className="teacher-main-info">
                                                <span className="teacher-name">
                                                    {renderName(t.name)}
                                                    {isHomeroom && <span className="homeroom-label">{getTeacherLabel(t.id)}</span>}
                                                </span>
                                                <div className="actions">
                                                    <button onClick={(e) => { e.stopPropagation(); setEditName(renderName(t.name)); setEditingTeacherId(t.id); }}>✎</button>
                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteTeacher(t.id); }}>🗑</button>
                                                </div>
                                            </div>
                                            <div className="teacher-meta-group">
                                                <div className="teacher-classroom-select" onClick={e => e.stopPropagation()}>
                                                    <select
                                                        value={t.classroomId || ''}
                                                        onChange={e => handleTeacherClassroomChange(t.id, e.target.value)}
                                                        className="small-select"
                                                        disabled={isHomeroom}
                                                    >
                                                        <option value="">{isHomeroom ? "班級教室" : "無固定教室"}</option>
                                                        {classrooms.map(c => <option key={c.id} value={c.id}>{renderName(c.name)}</option>)}
                                                    </select>
                                                </div>
                                                <span className={`workload-visual ${workload > 0 ? 'has-workload' : ''}`}>{workload} 節</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="data-list">
                                {displayList.length === 0 && <div className="empty-state-modern" style={{ minHeight: '100px' }}>無資料</div>}
                                {displayList.map(item => (
                                    <div key={item.id} className="list-item-simple">
                                        <span className="list-item-name">{renderName(item.name)}</span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-outline btn-small" onClick={() => handleEditItem(item)}>✎</button>
                                            <button className="btn btn-icon-delete" style={{ width: '24px', height: '24px' }} onClick={() => handleDeleteItem(item.id)}>×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Footer Templates (Only show on specific tabs if needed, or keep generic) */}
                        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <small style={{ color: '#94a3b8' }}>提示: 可從 CSV 匯入整批資料</small>
                            {/* Future: Add import buttons here if requested */}
                        </div>
                    </div>
                </div>

                {/* --- Right Side: Detail --- */}
                <div className="detail-side">
                    {selectedTeacherId ? (
                        <div className="detail-content-wrapper">
                            <div className="detail-header">
                                <div className="detail-title">
                                    {teachers.find(t => t.id === selectedTeacherId)?.name || '教師'}
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b', marginLeft: '8px' }}>配課設定</span>
                                </div>
                                <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                                    共 {teacherWorkloads[selectedTeacherId]?.total || 0} 節
                                </div>
                            </div>

                            <div className="modern-table-container">
                                <table className="workload-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '25%' }}>班級</th>
                                            <th style={{ width: '35%' }}>科目</th>
                                            <th style={{ width: '20%', textAlign: 'center' }}>節數</th>
                                            <th style={{ width: '20%' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teacherWorkloads[selectedTeacherId]?.details.map((d, i) => (
                                            <tr key={i}>
                                                <td>{renderName(d.className)}</td>
                                                <td>
                                                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                                                        {d.courseName}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="number" min="1" max="20"
                                                        value={d.periods}
                                                        onChange={e => handleReqChange(d.classId, d.courseId, 'periodsNeeded', parseInt(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="btn-icon-delete" onClick={() => handleRemoveAllocation(d.classId, d.courseId)}>🗑</button>
                                                </td>
                                            </tr>
                                        ))}

                                        {/* New Row */}
                                        <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                            <td>
                                                <select
                                                    value={newAllocation.classId}
                                                    onChange={e => setNewAllocation({ ...newAllocation, classId: e.target.value })}
                                                    className="small-select"
                                                    style={{ background: 'white' }}
                                                >
                                                    <option value="">選擇班級...</option>
                                                    {classes.map(c => <option key={c.id} value={c.id}>{renderName(c.name)}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    value={newAllocation.courseId}
                                                    onChange={e => setNewAllocation({ ...newAllocation, courseId: e.target.value })}
                                                    className="small-select"
                                                    style={{ background: 'white' }}
                                                >
                                                    <option value="">選擇科目...</option>
                                                    {courses.map(c => <option key={c.id} value={c.id}>{renderName(c.name)}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="number" min="1"
                                                    value={newAllocation.periods}
                                                    onChange={e => setNewAllocation({ ...newAllocation, periods: parseInt(e.target.value) || 1 })}
                                                    style={{ background: 'white' }}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-primary btn-small"
                                                    onClick={handleAddAllocation}
                                                    disabled={!newAllocation.classId || !newAllocation.courseId}
                                                >
                                                    + 新增
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state-modern">
                            <div className="empty-icon">👈</div>
                            <h3>請先從左側選擇一位教師</h3>
                            <p>您可以在此管理該教師的所有配課與節數設定</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Teacher Edit */}
            {editingTeacherId && (
                <div className="modal-overlay" onClick={() => setEditingTeacherId(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>編輯教師: {teachers.find(t => t.id === editingTeacherId)?.name}</h3>
                        <div style={{ margin: '1rem 0' }}>
                            <label>更改姓名:</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>排課時段限制:</label>
                            <TimeSlotGrid
                                unavailableSlots={teachers.find(t => t.id === editingTeacherId)?.unavailableSlots || []}
                                avoidSlots={teachers.find(t => t.id === editingTeacherId)?.avoidSlots || []}
                                onChange={(newUnavailable, newAvoid) => {
                                    onUpdateTeacher(editingTeacherId, {
                                        unavailableSlots: newUnavailable,
                                        avoidSlots: newAvoid
                                    });
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="btn btn-outline" onClick={() => setEditingTeacherId(null)}>取消</button>
                            <button className="btn btn-primary" onClick={() => handleUpdateTeacherName(editingTeacherId)}>儲存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeacherWorkloadPanel;
