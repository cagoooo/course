import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { firestoreService } from '../services/firestoreService';
import './Dashboard.css';

function Dashboard() {
    const [semester, setSemester] = useState(null);
    const [stats, setStats] = useState({ teachers: 0, classes: 0 });

    useEffect(() => {
        async function fetchInfo() {
            try {
                const [sem, te, cl] = await Promise.all([
                    firestoreService.getSemester(),
                    firestoreService.getTeachers(),
                    firestoreService.getClasses()
                ]);
                setSemester(sem);
                setStats({ teachers: te.length, classes: cl.length });
            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
            }
        }
        fetchInfo();
    }, []);

    return (
        <div className="dashboard">
            <header className="page-header">
                <h1>👋 歡迎使用 SMES 課表查詢</h1>
                <div className="subtitle">
                    <span>📅 目前學期：{semester ? semester.name : '載入中...'}</span>
                    <span className="divider">|</span>
                    <span>👥 系統狀態：{stats.teachers} 位教師 / {stats.classes} 個班級</span>
                </div>
            </header>

            <div className="grid-container">
                <Link to="/teacher" className="action-card card-teacher">
                    <div className="icon">👨‍🏫</div>
                    <h3>查詢教師課表</h3>
                    <p>依教師姓名查詢每週授課節數與班級，支援個人課表列印。</p>
                </Link>

                <Link to="/class" className="action-card card-class">
                    <div className="icon">🏫</div>
                    <h3>查詢班級課表</h3>
                    <p>依年級班級查詢該班每週課程內容，支援班級課表批量導出。</p>
                </Link>

                <Link to="/auto" className="action-card card-auto">
                    <div className="icon">🤖</div>
                    <h3>AI 自動排課系統</h3>
                    <p>支援 AI 演算法自動排課、衝突檢核與配課權重微調。</p>
                </Link>

                <Link to="/auto" className="action-card card-admin">
                    <div className="icon">⚙️</div>
                    <h3>管理與維護</h3>
                    <p>管理教師基本資料、專科教室綁定與科目配課節數。</p>
                </Link>
            </div>
        </div>
    );
}

export default Dashboard;
