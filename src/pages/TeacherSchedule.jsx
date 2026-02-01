import React, { useState, useEffect } from 'react';
import { firestoreService } from '../services/firestoreService';
import ScheduleGrid from '../components/ScheduleGrid';

function TeacherSchedule() {
    const [teachers, setTeachers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [classes, setClasses] = useState([]);

    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [scheduleData, setScheduleData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial Load: Teachers, Courses, Classes (for mapping)
    useEffect(() => {
        async function init() {
            const [tList, cList, clList] = await Promise.all([
                firestoreService.getTeachers(),
                firestoreService.getCourses(),
                firestoreService.getClasses()
            ]);
            setTeachers(tList.map(t => ({
                ...t,
                name: (typeof t.name === 'object' && t.name !== null) ? (t.name.name || Object.values(t.name)[0]) : t.name
            })));
            setCourses(cList.map(c => ({
                ...c,
                name: (typeof c.name === 'object' && c.name !== null) ? (c.name.name || Object.values(c.name)[0]) : c.name
            })));
            setClasses(clList);
            setLoading(false);
        }
        init();
    }, []);

    // Fetch Schedule when Teacher Selected
    useEffect(() => {
        if (!selectedTeacherId) return;

        async function fetchSchedule() {
            // Get raw grid (periods with courseId, classId)
            const grid = await firestoreService.getTeacherSchedule(selectedTeacherId);

            // Map IDs to Names for Display
            const mappedGrid = grid.map(cell => {
                if (!cell) return null;

                // Find Names
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
    }, [selectedTeacherId, classes, courses]);

    return (
        <div className="page-container">
            <h2 className="page-title">教師課表查詢</h2>

            <div className="controls">
                <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="main-select"
                >
                    <option value="">請選擇教師...</option>
                    {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            {selectedTeacherId && (
                <div className="schedule-view">
                    <ScheduleGrid schedule={scheduleData} type="teacher" />
                </div>
            )}
        </div>
    );
}

export default TeacherSchedule;
