import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState('viewer'); // Default: viewer
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // 1. Try to get role from Custom Claims (IdToken)
                const idTokenResult = await currentUser.getIdTokenResult();
                let userRole = idTokenResult.claims.role || 'viewer';
                let firestoreRole = null;

                try {
                    // 2. Sync with Firestore metadata (Optional)
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (!userDoc.exists()) {
                        // Initialize user doc if new
                        await setDoc(userDocRef, {
                            email: currentUser.email,
                            displayName: currentUser.displayName,
                            lastLogin: new Date().toISOString(),
                            requestedRole: 'viewer'
                        }, { merge: true });
                    } else {
                        firestoreRole = userDoc.data()?.role || userDoc.data()?.requestedRole;
                    }
                } catch (err) {
                    console.error("Error syncing user data with Firestore:", err);
                    // Fallback: proceed with just auth, default role remains valid
                }

                // If claims don't have role, but firestore has a forced role (manual override)
                const finalRole = idTokenResult.claims.admin ? 'admin' : (firestoreRole || userRole);

                setUser(currentUser);
                setRole(finalRole);
            } else {
                setUser(null);
                setRole('viewer');
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Google Login Error:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout Error:", error);
        }
    };

    const isAdmin = role === 'admin';
    const isEditor = role === 'editor' || role === 'admin';
    const isViewer = true; // Everyone is a viewer

    const value = {
        user,
        role,
        isAdmin,
        isEditor,
        isViewer,
        loginWithGoogle,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
