import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TeacherSchedule from './pages/TeacherSchedule';
import ClassSchedule from './pages/ClassSchedule';
import AutoSchedule from './pages/AutoSchedule';
import PublicSchedule from './pages/PublicSchedule';
import UserManagement from './pages/UserManagement';
import Login from './pages/Login';
import { SemesterProvider } from './contexts/SemesterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SemesterSelector from './components/SemesterSelector';
import './index.css';

function Navbar() {
    const { user, isAdmin, logout } = useAuth();

    return (
        <nav className="main-nav">
            <div className="nav-logo">📅 SMES 課表系統</div>
            <div className="nav-links">
                {/* Group 1: Navigation Items */}
                <div className="nav-group-items">
                    <NavLink to="/" className="nav-item">首頁</NavLink>
                    <NavLink to="/teacher" className="nav-item">教師課表</NavLink>
                    <NavLink to="/class" className="nav-item">班級課表</NavLink>

                    {/* Admin Only Link */}
                    {isAdmin && (
                        <>
                            <NavLink to="/auto" className="nav-item nav-highlight">自動排課 🤖</NavLink>
                            <NavLink to="/users" className="nav-item nav-highlight">用戶管理 👥</NavLink>
                        </>
                    )}
                </div>

                {/* Group 2: Semester Selector */}
                <SemesterSelector />

                {/* Group 3: Auth UI */}
                <div className="nav-group-auth">
                    {user ? (
                        <div className="user-info">
                            <span className="user-name">{user.displayName || user.email}</span>
                            <button className="btn btn-text btn-small" onClick={logout}>登出</button>
                        </div>
                    ) : (
                        <NavLink to="/login" className="nav-item">登入</NavLink>
                    )}
                </div>
            </div>
        </nav>
    );
}

function App() {
    return (
        <AuthProvider>
            <SemesterProvider>
                <Router basename="/course">
                    <div className="app-container">
                        <Navbar />

                        <main className="main-content">
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/teacher" element={<TeacherSchedule />} />
                                <Route path="/class" element={<ClassSchedule />} />

                                {/* Protected Admin Route */}
                                <Route
                                    path="/auto"
                                    element={
                                        <ProtectedRoute requiredRole="admin">
                                            <AutoSchedule />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/users"
                                    element={
                                        <ProtectedRoute requiredRole="admin">
                                            <UserManagement />
                                        </ProtectedRoute>
                                    }
                                />

                                <Route path="/public/:type/:id" element={<PublicSchedule />} />
                            </Routes>
                        </main>
                    </div>
                </Router>
            </SemesterProvider>
        </AuthProvider>
    );
}

export default App;
