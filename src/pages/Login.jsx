import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import logoImg from '../assets/smes_login_logo.png';
import googleIcon from '../assets/google-icon.svg';
import InAppBrowserGuard from '../components/InAppBrowserGuard';
import './Login.css';

function Login() {
    const { loginWithGoogle, user } = useAuth();
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    // Get where the user was trying to go
    const from = location.state?.from?.pathname || "/";

    useEffect(() => {
        if (user) {
            navigate(from, { replace: true });
        }
    }, [user, navigate, from]);

    const handleGoogleLogin = async () => {
        try {
            setError('');
            await loginWithGoogle();
            // Navigation handled by useEffect when user state updates
        } catch (err) {
            setError('登入失敗，請稍後再試。');
            console.error(err);
        }
    };

    if (user) {
        return null;
    }

    return (
        <InAppBrowserGuard>
            <div className="login-container">
                <div className="bg-decor"></div>
                <div className="bg-decor-2"></div>
                <div className="bg-decor-3"></div>
                <div className="login-card">
                    <div className="login-header">
                        <img src={logoImg} className="login-logo" alt="SMES Logo" />
                        <h2>SMES 課表管理系統</h2>
                        <p>請登入以存取管理功能</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="login-actions">
                        <button className="btn-google" onClick={handleGoogleLogin}>
                            <img src={googleIcon} alt="Google" />
                            使用 Google 帳號登入
                        </button>

                        <div className="login-divider">
                            <span>或</span>
                        </div>

                        <p className="login-hint">
                            提示：導師與教務人員請使用學校 G-Suite 帳號登入。
                            <br />
                            一般查詢請直接返回首頁。
                        </p>
                    </div>

                    <div className="login-footer">
                        <button className="btn btn-text" onClick={() => navigate('/')}>回首頁</button>
                    </div>
                </div>
            </div>
        </InAppBrowserGuard>
    );
}

export default Login;
