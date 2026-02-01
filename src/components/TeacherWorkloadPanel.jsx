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

    // Helper to determine max periods based on course name
    const getMaxPeriods = (courseId) => {
        const course = courses.find(c => c.id === courseId);
        if (!course) return 20; // Default max
        const name = renderName(course.name);
        if (name.includes('國語')) return 6;
        if (name.includes('數學')) return 4;
        return 20; // Default max for others
    };

    // Helper to get default periods based on course name
    const getDefaultPeriods = (courseId) => {
        const course = courses.find(c => c.id === courseId);
        if (!course) return 1;
        const name = renderName(course.name);
        if (name.includes('國語')) return 6;
        if (name.includes('數學')) return 4;
        return 1;
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
            let list = showAllTeachers
                ? [...teachers]
                : teachers.filter(t => !homeroomTeacherIds.has(t.id));

            // Filter by search term
            if (term) {
                list = list.filter(t => {
                    const name = renderName(t.name).toLowerCase();
                    const cls = classes.find(c => c.homeroomTeacherId === t.id);
                    const clsName = cls ? renderName(cls.name).toLowerCase() : '';
                    return name.includes(term) || clsName.includes(term);
                });
            }

            // Sort: Homeroom (Grade ASC, Class ASC) -> Subject Teachers (Name ASC)
            return list.sort((a, b) => {
                const classA = classes.find(c => c.homeroomTeacherId === a.id);
                const classB = classes.find(c => c.homeroomTeacherId === b.id);

                if (classA && classB) {
                    // Both are homeroom teachers
                    const getGradeClass = (name) => {
                        const match = name.match(/(\d+)年(\d+)班/);
                        if (match) return { g: parseInt(match[1]), c: parseInt(match[2]) };
                        // Fallback for non-standard names (e.g., "特教班")
                        return { g: 99, c: 99 };
                    };
                    const infoA = getGradeClass(classA.name);
                    const infoB = getGradeClass(classB.name);

                    if (infoA.g !== infoB.g) return infoA.g - infoB.g;
                    return infoA.c - infoB.c;
                }

                if (classA) return -1; // A is homeroom, comes first
                if (classB) return 1;  // B is homeroom, comes first

                // Neither are homeroom, sort by name
                return (a.name || '').localeCompare(b.name || '', 'zh-TW');
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

                // Sort details: Chinese -> Math -> Grade/Class
                workloads[req.teacherId].details.sort((a, b) => {
                    const isChineseA = a.courseName.includes('國語');
                    const isChineseB = b.courseName.includes('國語');
                    if (isChineseA && !isChineseB) return -1;
                    if (!isChineseA && isChineseB) return 1;

                    const isMathA = a.courseName.includes('數學');
                    const isMathB = b.courseName.includes('數學');
                    if (isMathA && !isMathB) return -1;
                    if (!isMathA && isMathB) return 1;

                    // Then by Grade/Class logic
                    const getGradeClass = (name) => {
                        const match = name.match(/(\d+)年(\d+)班/);
                        if (match) return { g: parseInt(match[1]), c: parseInt(match[2]) };
                        return { g: 99, c: 99 };
                    };
                    const infoA = getGradeClass(a.className);
                    const infoB = getGradeClass(b.className);
                    if (infoA.g !== infoB.g) return infoA.g - infoB.g;
                    return infoA.c - infoB.c;
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

    // --- Add / Batch Add Logic ---
    const [showAddModal, setShowAddModal] = useState(false);
    const [addMode, setAddMode] = useState('single'); // single | batch
    const [newItemName, setNewItemName] = useState('');
    const [batchInput, setBatchInput] = useState('');

    const openAddModal = () => {
        setNewItemName('');
        setBatchInput('');
        setAddMode('single'); // default
        setShowAddModal(true);
    };

    const handleConfirmAdd = () => {
        if (addMode === 'single') {
            if (!newItemName.trim()) return;
            const name = newItemName.trim();
            if (activeTab === 'teachers') onAddTeacher(name);
            else if (activeTab === 'classrooms') onAddClassroom(name);
            else if (activeTab === 'courses') onAddCourse(name);
        } else {
            if (!batchInput.trim()) return;
            // Split by newline or comma
            const names = batchInput.split(/[,\n]+/).map(k => k.trim()).filter(k => k);
            if (names.length === 0) return;

            if (confirm(`確定要批次新增 ${names.length} 筆資料嗎？`)) {
                if (activeTab === 'teachers' && onBatchAddTeachers) onBatchAddTeachers(names);
                else if (activeTab === 'classrooms' && onBatchAddClassrooms) onBatchAddClassrooms(names);
                else if (activeTab === 'courses' && onBatchAddCourses) onBatchAddCourses(names);
                else {
                    // Fallback if batch prop missing
                    alert("此類別暫不支援批次新增 (缺少 Handler)");
                }
            }
        }
        setShowAddModal(false);
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
        const newReqs = requirements.map(r =>
            (r.teacherId === selectedTeacherId && r.classId === classId && r.courseId === courseId)
                ? { ...r, [field]: value } : r
        );
        onUpdateRequirements(newReqs);
    };

    const handleRemoveAllocation = (classId, courseId) => {
        const newReqs = requirements.filter(r =>
            !(r.teacherId === selectedTeacherId && r.classId === classId && r.courseId === courseId)
        );
        onUpdateRequirements(newReqs);
    };

    // Auto-select class if teacher is homeroom
    useEffect(() => {
        if (selectedTeacherId) {
            const cls = classes.find(c => c.homeroomTeacherId === selectedTeacherId);
            if (cls) setNewAllocation(prev => ({ ...prev, classId: cls.id }));
        }
    }, [selectedTeacherId, classes]);

    // One-click reset for Homeroom teachers' Chinese and Math
    const handleResetHomeroomDefaults = () => {
        if (!window.confirm('⚠️ 確定要執行「導師節數校正」嗎？\n\n這將會為所有導師：\n1. 自動補齊缺少的國語(6節)與數學(4節)\n2. 強制將現有國語設為 6 節、數學設為 4 節\n\n此操作無法復原，確定要繼續？')) return;

        let changedCount = 0;
        let addedCount = 0;

        // 1. Identify Course IDs for Chinese and Math
        const chineseCourse = courses.find(c => renderName(c.name).includes('國語'));
        const mathCourse = courses.find(c => renderName(c.name).includes('數學'));

        if (!chineseCourse && !mathCourse) {
            alert('❌ 找不到「國語」或「數學」科目，無法執行校正。');
            return;
        }

        // 2. Clone current requirements
        let updatedReqs = [...requirements];

        // 3. Helper to update or add requirement
        const ensureRequirement = (teacherId, classId, courseId, targetPeriods) => {
            if (!courseId) return;

            const existingIndex = updatedReqs.findIndex(r =>
                r.teacherId === teacherId &&
                r.classId === classId &&
                r.courseId === courseId
            );

            if (existingIndex !== -1) {
                // Update existing if different
                if (updatedReqs[existingIndex].periodsNeeded !== targetPeriods) {
                    updatedReqs[existingIndex] = { ...updatedReqs[existingIndex], periodsNeeded: targetPeriods };
                    changedCount++;
                }
            } else {
                // Add new
                updatedReqs.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // Unique ID
                    teacherId,
                    classId,
                    courseId,
                    periodsNeeded: targetPeriods
                });
                addedCount++;
            }
        };

        // 4. Iterate through all classes to find homeroom teachers
        classes.forEach(cls => {
            if (cls.homeroomTeacherId && cls.id) {
                // A. CLEANUP: Remove allocations for this teacher in OTHER classes
                // Filter out any reqs where teacherId matches BUT classId is different
                const initialCount = updatedReqs.length;
                updatedReqs = updatedReqs.filter(r =>
                    !(r.teacherId === cls.homeroomTeacherId && r.classId !== cls.id)
                );

                if (updatedReqs.length < initialCount) {
                    changedCount += (initialCount - updatedReqs.length);
                }

                // B. ENSURE: Add/Update Mandarin & Math for their OWN class
                ensureRequirement(cls.homeroomTeacherId, cls.id, chineseCourse?.id, 6);
                ensureRequirement(cls.homeroomTeacherId, cls.id, mathCourse?.id, 4);
            }
        });

        if (changedCount > 0 || addedCount > 0) {
            onUpdateRequirements(updatedReqs);
            alert(`✅ 校正完成！\n- 新增了 ${addedCount} 筆缺漏科目\n- 更新了 ${changedCount} 筆節數設定`);
        } else {
            alert('全面檢查完成：所有導師的國語/數學科目及節數皆已標準，無需變更。');
        }
    };

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
                        {/* Search & Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                            <div className="search-group" style={{ width: '100%' }}>
                                <input
                                    type="text"
                                    placeholder={`搜尋${activeTab === 'teachers' ? '教師' : activeTab === 'classrooms' ? '教室' : '科目'}...`}
                                    value={leftPanelSearchTerm}
                                    onChange={e => setLeftPanelSearchTerm(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={openAddModal}
                                style={{ width: '100%', justifyContent: 'center', fontWeight: 'bold' }}
                            >
                                + 新增 / 批次建立
                            </button>
                        </div>

                        {activeTab === 'teachers' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '6px' }}>
                                    <input type="checkbox" checked={showAllTeachers} onChange={e => setShowAllTeachers(e.target.checked)} />
                                    顯示導師 (預設隱藏)
                                </label>
                                <button
                                    className="btn-text-danger"
                                    onClick={handleResetHomeroomDefaults}
                                    style={{ fontSize: '0.75rem', padding: '2px 6px', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '4px', background: '#fef2f2' }}
                                    title="一鍵將所有導師的國語設為6節、數學設為4節"
                                >
                                    ⚡ 校正節數
                                </button>
                            </div>
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

                        {/* Footer Templates */}
                        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <small style={{ color: '#94a3b8' }}>提示: 批次新增可用逗號或換行分隔</small>
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
                                                        type="number" min="1" max={getMaxPeriods(d.courseId)}
                                                        value={d.periods}
                                                        onChange={e => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            const max = getMaxPeriods(d.courseId);
                                                            if (val <= max) {
                                                                handleReqChange(d.classId, d.courseId, 'periodsNeeded', val);
                                                            }
                                                        }}
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
                                                    onChange={e => {
                                                        const cId = e.target.value;
                                                        const defPeriods = getDefaultPeriods(cId);
                                                        setNewAllocation({ ...newAllocation, courseId: cId, periods: defPeriods });
                                                    }}
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
                                                    max={newAllocation.courseId ? getMaxPeriods(newAllocation.courseId) : 20}
                                                    value={newAllocation.periods}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value) || 1;
                                                        const max = newAllocation.courseId ? getMaxPeriods(newAllocation.courseId) : 20;
                                                        if (val <= max) {
                                                            setNewAllocation({ ...newAllocation, periods: val });
                                                        }
                                                    }}
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

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <h3>新增 {activeTab === 'teachers' ? '教師' : activeTab === 'classrooms' ? '教室' : '科目'}</h3>

                        <div className="form-group">
                            <label>模式</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input type="radio" checked={addMode === 'single'} onChange={() => setAddMode('single')} /> 單筆新增
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input type="radio" checked={addMode === 'batch'} onChange={() => setAddMode('batch')} /> 批次新增
                                </label>
                            </div>
                        </div>

                        {addMode === 'single' ? (
                            <div className="form-group">
                                <label>名稱</label>
                                <input
                                    type="text"
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    placeholder="請輸入名稱"
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <div className="form-group">
                                <label>名稱列表 (用換行或逗號分隔)</label>
                                <textarea
                                    value={batchInput}
                                    onChange={e => setBatchInput(e.target.value)}
                                    placeholder={`例如：\n王小明\n李大華\n陳阿美`}
                                    style={{ width: '100%', height: '120px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    autoFocus
                                />
                                <small style={{ color: '#64748b' }}>一次可貼上多筆資料</small>
                            </div>
                        )}

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>取消</button>
                            <button className="btn-save" onClick={handleConfirmAdd}>確定新增</button>
                        </div>
                    </div>
                </div>
            )}

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
