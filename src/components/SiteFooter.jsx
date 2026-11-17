import { NavLink } from 'react-router-dom';
import './SiteFooter.css';

const APP_VERSION = 'v2.12.1';

const points = [
    { icon: '🤖', title: 'AI 自動排課', desc: '用基因演算法排出全校課表，衝突自動檢查' },
    { icon: '📊', title: 'Excel 匯入匯出', desc: '配課資料用 Excel 匯入，課表可匯出與列印' },
    { icon: '🔁', title: '智慧代課推薦', desc: '自動找出最適合的代課老師' },
];

// 網站頁尾（2026-11-17 新增）
export default function SiteFooter() {
    return (
        <footer className="site-footer">
            <div className="site-footer__inner">
                <div className="site-footer__brand">
                    <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width="48" height="48" className="site-footer__logo" />
                    <div>
                        <strong>SMES 課表系統</strong>
                        <span>教師課表、班級課表隨時查，排課與代課一站完成</span>
                    </div>
                </div>
                <ul className="site-footer__points">
                    {points.map((p) => (
                        <li key={p.title}>
                            <span className="site-footer__icon" aria-hidden="true">{p.icon}</span>
                            <div>
                                <strong>{p.title}</strong>
                                <small>{p.desc}</small>
                            </div>
                        </li>
                    ))}
                </ul>
                <nav className="site-footer__links" aria-label="頁尾快速連結">
                    <NavLink to="/" className="site-footer__link">🏠 首頁</NavLink>
                    <NavLink to="/teacher" className="site-footer__link">👩‍🏫 教師課表</NavLink>
                    <NavLink to="/class" className="site-footer__link">🏫 班級課表</NavLink>
                </nav>
            </div>
            <div className="site-footer__bottom">
                <p className="site-credit">
                    Made with <span className="site-credit__heart" aria-label="愛心">❤️</span> by{' '}
                    <a
                        href="https://cagoooo.github.io/Akai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="阿凱老師教育科技創新專區"
                        className="site-credit__author"
                    >
                        阿凱老師
                    </a>
                    <span className="site-footer__school">
                        <span className="site-footer__dot" aria-hidden="true">・</span>桃園市龍潭區石門國民小學
                    </span>
                </p>
                <p className="site-footer__version">{APP_VERSION}</p>
            </div>
        </footer>
    );
}
