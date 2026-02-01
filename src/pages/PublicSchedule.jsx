import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { firestoreService } from '../services/firestoreService';
import ScheduleGrid from '../components/ScheduleGrid';
import './PublicSchedule.css';

function PublicSchedule() {
    const { type, id } = useParams(); // type: 'class' | 'teacher', id: e.g. 'G1-C1'
    const [name, setName] = useState('');
    const [schedule, setSchedule] = useState(Array(35).fill(null));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const [clRaw, crRaw, teRaw, allSchedules] = await Promise.all([
                    firestoreService.getClasses(),
                    firestoreService.getCourses(),
                    firestoreService.getTeachers(),
                    firestoreService.getAllSchedules()
                ]);

                // Sanitize
                const cl = clRaw;
                const cr = crRaw.map(c => ({
                    ...c,
                    name: (typeof c.name === 'object' && c.name !== null) ? (c.name.name || Object.values(c.name)[0]) : c.name
                }));
                const te = teRaw.map(t => ({
                    ...t,
                    name: (typeof t.name === 'object' && t.name !== null) ? (t.name.name || Object.values(t.name)[0]) : t.name
                }));

                let targetName = id;
                let rawSchedule = null;

                if (type === 'class') {
                    const cls = cl.find(c => c.id === id);
                    if (cls) targetName = cls.name;
                    rawSchedule = allSchedules.find(s => s.id === id);
                } else if (type === 'teacher') {
                    const tch = te.find(t => t.id === id);
                    if (tch) targetName = tch.name;

                    // Construct teacher schedule from all class schedules
                    const periods = Array(35).fill(null);
                    allSchedules.forEach(sch => {
                        if (!sch.periods) return;
                        sch.periods.forEach(p => {
                            if (p.teacherId === id) {
                                periods[p.periodIndex] = {
                                    courseId: p.courseId,
                                    classId: sch.id
                                };
                            }
                        });
                    });
                    rawSchedule = { periods };
                }

                setName(targetName);

                if (rawSchedule && rawSchedule.periods) {
                    const grid = Array(35).fill(null);
                    rawSchedule.periods.forEach(p => {
                        const crs = cr.find(c => c.id === p.courseId);
                        const cls = cl.find(c => c.id === p.classId);
                        grid[p.periodIndex] = {
                            topLine: crs ? crs.name : (p.courseId || ''),
                            bottomLine: type === 'class' ? '' : (cls ? `${cls.grade}-${cls.name}` : '')
                        };
                    });
                    setSchedule(grid);
                }
            } catch (err) {
                console.error(err);
                setError("讀取課表失敗，請確認連結是否正確。");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [type, id]);

    if (loading) return <div className="public-loading">載入中...</div>;
    if (error) return <div className="public-error">{error}</div>;

    return (
        <div className="public-container">
            <header className="public-header">
                <h1>{name} 課表</h1>
                <p className="public-subtitle">行動端唯讀版本</p>
            </header>
            <main className="public-content">
                <ScheduleGrid schedule={schedule} type={type} editable={false} />
            </main>
            <footer className="public-footer">
                <p>© SMES 排課系統 | 即時課表查詢</p>
            </footer>
        </div>
    );
}

export default PublicSchedule;
