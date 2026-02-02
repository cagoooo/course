import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService } from '../services/firestoreService';
import { useSemester } from '../contexts/SemesterContext';
import { useAuth } from '../contexts/AuthContext';
import { canMoveCourse } from '../utils/rbac';
import ScheduleGrid from '../components/ScheduleGrid';
import './ClassSchedule.css';

function ClassSchedule() {
    const { currentSemesterId, loading: semesterLoading } = useSemester();
    const { role, isEditor } = useAuth();

    const [classes, setClasses] = useState([]);
    const [courses, setCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classrooms, setClassrooms] = useState([]);

    const [viewMode, setViewMode] = useState('class'); // 'class' | 'room'
    const [selectedGrade, setSelectedGrade] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState('');

    const [rawPeriods, setRawPeriods] = useState([]); // With IDs
    const [scheduleData, setScheduleData] = useState(null); // Formatted for Grid
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        if (!currentSemesterId) return;

        const normalizeName = (item) => {
            if (typeof item.name === 'object' && item.name !== null) {
                return item.name.name || Object.values(item.name)[0] || item.id;
            }
            return item.name || item.id;
        };

        async function init() {
            setLoading(true);
            const [clList, cList, tList, crList] = await Promise.all([
                firestoreService.getClasses(currentSemesterId),
                firestoreService.getCourses(currentSemesterId),
                firestoreService.getTeachers(currentSemesterId),
                firestoreService.getClassrooms(currentSemesterId)
            ]);

            setClasses(clList.map(c => ({ ...c, name: normalizeName(c) })));
            setClassrooms(crList.map(r => ({ ...r, name: normalizeName(r) })));

            setCourses(cList.map(c => ({ ...c, name: normalizeName(c) })));
            setTeachers(tList.map(t => ({ ...t, name: normalizeName(t) })));

            // Reset selection on semester change
            setSelectedId('');
            setScheduleData(null);
            setLoading(false);
        }
        init();
    }, [currentSemesterId]);

    // Reset selection when switching modes
    useEffect(() => {
        setSelectedId('');
        setScheduleData(null);
        setIsEditing(false);
    }, [viewMode]);

    // Format raw periods to scheduleData
    const formatSchedule = (data) => {
        return data.map(cell => {
            if (!cell || (!cell.courseId && !cell.classId)) return null;

            if (viewMode === 'class') {
                const crs = courses.find(c => c.id === cell.courseId);
                const tch = teachers.find(t => t.id === cell.teacherId);
                return {
                    topLine: crs ? crs.name : '',
                    bottomLine: tch ? tch.name : ''
                };
            } else {
                const cls = classes.find(c => c.id === cell.classId);
                const crs = courses.find(c => c.id === cell.courseId);
                const tch = teachers.find(t => t.id === cell.teacherId);
                return {
                    topLine: cls ? cls.name : (cell.classId || ''),
                    bottomLine: `${crs ? crs.name : (cell.courseId || '')} (${tch ? tch.name : '未知'})`
                };
            }
        });
    };

    // Fetch Schedule
    useEffect(() => {
        if (!selectedId) {
            setScheduleData(null);
            setRawPeriods([]);
            return;
        }

        async function fetchSchedule() {
            let data;
            if (viewMode === 'class') {
                const res = await firestoreService.getClassSchedule(selectedId, currentSemesterId);
                data = res?.periods || Array(35).fill(null);
            } else {
                data = await firestoreService.getClassroomSchedule(selectedId, currentSemesterId);
            }

            setRawPeriods(data);
            setScheduleData(formatSchedule(data));
        }
        fetchSchedule();
    }, [selectedId, viewMode, courses, teachers, classes, currentSemesterId]);

    const handleMove = (from, to) => {
        if (viewMode !== 'class') return; // Only allow editing in class view

        const newPeriods = [...rawPeriods];
        const temp = newPeriods[from];
        newPeriods[from] = newPeriods[to];
        newPeriods[to] = temp;

        setRawPeriods(newPeriods);
        setScheduleData(formatSchedule(newPeriods));
    };

    const handleSave = async () => {
        if (!selectedId || viewMode !== 'class') return;

        setSaveLoading(true);
        try {
            await firestoreService.saveClassSchedule(selectedId, rawPeriods, currentSemesterId);
            alert('課表更新成功！');
            setIsEditing(false);
        } catch (err) {
            console.error("Save Error:", err);
            alert('儲存失敗，請檢查權限及網路。');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleCancel = () => {
        // Re-fetch to discard changes
        setSelectedId(selectedId); // Trigger effect
        setIsEditing(false);
    };

    const checkCanDragForIndex = (index) => {
        if (viewMode !== 'class') return false;
        const cell = rawPeriods[index];
        if (!cell) return false;

        const course = courses.find(c => c.id === cell.courseId);
        return canMoveCourse(role, course?.name || '');
    };

    // ... Filtered options logic same as before ...
    const filteredOptions = useMemo(() => {
        const chineseToNum = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6' };
        let processedQuery = searchQuery.toLowerCase();
        Object.keys(chineseToNum).forEach(key => {
            if (processedQuery.includes(key)) processedQuery = processedQuery.replace(key, chineseToNum[key]);
        });

        if (viewMode === 'class') {
            return classes.filter(c => {
                const name = String(c.name || '').toLowerCase();
                const matchesGrade = selectedGrade === 'all' || c.grade === parseInt(selectedGrade);
                const matchesSearch = name.includes(processedQuery) || name.includes(searchQuery.toLowerCase());
                return matchesGrade && matchesSearch;
            });
        } else {
            return classrooms.filter(r => {
                const name = String(r.name || r.id || '').toLowerCase();
                return name.includes(processedQuery) || name.includes(searchQuery.toLowerCase());
            });
        }
    }, [viewMode, classes, classrooms, selectedGrade, searchQuery]);

    if (loading) {
        return (
            <div className="class-schedule-container">
                <div className="loading-state"><div className="spinner"></div><p>正在載入班級與專科教室資料...</p></div>
            </div>
        );
    }

    return (
        <div className="class-schedule-container">
            <header className="header-section">
                <h2 className="page-title">{viewMode === 'class' ? '班級課表查詢' : '專科教室課表查詢'}</h2>
                <div className="filter-tabs">
                    <button className={`tab-btn ${viewMode === 'class' ? 'active' : ''}`} onClick={() => setViewMode('class')}>🏫 班級課表</button>
                    <button className={`tab-btn ${viewMode === 'room' ? 'active' : ''}`} onClick={() => setViewMode('room')}>🎨 專科教室</button>
                </div>
            </header>

            <div className="filter-panel">
                <div className="top-controls">
                    <div className="search-group">
                        <label className="field-label">🔎 快速搜尋</label>
                        <div className="input-wrapper">
                            <span className="search-icon">🔍</span>
                            <input type="text" placeholder={viewMode === 'class' ? "搜尋年級、班級..." : "搜尋教室名稱..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                        </div>
                    </div>

                    <div className="select-group">
                        <label className="field-label">{viewMode === 'class' ? '📍 選擇班級' : '📍 選擇教室'}</label>
                        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="main-select">
                            <option value="">{viewMode === 'class' ? '選擇班級...' : '選擇教室...'} ({filteredOptions.length} 個符合)</option>
                            {filteredOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name || opt.id}</option>)}
                        </select>
                    </div>

                    {/* Edit Control for Class/Editor/Admin */}
                    {selectedId && viewMode === 'class' && isEditor && (
                        <div className="edit-controls">
                            {!isEditing ? (
                                <button className="btn btn-outline" onClick={() => setIsEditing(true)}>✍️ 進入調整模式</button>
                            ) : (
                                <div className="btn-group">
                                    <button className="btn btn-primary" onClick={handleSave} disabled={saveLoading}>
                                        {saveLoading ? '儲存中...' : '💾 儲存修改'}
                                    </button>
                                    <button className="btn btn-outline" onClick={handleCancel}>取消</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {viewMode === 'class' && (
                    <div className="grade-chips">
                        <button className={`grade-chip ${selectedGrade === 'all' ? 'active' : ''}`} onClick={() => setSelectedGrade('all')}>全部</button>
                        {[1, 2, 3, 4, 5, 6].map(g => (
                            <button key={g} className={`grade-chip ${selectedGrade === g.toString() ? 'active' : ''}`} onClick={() => setSelectedGrade(g.toString())}>{g}年級</button>
                        ))}
                    </div>
                )}
            </div>

            {selectedId ? (
                <div className="schedule-card">
                    {isEditing && (
                        <div className="edit-banner">
                            <small>💡 提示：按住並拖曳方塊即可調課。{role === 'editor' && '您僅能調整彈性、校本等非核心學科。'}</small>
                        </div>
                    )}
                    <ScheduleGrid
                        schedule={scheduleData}
                        type={viewMode}
                        editable={isEditing}
                        onMove={handleMove}
                        canDrag={role === 'admin' ? null : checkCanDragForIndex}
                    />
                </div>
            ) : (
                <div className="loading-state" style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '24px', border: '2px dashed #cbd5e0' }}>
                    <p>請從上方選單選擇{viewMode === 'class' ? '班級' : '教室'}以查看課表</p>
                </div>
            )}
        </div>
    );
}

export default ClassSchedule;
