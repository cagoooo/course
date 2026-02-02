import { db } from '../firebase';
import { collection, getDocs, getDoc, doc, setDoc, writeBatch, deleteDoc, query, where } from 'firebase/firestore';
import { OfflineService } from './db';

const SEMESTER_ID = '110-1'; // Default for now, should be dynamic later

export const firestoreService = {
    // Get all semesters (for selection)
    async getSemesters() {
        const snapshot = await getDocs(collection(db, 'semesters'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // Get specific semester data
    async getSemester(semesterId = SEMESTER_ID) {
        const docRef = doc(db, 'semesters', semesterId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    },

    async createSemester(id, name, copyFromId = null) {
        const semesterRef = doc(db, 'semesters', id);
        const snapshot = await getDoc(semesterRef);
        if (snapshot.exists()) {
            throw new Error('該學期代碼已存在');
        }

        // Create the semester document
        await setDoc(semesterRef, { name, createdAt: new Date().toISOString() });

        // Copy data if requested
        if (copyFromId) {
            try {
                // Copy Courses
                const courses = await this.getCourses(copyFromId);
                if (courses.length > 0) await this.batchAddCourses(courses, id);

                // Copy Classrooms
                const classrooms = await this.getClassrooms(copyFromId);
                if (classrooms.length > 0) await this.batchAddClassrooms(classrooms, id);

                // Copy Teachers (Must preserve classroomId links? No, IDs change)
                // Wait, if we generate NEW IDs for classrooms, the teacher's classroomId will be broken.
                // We need to map old IDs to new IDs if we want to preserve relationships.
                // For MVP, we might just copy names and let user re-bind, OR:
                // We can use the SAME IDs? No, IDs should be unique globally or scoped?
                // Subcollections are scoped to the parent doc, so IDs CAN be same if we want.
                // But batchAdd uses random IDs.

                // Better strategy for "Copy":
                // 1. Copy Classrooms first, keep a map of OldID -> NewID (or reuse ID if batchAdd supports it?)
                // Actually my batchAdd generates new IDs. 
                // Let's keep it simple for now: Copy data but clear relations (set classroomId to null)?
                // OR rewrite batchAdd to allow specifying IDs?

                // Let's try to reuse IDs for simplicity within the new semester scope?
                // Firestore allows custom IDs.
                // If we reuse IDs, then relations are preserved automatically!

                // Let's implement custom "copyCollection" logic here instead of using batchAdd helpers.

                const batchSize = 400; // Limit
                const copyCollection = async (collName) => {
                    const sourceRef = collection(db, `semesters/${copyFromId}/${collName}`);
                    const sourceDocs = await getDocs(sourceRef);
                    if (sourceDocs.empty) return;

                    const batch = writeBatch(db);
                    let count = 0;

                    for (const docSnap of sourceDocs.docs) {
                        const data = docSnap.data();
                        const newRef = doc(db, `semesters/${id}/${collName}`, docSnap.id); // Reuse ID
                        batch.set(newRef, data);
                        count++;
                    }
                    await batch.commit();
                    console.log(`Copied ${count} ${collName} from ${copyFromId} to ${id}`);
                };

                await copyCollection('courses');
                await copyCollection('classrooms');
                await copyCollection('teachers');
                // We probably don't want to copy 'classes' or 'schedules' as struct might change?
                // Usually classes structure (Grade 1-6) is same, just students change.
                // Let's copy classes too, but clear homerooms?
                // User requirement: "Copy Data" usually implies setup data (Teachers, Rooms, Courses).
                // Classes are usually recreated or promoted.
                // But to be helpful, let's copy Classes (structure) but clear `homeroomTeacherId`?

                const classes = await this.getClasses(copyFromId);
                if (classes.length > 0) {
                    const batch = writeBatch(db);
                    classes.forEach(c => {
                        const newRef = doc(db, `semesters/${id}/classes`, c.id);
                        // Keep name/grade/classNum, but maybe clear homeroom?
                        // User might want to keep homeroom if little change. Let's keep it.
                        batch.set(newRef, c);
                    });
                    await batch.commit();
                }

            } catch (e) {
                console.error("Copy failed partial:", e);
                // We don't rollback semester creation, just alert user via error
                throw new Error("學期建立成功，但資料複製發生錯誤: " + e.message);
            }
        }
    },

    // Get Teachers for a semester
    async getTeachers(semesterId = SEMESTER_ID) {
        try {
            const snapshot = await getDocs(collection(db, `semesters/${semesterId}/teachers`));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => Number(a.id) - Number(b.id));
            OfflineService.saveTeachers(data);
            return data;
        } catch (error) {
            console.warn("Firestore fetch failed, checking offline DB...", error);
            return await OfflineService.getTeachers();
        }
    },

    // Get Classes for a semester
    async getClasses(semesterId = SEMESTER_ID) {
        try {
            const snapshot = await getDocs(collection(db, `semesters/${semesterId}/classes`));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
                // Sort by Grade then ClassNum
                if (a.grade !== b.grade) return a.grade - b.grade;
                return a.classNum - b.classNum;
            });
            OfflineService.saveClasses(data);
            return data;
        } catch (error) {
            console.warn("Firestore fetch failed, checking offline DB...", error);
            return await OfflineService.getClasses();
        }
    },

    // Get Courses for a semester
    async getCourses(semesterId = SEMESTER_ID) {
        try {
            const snapshot = await getDocs(collection(db, `semesters/${semesterId}/courses`));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            OfflineService.saveCourses(data);
            return data;
        } catch (error) {
            console.warn("Firestore fetch failed, checking offline DB...", error);
            return await OfflineService.getCourses();
        }
    },

    // Get Schedule for a specific class
    async getClassSchedule(classId, semesterId = SEMESTER_ID) {
        // Schedule is stored in 'schedules' collection with ID = classId
        const docRef = doc(db, `semesters/${semesterId}/schedules`, classId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    },

    // Get Schedule for a specific teacher (Calculated from all schedules)
    // Note: This is expensive in NoSQL if not indexed properly.
    // For SMES data size (~40 classes), client-side filtering is fine.
    async getTeacherSchedule(teacherId, semesterId = SEMESTER_ID) {
        // 1. Get all schedules (or query if possible, but structure is nested array)
        // Structure: { periods: [{courseId, teacherId}, ...] }
        // Firestore can't easily query inside array of objects for specific field without complex indexing.
        // We will fetch all schedules and filter client side for MVP.
        // Optimization: Store a 'teachers/{teacherId}/schedule' subcollection in future.

        const snapshot = await getDocs(collection(db, `semesters/${semesterId}/schedules`));
        const allSchedules = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Construct Grid: 5 Days x 7 Periods
        // We need to know which Class and Subject they are teaching at that time.
        const teacherGrid = Array(35).fill(null); // 35 slots

        allSchedules.forEach(schedule => {
            if (!schedule.periods) return;
            schedule.periods.forEach((period, index) => {
                if (period.teacherId === teacherId) {
                    teacherGrid[index] = {
                        classId: schedule.classId, // "G1-C1"
                        courseId: period.courseId
                    };
                }
            });
        });

        return teacherGrid;
    },

    async getAllSchedules(semesterId = SEMESTER_ID) {
        const snapshot = await getDocs(collection(db, `semesters/${semesterId}/schedules`));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async saveScheduleBatch(schedules, semesterId = SEMESTER_ID) {
        const batch = writeBatch(db);
        schedules.forEach(sch => {
            const ref = doc(db, `semesters/${semesterId}/schedules`, sch.classId);
            batch.set(ref, {
                classId: sch.classId,
                periods: sch.periods
            }, { merge: true });
        });
        await batch.commit();
    },

    async saveClassSchedule(classId, periods, semesterId = SEMESTER_ID) {
        const ref = doc(db, `semesters/${semesterId}/schedules`, classId);
        await setDoc(ref, {
            classId,
            periods
        }, { merge: true });
    },

    // --- CRUD Operations ---
    async addTeacher(teacher, semesterId = SEMESTER_ID) {
        const newRef = doc(collection(db, `semesters/${semesterId}/teachers`));
        await setDoc(newRef, { ...teacher, id: newRef.id });
        return { ...teacher, id: newRef.id };
    },
    async updateTeacher(teacher, semesterId = SEMESTER_ID) {
        await setDoc(doc(db, `semesters/${semesterId}/teachers`, teacher.id), teacher, { merge: true });
    },
    async deleteTeacher(teacherId, semesterId = SEMESTER_ID) {
        await deleteDoc(doc(db, `semesters/${semesterId}/teachers`, teacherId));
    },

    async addCourse(course, semesterId = SEMESTER_ID) {
        const newRef = doc(collection(db, `semesters/${semesterId}/courses`));
        await setDoc(newRef, { ...course, id: newRef.id });
        return { ...course, id: newRef.id };
    },
    async updateCourse(course, semesterId = SEMESTER_ID) {
        await setDoc(doc(db, `semesters/${semesterId}/courses`, course.id), course, { merge: true });
    },
    async deleteCourse(courseId, semesterId = SEMESTER_ID) {
        await deleteDoc(doc(db, `semesters/${semesterId}/courses`, courseId));
    },

    // Get Classrooms for a semester
    async getClassrooms(semesterId = SEMESTER_ID) {
        try {
            const snapshot = await getDocs(collection(db, `semesters/${semesterId}/classrooms`));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            OfflineService.saveClassrooms(data);
            return data;
        } catch (error) {
            console.warn("Firestore fetch failed, checking offline DB...", error);
            return await OfflineService.getClassrooms();
        }
    },

    async addClassroom(classroom, semesterId = SEMESTER_ID) {
        const newRef = doc(collection(db, `semesters/${semesterId}/classrooms`));
        await setDoc(newRef, { ...classroom, id: newRef.id });
        return { ...classroom, id: newRef.id };
    },

    async updateClassroom(classroom, semesterId = SEMESTER_ID) {
        await setDoc(doc(db, `semesters/${semesterId}/classrooms`, classroom.id), classroom, { merge: true });
    },

    async deleteClassroom(classroomId, semesterId = SEMESTER_ID) {
        await deleteDoc(doc(db, `semesters/${semesterId}/classrooms`, classroomId));
    },

    // --- Requirements Operations ---
    async getRequirements(semesterId = SEMESTER_ID) {
        const snapshot = await getDocs(collection(db, `semesters/${semesterId}/requirements`));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async saveRequirements(requirements, semesterId = SEMESTER_ID) {
        const batch = writeBatch(db);

        // First, delete all existing requirements
        const existingSnapshot = await getDocs(collection(db, `semesters/${semesterId}/requirements`));
        existingSnapshot.docs.forEach(d => {
            batch.delete(d.ref);
        });

        // Then add all current requirements
        requirements.forEach((req, index) => {
            const reqId = `${req.classId}-${req.courseId}-${req.teacherId || 'unassigned'}`;
            const ref = doc(db, `semesters/${semesterId}/requirements`, reqId);
            batch.set(ref, {
                classId: req.classId,
                courseId: req.courseId,
                teacherId: req.teacherId || null,
                periodsNeeded: req.periodsNeeded || 1
            });
        });

        await batch.commit();
    },


    // --- Class Operations ---
    async addClass(classObj, semesterId = SEMESTER_ID) {
        // ID is usually provided (G1-C1)
        const ref = doc(db, `semesters/${semesterId}/classes`, classObj.id);
        await setDoc(ref, classObj);
    },
    async deleteClass(classId, semesterId = SEMESTER_ID) {
        await deleteDoc(doc(db, `semesters/${semesterId}/classes`, classId));
        // Also delete associated schedule
        await deleteDoc(doc(db, `semesters/${semesterId}/schedules`, classId));
    },
    async updateClassHomeroom(classId, teacherId, semesterId = SEMESTER_ID) {
        await setDoc(doc(db, `semesters/${semesterId}/classes`, classId), { homeroomTeacherId: teacherId }, { merge: true });
    },

    // --- Bulk Operations (Reset for New Semester) ---
    async clearAllTeacherConstraints(teachers, semesterId = SEMESTER_ID) {
        const batch = writeBatch(db);
        teachers.forEach(t => {
            const ref = doc(db, `semesters/${semesterId}/teachers`, t.id);
            batch.update(ref, { unavailableSlots: [] });
        });
        await batch.commit();
    },

    async clearAllClassHomerooms(classes, semesterId = SEMESTER_ID) {
        const batch = writeBatch(db);
        classes.forEach(c => {
            const ref = doc(db, `semesters/${semesterId}/classes`, c.id);
            batch.update(ref, { homeroomTeacherId: null });
        });
        await batch.commit();
    },

    // Clear all teacher assignments in generated schedules/requirements
    // Note: requirements are usually derived, but if we are persisting them as "pre-assigned" schedules:
    async clearAllScheduleAssignments(classes, semesterId = SEMESTER_ID) {
        // This is complex because we need to clear 'teacherId' in the nested 'periods' array of schedule docs
        // or just delete the schedules and let them be regenerated?
        // Usually, clearing assignments means we want to keep the structure (Subject X needed) but remove the Teacher Y.

        const batch = writeBatch(db);
        // Note: This assumes we iterate correctly. Firestore writes are limited to 500 per batch.
        // For simple apps < 500 classes, this is fine.

        for (const cls of classes) {
            // We can't easily partially update array elements in Firestore without reading first.
            // But here we can use the data we have in memory if passed, or we just rely on client state save.
            // A simpler approach for "Reset" might be to just Delete the schedule docs?
            // BUT, if schedule docs contain the "Requirements" (Course Allocations), deleting them means losing the curriculum.
            // We likely want to keep the DOC but set all teacherIds to null.
        }
        // Since the actual clearing logic will likely happen in State and then be Saved via handleSaveSchedule,
        // we might not need a dedicated service method if we reuse save.
        // But let's provide a method to clear the 'homeroom' fields if any.
    },

    // --- Batch Import Operations ---
    async batchAddTeachers(teachersData, semesterId = SEMESTER_ID) {
        const batch = writeBatch(db);
        const results = [];

        for (const t of teachersData) {
            const newRef = doc(collection(db, `semesters/${semesterId}/teachers`));
            const teacherDoc = { name: t.name, id: newRef.id, classroomId: t.classroomId || null };
            batch.set(newRef, teacherDoc);
            results.push(teacherDoc);
        }

        await batch.commit();
        return results;
    },

    async batchAddCourses(coursesData, semesterId = SEMESTER_ID) {
        const batch = writeBatch(db);
        const results = [];

        for (const c of coursesData) {
            const newRef = doc(collection(db, `semesters/${semesterId}/courses`));
            const courseDoc = { name: c.name, id: newRef.id };
            batch.set(newRef, courseDoc);
            results.push(courseDoc);
        }

        await batch.commit();
        return results;
    },

    async batchAddClassrooms(classroomsData, semesterId = SEMESTER_ID) {
        const batch = writeBatch(db);
        const results = [];

        for (const c of classroomsData) {
            const newRef = doc(collection(db, `semesters/${semesterId}/classrooms`));
            const classroomDoc = { name: c.name, id: newRef.id };
            batch.set(newRef, classroomDoc);
            results.push(classroomDoc);
        }

        await batch.commit();
        return results;
    },

    // --- Snapshot Operations ---
    async createSnapshot(name, schedules, requirements, semesterId = SEMESTER_ID) {
        const snapshotRef = doc(collection(db, `semesters/${semesterId}/snapshots`));

        // Deep sanitize to remove undefined values which Firestore doesn't support
        const cleanSchedules = JSON.parse(JSON.stringify(schedules || []));
        const cleanRequirements = JSON.parse(JSON.stringify(requirements || []));

        const snapshotData = {
            id: snapshotRef.id,
            name: name || `快照 ${new Date().toLocaleString()}`,
            createdAt: new Date().toISOString(),
            schedules: cleanSchedules,
            requirements: cleanRequirements
        };
        await setDoc(snapshotRef, snapshotData);
        return snapshotData;
    },

    async getSnapshots(semesterId = SEMESTER_ID) {
        const snapshot = await getDocs(collection(db, `semesters/${semesterId}/snapshots`));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async deleteSnapshot(snapshotId, semesterId = SEMESTER_ID) {
        await deleteDoc(doc(db, `semesters/${semesterId}/snapshots`, snapshotId));
    },

    // Get Schedule for a specific Classroom
    async getClassroomSchedule(classroomId, semesterId = SEMESTER_ID) {
        const snapshot = await getDocs(collection(db, `semesters/${semesterId}/schedules`));
        const allSchedules = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // We also need teachers to check their tied specialized classrooms
        const teachersSnapshot = await getDocs(collection(db, `semesters/${semesterId}/teachers`));
        const teachers = teachersSnapshot.docs.map(t => ({ id: t.id, ...t.data() }));

        const roomGrid = Array(35).fill(null);

        allSchedules.forEach(schedule => {
            if (!schedule.periods) return;
            schedule.periods.forEach((period, index) => {
                // Find if the teacher of this period is assigned to this classroom
                const teacher = teachers.find(t => t.id === period.teacherId);
                if (teacher && teacher.classroomId === classroomId) {
                    roomGrid[index] = {
                        classId: schedule.classId,
                        courseId: period.courseId,
                        teacherId: period.teacherId
                    };
                }
            });
        });

        return roomGrid;
    }
};
