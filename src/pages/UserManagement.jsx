import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import './UserManagement.css';

function UserManagement() {
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingUid, setUpdatingUid] = useState(null);

    useEffect(() => {
        async function fetchUsers() {
            try {
                const q = query(collection(db, 'users'), orderBy('lastLogin', 'desc'));
                const snapshot = await getDocs(q);
                setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
            } catch (err) {
                console.error("Fetch users error:", err);
            } finally {
                setLoading(false);
            }
        }
        if (isAdmin) fetchUsers();
    }, [isAdmin]);

    const handleRoleChange = async (uid, newRole) => {
        if (!window.confirm(`確定要將此用戶更改為 ${newRole} 嗎？`)) return;

        setUpdatingUid(uid);
        try {
            // Update Firestore
            await updateDoc(doc(db, 'users', uid), {
                role: newRole,
                updatedAt: new Date().toISOString()
            });

            // Update local state
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));

            // Note: Real Custom Claims update would require a Cloud Function or Admin SDK.
            // For this project, we rely on the Firestore sync in AuthContext to update UI on next reload.
            alert('角色更新成功！(新權限將於該用戶下次登入或重新載入時生效)');
        } catch (err) {
            console.error("Update role error:", err);
            alert('更新失敗，請檢查權限。');
        } finally {
            setUpdatingUid(null);
        }
    };

    if (!isAdmin) return <div className="p-4">權限不足</div>;

    return (
        <div className="user-management-container">
            <header className="page-header">
                <h1>👥 用戶權限管理</h1>
                <p>管理教職員的訪問權限 (Admin: 教務處, Editor: 各班導師)</p>
            </header>

            {loading ? (
                <div className="loading-state">載入中...</div>
            ) : (
                <div className="user-table-wrapper">
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>用戶</th>
                                <th>電子郵件</th>
                                <th>目前角色</th>
                                <th>最後登入</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.uid}>
                                    <td>
                                        <div className="user-profile">
                                            {user.photoURL && <img src={user.photoURL} alt="" className="avatar" />}
                                            <span>{user.displayName || '未知用戶'}</span>
                                        </div>
                                    </td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`role-badge ${user.role || 'viewer'}`}>
                                            {user.role === 'admin' ? '🛡️ 管理員' : user.role === 'editor' ? '✍️ 編輯者' : '👁️ 檢視者'}
                                        </span>
                                    </td>
                                    <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A'}</td>
                                    <td>
                                        <div className="action-btns">
                                            <select
                                                value={user.role || 'viewer'}
                                                onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                                                disabled={updatingUid === user.uid}
                                                className="role-select"
                                            >
                                                <option value="viewer">設為 檢視者</option>
                                                <option value="editor">設為 編輯者</option>
                                                <option value="admin">設為 管理員</option>
                                            </select>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
