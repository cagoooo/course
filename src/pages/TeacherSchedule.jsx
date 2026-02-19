import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { firestoreService } from '../services/firestoreService';
import { useSemester } from '../contexts/SemesterContext';
import ScheduleGrid from '../components/ScheduleGrid';
import './TeacherSchedule.css';

function TeacherSchedule() {
    const { currentSemesterId, loading: semesterLoading } = useSemester();
    const location = useLocation();
    const [teachers, setTeachers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [classes, setClasses] = useState([]);

    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all' | 'homeroom' | 'subject'
    const [scheduleData, setScheduleData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        if (!currentSemesterId) return;

        async function init() {
            setLoading(true);
            const [tList, cList, clList] = await Promise.all([
                firestoreService.getTeachers(currentSemesterId),
                firestoreService.getCourses(currentSemesterId),
                firestoreService.getClasses(currentSemesterId)
            ]);

            // Map teachers with homeroom info
            const processedTeachers = tList.map(t => {
                const name = (typeof t.name === 'object' && t.name !== null) ? (t.name.name || Object.values(t.name)[0]) : t.name;
                const homeroom = clList.find(c => c.homeroomTeacherId === t.id);

                let homeroomLabel = null;
                if (homeroom) {
                    // Check if name already contains year/class info
                    const hasYear = homeroom.name.includes('年');
                    const hasClass = homeroom.name.includes('班');

                    const gradePart = hasYear ? '' : `${homeroom.grade}年`;
                    const classPart = hasClass ? '' : '班';
                    homeroomLabel = `${gradePart}${homeroom.name}${classPart}`;
                }

                return {
                    ...t,
                    name,
                    homeroomClass: homeroomLabel,
                    isHomeroom: !!homeroom
                };
            });

            setTeachers(processedTeachers);
            setCourses(cList.map(c => ({
                ...c,
                name: (typeof c.name === 'object' && c.name !== null) ? (c.name.name || Object.values(c.name)[0]) : c.name
            })));
            setClasses(clList);

            // Auto-select teacher from URL ?id= parameter
            const params = new URLSearchParams(location.search);
            const urlTeacherId = params.get('id');
            if (urlTeacherId) {
                const match = processedTeachers.find(t => t.id === urlTeacherId);
                if (match) {
                    setSelectedTeacherId(urlTeacherId);
                } else {
                    setSelectedTeacherId('');
                }
            } else {
                setSelectedTeacherId('');
            }
            setScheduleData(null);
            setLoading(false);
        }
        init();
    }, [currentSemesterId]);

    // Filtered Teachers list
    const filteredTeachers = useMemo(() => {
        // Mapping for Chinese numerals to Arabic digits for grade searching
        const chineseToArabic = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6' };
        let processedQuery = searchQuery.toLowerCase();

        // If user types "一年", "二年" etc., try to bridge the gap
        Object.keys(chineseToArabic).forEach(key => {
            if (processedQuery.includes(key)) {
                processedQuery = processedQuery.replace(key, chineseToArabic[key]);
            }
        });

        return teachers.filter(t => {
            const label = `${t.name} ${t.homeroomClass || ''}`.toLowerCase();
            const matchesSearch = label.includes(processedQuery) || label.includes(searchQuery.toLowerCase());

            const matchesType =
                filterType === 'all' ||
                (filterType === 'homeroom' && t.isHomeroom) ||
                (filterType === 'subject' && !t.isHomeroom);

            return matchesSearch && matchesType;
        }).sort((a, b) => {
            // Sort: Homeroom teachers first, then by name
            if (a.isHomeroom && !b.isHomeroom) return -1;
            if (!a.isHomeroom && b.isHomeroom) return 1;
            return a.name.localeCompare(b.name, 'zh-Hant');
        });
    }, [teachers, searchQuery, filterType]);

    // Fetch Schedule
    useEffect(() => {
        if (!selectedTeacherId) {
            setScheduleData(null);
            return;
        }

        async function fetchSchedule() {
            const grid = await firestoreService.getTeacherSchedule(selectedTeacherId, currentSemesterId);
            const mappedGrid = grid.map(cell => {
                if (!cell) return null;
                const cls = classes.find(c => c.id === cell.classId);
                const crs = courses.find(c => c.id === cell.courseId);
                return {
                    topLine: cls ? cls.name : cell.classId,
                    bottomLine: crs ? crs.name : cell.courseId
                };
            });
            setScheduleData(mappedGrid);
        }
        fetchSchedule();
    }, [selectedTeacherId, classes, courses, currentSemesterId]);

    if (loading && teachers.length === 0) {
        return (
            <div className="teacher-schedule-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>正在載入師資與課程資料...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="teacher-schedule-container">
            <header className="header-section">
                <h2 className="page-title">教師課表查詢</h2>
            </header>

            <div className="filter-panel">
                <div className="search-group">
                    <label className="field-label">🔎 關鍵字搜尋</label>
                    <div className="input-wrapper">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="搜尋教師姓名或班級..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="type-filter-group">
                        <button
                            className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterType('all')}
                        >
                            全部 ({teachers.length})
                        </button>
                        <button
                            className={`filter-btn ${filterType === 'homeroom' ? 'active' : ''}`}
                            onClick={() => setFilterType('homeroom')}
                        >
                            導師 ({teachers.filter(t => t.isHomeroom).length})
                        </button>
                        <button
                            className={`filter-btn ${filterType === 'subject' ? 'active' : ''}`}
                            onClick={() => setFilterType('subject')}
                        >
                            科任 ({teachers.filter(t => !t.isHomeroom).length})
                        </button>
                    </div>
                </div>

                <div className="select-group">
                    <label className="field-label">👤 選擇教師</label>
                    <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="main-select"
                    >
                        <option value="">選擇教師 ({filteredTeachers.length} 位符合)...</option>
                        {filteredTeachers.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name} {t.homeroomClass ? `(${t.homeroomClass} 導師)` : '(科任)'}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedTeacherId ? (
                <div className="schedule-card">
                    <ScheduleGrid schedule={scheduleData} type="teacher" />
                </div>
            ) : (
                <div className="loading-state" style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '20px', border: '2px dashed #e2e8f0' }}>
                    <p>請從上方選單選擇一位教師以查看課表</p>
                </div>
            )}
        </div>
    );
}

export default TeacherSchedule;
