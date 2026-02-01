import dotenv from 'dotenv';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, writeBatch } from "firebase/firestore";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DATA_FILE = path.resolve(__dirname, '../smes_data.json');
const SEMESTER_ID = '110-1'; // Matching the JSON output

async function upload() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error("Data file not found!");
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`Uploading data for Semester: ${SEMESTER_ID}...`);

    // 1. Create Semester Doc
    const semRef = doc(db, "semesters", SEMESTER_ID);
    await setDoc(semRef, {
        id: SEMESTER_ID,
        name: `${SEMESTER_ID} 學期`,
        created_at: new Date().toISOString()
    });

    // Helper for Batch Upload
    async function batchUpload(collectionName, items, idField = 'id') {
        const batchSize = 400; // Limit is 500
        const chunks = [];

        for (let i = 0; i < items.length; i += batchSize) {
            chunks.push(items.slice(i, i + batchSize));
        }

        console.log(`Uploading ${items.length} items to ${collectionName}...`);

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const ref = doc(semRef, collectionName, String(item[idField]));
                batch.set(ref, item);
            });
            await batch.commit();
            console.log(`  Committed batch of ${chunk.length}`);
        }
    }

    // 2. Upload Teachers
    await batchUpload('teachers', data.teachers);

    // 3. Upload Courses
    await batchUpload('courses', data.courses);

    // 4. Upload Classes
    await batchUpload('classes', data.classes);

    // 5. Upload Schedules
    // Use ClassID as DocID for Schedule
    const scheduleItems = data.schedules.map(s => ({
        ...s,
        id: s.classId // Ensure it has an ID field for the helper
    }));
    await batchUpload('schedules', scheduleItems);

    console.log("Upload Complete!");
}

upload().catch(console.error);
