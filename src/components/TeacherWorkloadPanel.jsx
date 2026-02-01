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
    onCleanupDuplicateCourses,
    onRepairRequirements,
    // Controlled props
    selectedTeacherId,
    onSelectTeacher
}) {
    const [newTeacherName, setNewTeacherName] = useState('');
    const [editingTeacherId, setEditingTeacherId] = useState(null);
    const [editName, setEditName] = useState('');
    const [newCourseName, setNewCourseName] = useState('');
    const [newClassroomName, setNewClassroomName] = useState('');
    const [newAllocation, setNewAllocation] = useState({ classId: '', courseId: '', periods: 1 });
    const [showAllTeachers, setShowAllTeachers] = useState(false);
    const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
    const [classroomSearchTerm, setClassroomSearchTerm] = useState('');
    const [courseSearchTerm, setCourseSearchTerm] = useState('');

    // Helper to safely render name (handle object vs string legacy data)
    const renderName = (nameVal) => {
        if (!nameVal) return '';
        if (typeof nameVal === 'string') return nameVal;
        if (typeof nameVal === 'object') return nameVal.name || Object.values(nameVal)[0] || 'Unknown';
        return String(nameVal);
    };

    // Helper to get detailed label
    const getTeacherLabel = (teacherId) => {
        const cls = (classes || []).find(c => c.homeroomTeacherId === teacherId);
        if (cls) return `(${cls.name}導師)`;
        return '';
    };

    // Identify which teachers are already homeroom teachers
    const homeroomTeacherIds = useMemo(() => {
        const ids = new Set();
        (classes || []).forEach(c => {
            if (c.homeroomTeacherId) ids.add(c.homeroomTeacherId);
        });
        return ids;
    }, [classes]);

    const displayTeachers = useMemo(() => {
        let list = teachers;
        if (!showAllTeachers) {
            list = teachers.filter(t => !homeroomTeacherIds.has(t.id));
        }

        // Map teacherId to class info for sorting and display
        const teacherClassMap = {};
        (classes || []).forEach(c => {
            if (c.homeroomTeacherId) {
                teacherClassMap[c.homeroomTeacherId] = c;
            }
        });

        // Filter by search term
        if (teacherSearchTerm.trim()) {
            const term = teacherSearchTerm.toLowerCase().trim();
            list = list.filter(t => {
                const name = renderName(t.name).toLowerCase();
                const homeroomCls = teacherClassMap[t.id];
                const className = homeroomCls ? renderName(homeroomCls.name).toLowerCase() : '';
                return name.includes(term) || className.includes(term);
            });
        }

        return [...list].sort((a, b) => {
            const classA = teacherClassMap[a.id];
            const classB = teacherClassMap[b.id];

            // 1. Homeroom teachers first
            if (classA && !classB) return -1;
            if (!classA && classB) return 1;

            // 2. Sort by Grade then ClassNum for homeroom teachers
            if (classA && classB) {
                if (classA.grade !== classB.grade) return classA.grade - classB.grade;
                return (classA.classNum || 0) - (classB.classNum || 0);
            }

            // 3. Sort by Name for others
            return a.name.localeCompare(b.name, 'zh-TW');
        });
    }, [teachers, homeroomTeacherIds, showAllTeachers, classes, teacherSearchTerm]);

    // Find the class this teacher heads (if any)
    const homeroomClass = useMemo(() => {
        return (classes || []).find(c => c.homeroomTeacherId === selectedTeacherId);
    }, [classes, selectedTeacherId]);

    // Auto-populate classId when selecting a teacher
    useEffect(() => {
        if (homeroomClass) {
            setNewAllocation(prev => ({ ...prev, classId: homeroomClass.id }));
        }
    }, [homeroomClass]);

    // Proactive Auto-Fix Academic Limits
    useEffect(() => {
        if (!requirements || requirements.length === 0) return;

        let needFix = false;
        const fixedReqs = requirements.map(r => {
            if (!r.teacherId) return r;
            const validated = getValidatedPeriods(r.teacherId, r.classId, r.courseId, r.periodsNeeded);
            if (validated !== r.periodsNeeded) {
                needFix = true;
                return { ...r, periodsNeeded: validated };
            }
            return r;
        });

        if (needFix) {
            console.log('Detecting and fixing academic limit violations...');
            onUpdateRequirements(fixedReqs);
        }
    }, [requirements, classes, courses]); // Run when data changes

    const handleQuickSetCourse = (keywords) => {
        const found = courses.find(c => {
            const cName = renderName(c.name);
            return keywords.some(k => cName === k || cName.includes(k));
        });
        if (found) {
            // Auto-set class if teacher is a homeroom teacher
            const hClass = (classes || []).find(c => c.homeroomTeacherId === selectedTeacherId);
            setNewAllocation(prev => ({
                ...prev,
                courseId: found.id,
                classId: hClass ? hClass.id : prev.classId
            }));
        }
    };

    // Calculate workload for all teachers
    const teacherWorkloads = useMemo(() => {
        const workloads = {};
        teachers.forEach(t => {
            workloads[t.id] = {
                name: renderName(t.name),
                total: 0,
                details: []
            };
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
                    courseName: course ? renderName(course.name) : `[未知ID: ${req.courseId}]`,
                    isMissing: !course,
                    periods: req.periodsNeeded
                });
            }
        });

        return workloads;
    }, [teachers, requirements, courses, classes]);

    // Get unique courses by name (for display)
    const uniqueCourses = useMemo(() => {
        const seen = new Set();
        return (courses || []).filter(c => {
            const name = renderName(c.name);
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
    }, [courses]);

    // Filtered Classrooms
    const displayClassrooms = useMemo(() => {
        if (!classroomSearchTerm.trim()) return classrooms;
        const term = classroomSearchTerm.toLowerCase().trim();
        return classrooms.filter(c => renderName(c.name).toLowerCase().includes(term));
    }, [classrooms, classroomSearchTerm]);

    // Filtered Courses
    const displayCourses = useMemo(() => {
        if (!courseSearchTerm.trim()) return uniqueCourses;
        const term = courseSearchTerm.toLowerCase().trim();
        return uniqueCourses.filter(c => renderName(c.name).toLowerCase().includes(term));
    }, [uniqueCourses, courseSearchTerm]);

    // Count duplicates
    const duplicateCount = (courses || []).length - uniqueCourses.length;

    // Course Editing State
    const [editingCourseId, setEditingCourseId] = useState(null);
    const [editCourseName, setEditCourseName] = useState('');

    // Classroom Editing State
    const [editingClassroomId, setEditingClassroomId] = useState(null);
    const [editClassroomName, setEditClassroomName] = useState('');

    // Teacher Management
    const handleAddTeacher = () => {
        if (!newTeacherName.trim()) return;
        onAddTeacher(newTeacherName.trim());
        setNewTeacherName('');
    };

    const handleUpdateTeacher = (id) => {
        if (!editName.trim()) return;
        onUpdateTeacher(id, { name: editName.trim() });
        setEditingTeacherId(null);
    };

    const handleTeacherClassroomChange = (id, classroomId) => {
        onUpdateTeacher(id, { classroomId: classroomId || null });
    };

    // Course Management
    const handleAddCourse = () => {
        if (!newCourseName.trim()) return;
        onAddCourse(newCourseName.trim());
        setNewCourseName('');
    };

    const handleUpdateCourseName = (id) => {
        if (!editCourseName.trim()) return;
        onUpdateCourse(id, { name: editCourseName.trim() });
        setEditingCourseId(null);
    };

    // Classroom Management
    const handleAddClassroom = () => {
        if (!newClassroomName.trim()) return;
        onAddClassroom(newClassroomName.trim());
        setNewClassroomName('');
    };

    const handleUpdateClassroomName = (id) => {
        if (!editClassroomName.trim()) return;
        onUpdateClassroom(id, { name: editClassroomName.trim() });
        setEditingClassroomId(null);
    };

    // --- CSV Utilities ---
    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return []; // Need header + at least 1 data row

        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values[0]) { // First column must have value
                const row = {};
                headers.forEach((h, idx) => {
                    row[h] = values[idx] || '';
                });
                data.push(row);
            }
        }
        return data;
    };

    const downloadCSV = (filename, content) => {
        const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
        const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    // --- Template Downloads ---
    const handleDownloadTeacherTemplate = () => {
        const content = '姓名,專科教室\n王小明,電腦教室\n李老師,音樂教室\n張老師,';
        downloadCSV('teachers_template.csv', content);
    };

    const handleDownloadClassroomTemplate = () => {
        const content = '教室名稱\n電腦教室\n音樂教室\n美術教室\n自然教室';
        downloadCSV('classrooms_template.csv', content);
    };

    const handleDownloadCourseTemplate = () => {
        const content = '科目名稱\n國語\n數學\n英語\n自然\n社會';
        downloadCSV('courses_template.csv', content);
    };

    // --- Batch Import Handlers ---
    const handleImportTeachers = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const data = parseCSV(text);

        if (data.length === 0) {
            alert('CSV 檔案格式錯誤或無資料');
            return;
        }

        // Map classroom names to IDs
        const teachersToAdd = data.map(row => {
            const name = row['姓名'] || row['name'] || Object.values(row)[0];
            const classroomName = row['專科教室'] || row['classroom'] || '';
            const classroom = classrooms.find(c => c.name === classroomName);
            return { name, classroomId: classroom?.id || null };
        }).filter(t => t.name);

        if (teachersToAdd.length === 0) {
            alert('未找到有效的教師資料');
            return;
        }

        try {
            await onBatchAddTeachers(teachersToAdd);
            alert(`成功匯入 ${teachersToAdd.length} 位教師`);
        } catch (err) {
            alert('匯入失敗: ' + err.message);
        }
        e.target.value = ''; // Reset file input
    };

    const handleImportClassrooms = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const data = parseCSV(text);

        if (data.length === 0) {
            alert('CSV 檔案格式錯誤或無資料');
            return;
        }

        const classroomsToAdd = data.map(row => {
            const name = row['教室名稱'] || row['name'] || Object.values(row)[0];
            return { name };
        }).filter(c => c.name);

        if (classroomsToAdd.length === 0) {
            alert('未找到有效的教室資料');
            return;
        }

        try {
            await onBatchAddClassrooms(classroomsToAdd);
            alert(`成功匯入 ${classroomsToAdd.length} 間教室`);
        } catch (err) {
            alert('匯入失敗: ' + err.message);
        }
        e.target.value = '';
    };

    const handleImportCourses = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const data = parseCSV(text);

        if (data.length === 0) {
            alert('CSV 檔案格式錯誤或無資料');
            return;
        }

        const coursesToAdd = data.map(row => {
            const name = row['科目名稱'] || row['name'] || Object.values(row)[0];
            return { name };
        }).filter(c => c.name);

        if (coursesToAdd.length === 0) {
            alert('未找到有效的科目資料');
            return;
        }

        try {
            await onBatchAddCourses(coursesToAdd);
            alert(`成功匯入 ${coursesToAdd.length} 個科目`);
        } catch (err) {
            alert('匯入失敗: ' + err.message);
        }
        e.target.value = '';
    };

    // Allocation Management
    const getValidatedPeriods = (teacherId, classId, courseId, periods) => {
        if (!teacherId || !classId || !courseId) return periods;

        const cls = (classes || []).find(c => c.id === classId);
        const isHomeroom = cls && cls.homeroomTeacherId === teacherId;
        if (!isHomeroom) return periods;

        const course = (courses || []).find(c => c.id === courseId);
        if (!course) return periods;

        const name = renderName(course.name);
        if (name.includes('數')) return Math.min(periods, 4);
        if (name.includes('國') || name.includes('語')) return Math.min(periods, 6);

        return periods;
    };

    const handleReqChange = (classId, courseId, field, value) => {
        let finalValue = value;
        if (field === 'periodsNeeded') {
            finalValue = getValidatedPeriods(selectedTeacherId, classId, courseId, value);
        }

        const newReqs = requirements.map(r => {
            if (r.classId === classId && r.courseId === courseId && r.teacherId === selectedTeacherId) {
                return { ...r, [field]: finalValue };
            }
            return r;
        });
        onUpdateRequirements(newReqs);
    };

    const handleAddAllocation = () => {
        if (!newAllocation.classId || !newAllocation.courseId) {
            alert('請選擇班級和科目');
            return;
        }

        const validatedPeriods = getValidatedPeriods(selectedTeacherId, newAllocation.classId, newAllocation.courseId, newAllocation.periods || 1);

        // Check if allocation already exists for this teacher + class + course
        const existingIndex = requirements.findIndex(r =>
            r.classId === newAllocation.classId &&
            r.courseId === newAllocation.courseId &&
            r.teacherId === selectedTeacherId
        );

        if (existingIndex !== -1) {
            // Merge: add periods to existing allocation
            const newReqs = requirements.map((r, idx) => {
                if (idx === existingIndex) {
                    const mergedVal = (r.periodsNeeded || 0) + validatedPeriods;
                    return {
                        ...r,
                        periodsNeeded: getValidatedPeriods(selectedTeacherId, r.classId, r.courseId, mergedVal)
                    };
                }
                return r;
            });
            onUpdateRequirements(newReqs);
        } else {
            // Create new allocation
            const newReq = {
                classId: newAllocation.classId,
                courseId: newAllocation.courseId,
                teacherId: selectedTeacherId,
                periodsNeeded: validatedPeriods
            };
            onUpdateRequirements([...requirements, newReq]);
        }
        setNewAllocation({ classId: '', courseId: '', periods: 1 });
    };

    const handleRemoveAllocation = (classId, courseId) => {
        const newReqs = requirements.filter(r => !(r.classId === classId && r.courseId === courseId && r.teacherId === selectedTeacherId));
        onUpdateRequirements(newReqs);
    };

    // Merge duplicate allocations for selected teacher
    const handleMergeDuplicates = () => {
        const mergedMap = new Map(); // key: classId-courseId-teacherId, value: merged req
        const otherReqs = [];

        requirements.forEach(r => {
            if (r.teacherId === selectedTeacherId) {
                const key = `${r.classId}-${r.courseId}-${r.teacherId}`;
                if (mergedMap.has(key)) {
                    const existing = mergedMap.get(key);
                    const newVal = (existing.periodsNeeded || 0) + (r.periodsNeeded || 0);
                    existing.periodsNeeded = getValidatedPeriods(r.teacherId, r.classId, r.courseId, newVal);
                } else {
                    mergedMap.set(key, { ...r });
                }
            } else {
                otherReqs.push(r);
            }
        });

        const mergedReqs = [...otherReqs, ...mergedMap.values()];

        if (mergedReqs.length < requirements.length) {
            onUpdateRequirements(mergedReqs);
            alert(`已合併 ${requirements.length - mergedReqs.length} 筆重複配課`);
        } else {
            alert('沒有找到重複的配課');
        }
    };

    // Check for duplicates for current teacher
    const currentTeacherDuplicates = useMemo(() => {
        if (!selectedTeacherId) return 0;
        const seen = new Set();
        let dupCount = 0;
        requirements.forEach(r => {
            if (r.teacherId === selectedTeacherId) {
                const key = `${r.classId}-${r.courseId}`;
                if (seen.has(key)) {
                    dupCount++;
                } else {
                    seen.add(key);
                }
            }
        });
        return dupCount;
    }, [requirements, selectedTeacherId]);

    // --- Academic Limits Auto-Fix ---
    const handleAutoFixAcademicLimits = () => {
        let fixCount = 0;
        const newReqs = requirements.map(r => {
            if (!r.teacherId) return r;

            // Identify if this teacher is the homeroom teacher for the class
            const cls = classes.find(c => c.id === r.classId);
            const isHomeroomAction = cls && cls.homeroomTeacherId === r.teacherId;

            if (!isHomeroomAction) return r;

            const course = courses.find(c => c.id === r.courseId);
            if (!course) return r;

            const name = renderName(course.name);
            let limit = null;
            let label = '';

            if (name.includes('數')) {
                limit = 4;
                label = '數學';
            } else if (name.includes('國') || name.includes('語')) {
                limit = 6;
                label = '國語';
            }

            if (limit !== null && r.periodsNeeded > limit) {
                fixCount++;
                return { ...r, periodsNeeded: limit };
            }
            return r;
        });

        if (fixCount > 0) {
            onUpdateRequirements(newReqs);
            alert(`成功修復 ${fixCount} 筆超標配課：\n- 導師數學上限 4 節\n- 導師國語上限 6 節`);
        } else {
            alert('檢查完成！目前所有導師的數學與國語節數均符合規範。');
        }
    };

    return (
        <div className="workload-panel">
            <div className="panel-grid">
                {/* Left side: Teacher & Course Management */}
                <div className="management-side">
                    <div className="management-section card">
                        <h3>👨‍🏫 教師與專科教室綁定</h3>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="新增教師姓名"
                                value={newTeacherName}
                                onChange={e => setNewTeacherName(e.target.value)}
                            />
                            <button className="btn btn-primary" onClick={handleAddTeacher}>新增</button>
                        </div>

                        <div className="search-group" style={{ marginBottom: '1rem', position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="🔍 搜尋姓名或班級..."
                                value={teacherSearchTerm}
                                onChange={e => setTeacherSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    paddingLeft: '30px',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '0.9rem'
                                }}
                            />
                            {teacherSearchTerm && (
                                <button
                                    onClick={() => setTeacherSearchTerm('')}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: '#999',
                                        cursor: 'pointer',
                                        fontSize: '1.2rem',
                                        padding: '0 4px'
                                    }}
                                    title="清除搜尋"
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        <div className="batch-actions">
                            <button className="btn btn-outline" onClick={handleDownloadTeacherTemplate}>📥 下載範本</button>
                            <label className="btn btn-outline">
                                📤 批次匯入
                                <input type="file" accept=".csv" onChange={handleImportTeachers} hidden />
                            </label>
                        </div>
                        <div className="teacher-list-controls" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="checkbox"
                                    checked={showAllTeachers}
                                    onChange={e => setShowAllTeachers(e.target.checked)}
                                />
                                顯示所有教師 (包含導師)
                            </label>
                        </div>
                        <div className="teacher-list">
                            {displayTeachers.length === 0 ? (
                                <div style={{
                                    padding: '20px',
                                    textAlign: 'center',
                                    color: '#666',
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <span style={{ fontSize: '1.5rem' }}>🔍</span>
                                    查無符合條件的教師
                                    {teacherSearchTerm && (
                                        <button
                                            className="btn btn-outline btn-small"
                                            onClick={() => setTeacherSearchTerm('')}
                                            style={{ marginTop: '5px' }}
                                        >
                                            清除搜尋條件
                                        </button>
                                    )}
                                </div>
                            ) : (
                                displayTeachers.map(t => {
                                    const isHomeroom = homeroomTeacherIds.has(t.id);
                                    return (
                                        <div
                                            key={t.id}
                                            className={`teacher-item-complex ${selectedTeacherId === t.id ? 'active' : ''} ${isHomeroom ? 'is-homeroom' : ''}`}
                                            onClick={() => onSelectTeacher(t.id)}
                                        >
                                            <div className="teacher-main-info">
                                                <div className="teacher-info-group">
                                                    <span className="teacher-name">{renderName(t.name)}</span>
                                                    {isHomeroom && (
                                                        <span className="homeroom-label">
                                                            {getTeacherLabel(t.id)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="teacher-meta-group">
                                                    <span className="workload-badge">{teacherWorkloads[t.id]?.total || 0} 節</span>
                                                    <div className="actions">
                                                        <button onClick={(e) => { e.stopPropagation(); setEditingTeacherId(t.id); setEditName(renderName(t.name)); }} title="編輯名稱">✎</button>
                                                        <button onClick={(e) => { e.stopPropagation(); onDeleteTeacher(t.id); }} title="刪除教師">🗑</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="teacher-classroom-select" onClick={e => e.stopPropagation()}>
                                                <select
                                                    value={t.classroomId || ''}
                                                    onChange={e => handleTeacherClassroomChange(t.id, e.target.value)}
                                                    className="small-select"
                                                    disabled={isHomeroom}
                                                    title={isHomeroom ? "班導師固定於班級教室" : ""}
                                                >
                                                    <option value="">{isHomeroom ? "(固定於班級教室)" : "(無固定教室)"}</option>
                                                    {classrooms.map(clr => (
                                                        <option key={clr.id} value={clr.id}>{renderName(clr.name)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="management-section card">
                        <h3>🏢 專科教室管理</h3>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="新增教室名稱 (如: 電腦教室)"
                                value={newClassroomName}
                                onChange={e => setNewClassroomName(e.target.value)}
                            />
                            <button className="btn btn-primary" onClick={handleAddClassroom}>新增</button>
                        </div>
                        <div className="batch-actions">
                            <button className="btn btn-outline" onClick={handleDownloadClassroomTemplate}>📥 下載範本</button>
                            <label className="btn btn-outline">
                                📤 批次匯入
                                <input type="file" accept=".csv" onChange={handleImportClassrooms} hidden />
                            </label>
                        </div>

                        <div className="search-group" style={{ marginBottom: '1rem', position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="🔍 搜尋教室名稱..."
                                value={classroomSearchTerm}
                                onChange={e => setClassroomSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    paddingLeft: '30px',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '0.85rem'
                                }}
                            />
                            {classroomSearchTerm && (
                                <button
                                    onClick={() => setClassroomSearchTerm('')}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: '#999',
                                        cursor: 'pointer',
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        <div className="scroll-list">
                            {displayClassrooms.length === 0 ? (
                                <div className="empty-msg" style={{ padding: '15px', color: '#999' }}>查無搜尋結果</div>
                            ) : (
                                displayClassrooms.map(c => (
                                    <div key={c.id} className="course-item">
                                        {editingClassroomId === c.id ? (
                                            <div className="editing-row" style={{ display: 'flex', gap: '4px', flex: 1 }}>
                                                <input
                                                    type="text"
                                                    value={editClassroomName}
                                                    onChange={e => setEditClassroomName(e.target.value)}
                                                    autoFocus
                                                    className="edit-input"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleUpdateClassroomName(c.id);
                                                        if (e.key === 'Escape') setEditingClassroomId(null);
                                                    }}
                                                />
                                                <button className="btn-confirm" onClick={() => handleUpdateClassroomName(c.id)}>✓</button>
                                                <button className="btn-cancel" onClick={() => setEditingClassroomId(null)}>✕</button>
                                            </div>
                                        ) : (
                                            <>
                                                <span
                                                    onClick={() => { setEditingClassroomId(c.id); setEditClassroomName(renderName(c.name)); }}
                                                    style={{ cursor: 'pointer', flex: 1 }}
                                                    title="點擊編輯名稱"
                                                >
                                                    {renderName(c.name)}
                                                </span>
                                                <button onClick={() => { setEditingClassroomId(c.id); setEditClassroomName(renderName(c.name)); }} style={{ marginRight: '4px', color: '#666' }}>✎</button>
                                                <button onClick={() => onDeleteClassroom(c.id)}>🗑</button>
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="management-section card">
                        <div className="card-header-with-action" style={{ marginBottom: '1rem' }}>
                            <h3>📚 科目管理</h3>
                            <button
                                className="btn btn-primary btn-small"
                                onClick={onRepairRequirements}
                                title="修復顯示為數字的科目 ID 連結"
                            >
                                🔧 一鍵修復配課
                            </button>
                            <button
                                className="btn btn-primary btn-small"
                                onClick={handleAutoFixAcademicLimits}
                                title="自動修正導師數學(4節)與國語(6節)上限"
                                style={{ background: '#6366f1' }}
                            >
                                🎓 修正導師學科上限
                            </button>
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="新增科目名稱"
                                value={newCourseName}
                                onChange={e => setNewCourseName(e.target.value)}
                            />
                            <button className="btn btn-primary" onClick={handleAddCourse}>新增</button>
                        </div>
                        <div className="batch-actions">
                            <button className="btn btn-outline" onClick={handleDownloadCourseTemplate}>📥 下載範本</button>
                            <label className="btn btn-outline">
                                📤 批次匯入
                                <input type="file" accept=".csv" onChange={handleImportCourses} hidden />
                            </label>
                            {duplicateCount > 0 && (
                                <button
                                    className="btn btn-outline btn-warning"
                                    onClick={onCleanupDuplicateCourses}
                                >
                                    🧹 清除 {duplicateCount} 筆重複
                                </button>
                            )}
                        </div>

                        <div className="search-group" style={{ marginBottom: '1rem', position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="🔍 搜尋科目名稱..."
                                value={courseSearchTerm}
                                onChange={e => setCourseSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    paddingLeft: '30px',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    fontSize: '0.85rem'
                                }}
                            />
                            {courseSearchTerm && (
                                <button
                                    onClick={() => setCourseSearchTerm('')}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: '#999',
                                        cursor: 'pointer',
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        <div className="scroll-list">
                            {displayCourses.length === 0 ? (
                                <div className="empty-msg" style={{ padding: '15px', color: '#999' }}>查無搜尋結果</div>
                            ) : (
                                displayCourses.map(c => (
                                    <div key={c.id} className="course-item">
                                        {editingCourseId === c.id ? (
                                            <div className="editing-row" style={{ display: 'flex', gap: '4px', flex: 1 }}>
                                                <input
                                                    type="text"
                                                    value={editCourseName}
                                                    onChange={e => setEditCourseName(e.target.value)}
                                                    autoFocus
                                                    className="edit-input"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleUpdateCourseName(c.id);
                                                        if (e.key === 'Escape') setEditingCourseId(null);
                                                    }}
                                                />
                                                <button className="btn-confirm" onClick={() => handleUpdateCourseName(c.id)}>✓</button>
                                                <button className="btn-cancel" onClick={() => setEditingCourseId(null)}>✕</button>
                                            </div>
                                        ) : (
                                            <>
                                                <span
                                                    onClick={() => { setEditingCourseId(c.id); setEditCourseName(renderName(c.name)); }}
                                                    style={{ cursor: 'pointer', flex: 1 }}
                                                    title="點擊編輯名稱"
                                                >
                                                    {renderName(c.name)}
                                                </span>
                                                <button onClick={() => { setEditingCourseId(c.id); setEditCourseName(renderName(c.name)); }} style={{ marginRight: '4px', color: '#666' }}>✎</button>
                                                <button onClick={() => onDeleteCourse(c.id)}>🗑</button>
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right side: Selected Teacher Allocation Workload */}
                <div className="detail-side card">
                    <h3>📊 配課詳情: {teachers.find(t => t.id === selectedTeacherId)?.name || '未選擇'}</h3>
                    {selectedTeacherId ? (
                        <div className="allocation-viewer">
                            <div className="workload-summary">
                                總節數：<strong>{teacherWorkloads[selectedTeacherId]?.total || 0}</strong> 節
                                {currentTeacherDuplicates > 0 && (
                                    <button
                                        className="btn btn-small btn-warning"
                                        onClick={handleMergeDuplicates}
                                        style={{ marginLeft: '12px' }}
                                    >
                                        🔗 合併 {currentTeacherDuplicates} 筆重複
                                    </button>
                                )}
                            </div>
                            <table className="workload-table">
                                <thead>
                                    <tr>
                                        <th>班級</th>
                                        <th>科目</th>
                                        <th>節數</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teacherWorkloads[selectedTeacherId]?.details.map((detail, idx) => (
                                        <tr key={idx}>
                                            <td>{renderName(detail.className)}</td>
                                            <td>{detail.courseName}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={detail.periods}
                                                    onChange={(e) => handleReqChange(detail.classId, detail.courseId, 'periodsNeeded', parseInt(e.target.value) || 0)}
                                                    min="1"
                                                />
                                            </td>
                                            <td>
                                                <button onClick={() => handleRemoveAllocation(detail.classId, detail.courseId)}>🗑</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {teacherWorkloads[selectedTeacherId]?.details.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="empty-msg">此教師尚無配課</td>
                                        </tr>
                                    )}
                                    {/* New allocation row */}
                                    <tr className="new-allocation-row">
                                        <td>
                                            <select
                                                value={newAllocation.classId}
                                                onChange={e => setNewAllocation({ ...newAllocation, classId: e.target.value })}
                                                className="inline-select"
                                            >
                                                <option value="">選擇班級...</option>
                                                {classes.map(c => (
                                                    <option key={c.id} value={c.id}>{renderName(c.name)}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <select
                                                    value={newAllocation.courseId}
                                                    onChange={e => setNewAllocation({ ...newAllocation, courseId: e.target.value })}
                                                    className="inline-select"
                                                >
                                                    <option value="">選擇科目...</option>
                                                    {courses.map(crs => (
                                                        <option key={crs.id} value={crs.id}>{renderName(crs.name)}</option>
                                                    ))}
                                                </select>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        className="btn-outline btn-small"
                                                        onClick={() => handleQuickSetCourse(['國', '國語'])}
                                                        title="快速選取國語"
                                                    >
                                                        📖 國語
                                                    </button>
                                                    <button
                                                        className="btn-outline btn-small"
                                                        onClick={() => handleQuickSetCourse(['數', '數學'])}
                                                        title="快速選取數學"
                                                    >
                                                        🧮 數學
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="1"
                                                value={newAllocation.periods}
                                                onChange={e => setNewAllocation({ ...newAllocation, periods: parseInt(e.target.value) || 1 })}
                                                className="inline-input"
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleAddAllocation}
                                                disabled={!newAllocation.classId || !newAllocation.courseId}
                                            >
                                                +新增
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">請從左側選擇一位教師查看配課詳情</div>
                    )}
                </div>
            </div>
            {editingTeacherId && (
                <div className="modal-overlay" onClick={() => setEditingTeacherId(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                        <h3>編輯教師設定</h3>
                        <div className="input-group" style={{ marginBottom: '1rem' }}>
                            <label>教師姓名:</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
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

                        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
                            <button className="btn btn-outline" onClick={() => setEditingTeacherId(null)}>關閉</button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleUpdateTeacher(editingTeacherId)}
                            >
                                儲存姓名
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeacherWorkloadPanel;
