import React, { useState, useEffect } from 'react';
import { firestoreService } from '../services/firestoreService';
import ScheduleGrid from '../components/ScheduleGrid';

function ClassSchedule() {
    const [classes, setClasses] = useState([]);
    const [courses, setCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);

    const [selectedClassId, setSelectedClassId] = useState('');
    const [scheduleData, setScheduleData] = useState(null);

    // Initial Load
    useEffect(() => {
        async function init() {
            const [clList, cList, tList] = await Promise.all([
                firestoreService.getClasses(),
                firestoreService.getCourses(),
                firestoreService.getTeachers()
            ]);
            setClasses(clList);
            // Sanitize names
            setCourses(cList.map(c => ({
                ...c,
                name: (typeof c.name === 'object' && c.name !== null) ? (c.name.name || Object.values(c.name)[0]) : c.name
            })));
            setTeachers(tList.map(t => ({
                ...t,
                name: (typeof t.name === 'object' && t.name !== null) ? (t.name.name || Object.values(t.name)[0]) : t.name
            })));
        }
        init();
    }, []);

    // Fetch Schedule
    useEffect(() => {
        if (!selectedClassId) return;

        async function fetchSchedule() {
            const rawSchedule = await firestoreService.getClassSchedule(selectedClassId);

            if (!rawSchedule || !rawSchedule.periods) {
                setScheduleData(Array(35).fill(null));
                return;
            }

            // Map Data
            const mappedGrid = rawSchedule.periods.map(period => {
                if (!period.courseId) return null;

                const crs = courses.find(c => c.id === period.courseId);
                const tch = teachers.find(t => t.id === period.teacherId);

                return {
                    topLine: crs ? crs.name : '',
                    bottomLine: tch ? tch.name : ''
                };
            });

            setScheduleData(mappedGrid);
        }
        fetchSchedule();
    }, [selectedClassId, courses, teachers]);

    return (
        <div className="page-container">
            <h2 className="page-title">班級課表查詢</h2>

            <div className="controls">
                <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="main-select"
                >
                    <option value="">請選擇班級...</option>
                    {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {selectedClassId && (
                <div className="schedule-view">
                    <ScheduleGrid schedule={scheduleData} type="class" />
                </div>
            )}
        </div>
    );
}

export default ClassSchedule;
