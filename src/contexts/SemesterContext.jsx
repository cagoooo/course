import React, { createContext, useContext, useState, useEffect } from 'react';
import { firestoreService } from '../services/firestoreService';

const SemesterContext = createContext();

export function useSemester() {
    return useContext(SemesterContext);
}

export function SemesterProvider({ children }) {
    const [semesters, setSemesters] = useState([]);
    const [currentSemesterId, setCurrentSemesterId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        loadSemesters();
    }, []);

    const loadSemesters = async () => {
        setLoading(true);
        try {
            const list = await firestoreService.getSemesters();

            // Sort: Newest first (assuming ID format like '110-1', '110-2')
            // Or '111-1' > '110-2'
            list.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));

            setSemesters(list);

            // Default selection logic:
            // 1. Try local storage
            // 2. Fallback to latest semester
            // 3. Fallback to '110-1' (default) if list is empty
            const saved = localStorage.getItem('smes_current_semester');
            const found = list.find(s => s.id === saved);

            if (found) {
                setCurrentSemesterId(found.id);
            } else if (list.length > 0) {
                const latest = list[0].id;
                setCurrentSemesterId(latest);
                localStorage.setItem('smes_current_semester', latest);
            } else {
                // No semesters exist yet? Create default '110-1' logic could be here,
                // or we just set it and let firestoreService handle "lazy creation on write"
                setCurrentSemesterId('110-1');
            }
        } catch (e) {
            console.error("Failed to load semesters:", e);
            // Fallback safe mode
            setCurrentSemesterId('110-1');
        } finally {
            setLoading(false);
        }
    };

    const changeSemester = (id) => {
        setCurrentSemesterId(id);
        localStorage.setItem('smes_current_semester', id);
        // Page reload might be needed if not all components react to context changes automatically
        // But optimally they should just rely on the context prop.
        // For heavy data pages, we might want to trigger a data refresh event if needed.
    };

    const createSemester = async (newId, name, copyFromId = null) => {
        try {
            setLoading(true);
            await firestoreService.createSemester(newId, name, copyFromId);
            await loadSemesters(); // Reload list
            changeSemester(newId); // Switch to new
            return true;
        } catch (e) {
            console.error(e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const currentSemesterName = semesters.find(s => s.id === currentSemesterId)?.name || currentSemesterId;

    const value = {
        semesters,
        currentSemesterId,
        currentSemesterName,
        loading,
        changeSemester,
        createSemester,
        refreshSemesters: loadSemesters
    };

    return (
        <SemesterContext.Provider value={value}>
            {children}
        </SemesterContext.Provider>
    );
}
