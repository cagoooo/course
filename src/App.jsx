import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TeacherSchedule from './pages/TeacherSchedule';
import ClassSchedule from './pages/ClassSchedule';
import AutoSchedule from './pages/AutoSchedule';
import PublicSchedule from './pages/PublicSchedule';
import './index.css';

function App() {
    return (
        <Router>
            <div className="app-container">
                <nav className="main-nav">
                    <div className="nav-logo">📅 SMES 課表系統</div>
                    <div className="nav-links">
                        <Link to="/" className="nav-item">首頁</Link>
                        <Link to="/teacher" className="nav-item">教師課表</Link>
                        <Link to="/class" className="nav-item">班級課表</Link>
                        <Link to="/auto" className="nav-item highlight">自動排課 🤖</Link>
                    </div>
                </nav>

                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/teacher" element={<TeacherSchedule />} />
                        <Route path="/class" element={<ClassSchedule />} />
                        <Route path="/auto" element={<AutoSchedule />} />
                        <Route path="/public/:type/:id" element={<PublicSchedule />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
