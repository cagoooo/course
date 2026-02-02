import { openDB } from 'idb';

const DB_NAME = 'smes-scheduler-db';
const DB_VERSION = 1;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        // Teacher Store
        if (!db.objectStoreNames.contains('teachers')) {
            db.createObjectStore('teachers', { keyPath: 'id' });
        }
        // Course Store
        if (!db.objectStoreNames.contains('courses')) {
            db.createObjectStore('courses', { keyPath: 'id' });
        }
        // Classroom Store
        if (!db.objectStoreNames.contains('classrooms')) {
            db.createObjectStore('classrooms', { keyPath: 'id' });
        }
        // Classes Store
        if (!db.objectStoreNames.contains('classes')) {
            db.createObjectStore('classes', { keyPath: 'id' });
        }
        // Metadata Store (e.g., last sync time)
        if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta');
        }
    },
});

export const OfflineService = {
    // --- Teachers ---
    async saveTeachers(teachers) {
        const db = await dbPromise;
        const tx = db.transaction('teachers', 'readwrite');
        await tx.store.clear();
        await Promise.all(teachers.map(t => tx.store.put(t)));
        await tx.done;
    },
    async getTeachers() {
        return (await dbPromise).getAll('teachers');
    },

    // --- Courses ---
    async saveCourses(courses) {
        const db = await dbPromise;
        const tx = db.transaction('courses', 'readwrite');
        await tx.store.clear();
        await Promise.all(courses.map(c => tx.store.put(c)));
        await tx.done;
    },
    async getCourses() {
        return (await dbPromise).getAll('courses');
    },

    // --- Classrooms ---
    async saveClassrooms(classrooms) {
        const db = await dbPromise;
        const tx = db.transaction('classrooms', 'readwrite');
        await tx.store.clear();
        await Promise.all(classrooms.map(c => tx.store.put(c)));
        await tx.done;
    },
    async getClassrooms() {
        return (await dbPromise).getAll('classrooms');
    },

    // --- Classes ---
    async saveClasses(classes) {
        const db = await dbPromise;
        const tx = db.transaction('classes', 'readwrite');
        await tx.store.clear();
        await Promise.all(classes.map(c => tx.store.put(c)));
        await tx.done;
    },
    async getClasses() {
        return (await dbPromise).getAll('classes');
    },

    // --- Meta ---
    async setLastSync(timestamp) {
        return (await dbPromise).put('meta', timestamp, 'lastSync');
    },
    async getLastSync() {
        return (await dbPromise).get('meta', 'lastSync');
    }
};
