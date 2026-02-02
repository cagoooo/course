
import React, { useState, useEffect } from 'react';

/**
 * InAppBrowserGuard
 * 
 * Detects if the app is running inside an in-app browser (like LINE, Facebook, Instagram).
 * If detected, it displays an instruction overlay to guide the user to open the default browser.
 * This is crucial for Google Login which often fails in these webviews.
 */
export default function InAppBrowserGuard({ children }) {
    const [isInApp, setIsInApp] = useState(false);

    useEffect(() => {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        // Detect LINE, Facebook, Instagram, Twitter
        const inAppPattern = /(Line|FBAN|FBAV|Instagram|Twitter)/i;

        if (inAppPattern.test(userAgent)) {
            setIsInApp(true);
        }
    }, []);

    if (!isInApp) {
        return children;
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            padding: '20px',
            textAlign: 'center',
            backdropFilter: 'blur(5px)'
        }}>
            {/* Arrow pointing to top right */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '25px',
                fontSize: '3rem',
                animation: 'bounce 1.5s infinite'
            }}>
                ↗️
            </div>

            <div style={{
                background: 'white',
                color: '#333',
                padding: '30px',
                borderRadius: '20px',
                maxWidth: '90%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
                <h2 style={{
                    fontSize: '1.5rem',
                    marginBottom: '15px',
                    color: '#dc2626',
                    fontWeight: 800
                }}>請使用預設瀏覽器</h2>

                <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '20px' }}>
                    偵測到您正在使用 LINE 或內建瀏覽器，這可能會導致 <strong>Google 登入失敗</strong>。
                </p>

                <div style={{
                    background: '#f3f4f6',
                    padding: '15px',
                    borderRadius: '12px',
                    textAlign: 'left',
                    fontSize: '0.95rem'
                }}>
                    <strong>操作步驟：</strong>
                    <ol style={{ margin: '10px 0 0 20px', padding: 0 }}>
                        <li style={{ marginBottom: '8px' }}>點擊右上角的選單圖示 (⋮ 或 ↗️)</li>
                        <li>選擇 <strong>「使用預設瀏覽器開啟」</strong> 或 <strong>「Open in Browser」</strong></li>
                    </ol>
                </div>

                <button
                    onClick={() => setIsInApp(false)}
                    style={{
                        marginTop: '25px',
                        background: 'transparent',
                        border: '1px solid #ddd',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        color: '#666',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    暫時忽略 (仍要嘗試)
                </button>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(5px, -5px); }
                }
            `}</style>
        </div>
    );
}
