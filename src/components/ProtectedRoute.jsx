import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute - 路由守衛
 * @param {string} requiredRole - 'admin', 'editor', 'viewer'
 */
const ProtectedRoute = ({ children, requiredRole = 'viewer' }) => {
    const { user, role, isAdmin, isEditor, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="loading-overlay">驗證中...</div>;
    }

    // viewer role means "no login required" or "at least viewer"
    // However, if the user explicitly wants specific pages to be viewer-only (read-only),
    // we might still allow unauthenticated access but with a viewer flag.

    // For this app:
    // - Admin pages (/auto): strictly require admin.
    // - Editor/Admin pages: require at least editor.
    // - Viewer pages: accessible to all (even guest), but functional buttons hidden.

    if (requiredRole === 'admin' && !isAdmin) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requiredRole === 'editor' && !isEditor) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If login is required for anything (base security)
    if (requiredRole !== 'public' && !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
