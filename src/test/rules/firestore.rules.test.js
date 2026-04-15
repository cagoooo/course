/**
 * Firestore Security Rules 測試
 *
 * 使用 @firebase/rules-unit-testing 對 firestore.rules 檔做黑箱驗證。
 *
 * 執行方式(本地):
 *   1. 啟動 emulator:  firebase emulators:start --only firestore
 *   2. 另一個終端:     npm run test:rules
 *
 * CI:GitHub Actions 用 `firebase emulators:exec --only firestore "npm run test:rules"`
 *    一個指令包辦啟停。
 *
 * 覆蓋情境:
 *   1. 未認證使用者:公開資料可讀,users 不可讀
 *   2. 一般使用者(viewer):不能寫 semesters/teachers 等核心資料
 *   3. Admin(token.role):可讀寫所有資料
 *   4. Admin(Firestore fallback):靠 users/{uid}.role 識別
 *   5. Users 集合:自己可讀自己,不能把自己升級為 admin
 *   6. 預設 deny:其他任何 collection 都禁止
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

const PROJECT_ID = 'smes-rules-test';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
const [emuHost, emuPort] = emulatorHost.split(':');

/** 嘗試連線 emulator;若不通就整組 skip(本地沒跑 firebase emulators:start 時) */
async function checkEmulator() {
    return new Promise((resolve) => {
        const socket = net.createConnection(Number(emuPort), emuHost);
        socket.setTimeout(500);
        socket.once('connect', () => {
            socket.end();
            resolve(true);
        });
        socket.once('error', () => resolve(false));
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
}

let testEnv;
let emulatorAvailable = false;

beforeAll(async () => {
    emulatorAvailable = await checkEmulator();
    if (!emulatorAvailable) {
        console.warn(
            `[rules.test] Firestore emulator 未偵測到 (${emulatorHost}) — ` +
            `請執行 \`firebase emulators:start --only firestore\` 或 \`firebase emulators:exec --only firestore "npm run test:rules"\`。本次測試全部跳過。`
        );
        return;
    }

    const rules = fs.readFileSync(
        path.resolve(process.cwd(), 'firestore.rules'),
        'utf8'
    );

    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules,
            host: emuHost,
            port: Number(emuPort),
        },
    });
});

afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
});

beforeEach(async (context) => {
    if (!emulatorAvailable) {
        context.skip?.();
        return;
    }
    if (testEnv) await testEnv.clearFirestore();
});

/** 建立各角色的客戶端 */
const ctx = {
    /** 未登入使用者 */
    anon: () => testEnv.unauthenticatedContext().firestore(),
    /** 一般使用者(無特殊 claim) */
    user: (uid, customClaims = {}) =>
        testEnv.authenticatedContext(uid, customClaims).firestore(),
    /** Admin(custom claim) */
    admin: (uid = 'admin-uid') =>
        testEnv.authenticatedContext(uid, { role: 'admin' }).firestore(),
    /** Editor(custom claim) */
    editor: (uid = 'editor-uid') =>
        testEnv.authenticatedContext(uid, { role: 'editor' }).firestore(),
    /** 繞過 rules 的管理員 context(用來 seed 資料) */
    seed: () => testEnv.withSecurityRulesDisabled(async (context) => context.firestore()),
};

// =======================================================================
//  1) semesters & 子資料:讀全開,寫需 admin
// =======================================================================
describe('semesters/*', () => {
    it('anon can READ semester (public read)', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'semesters', '114-1'), { name: '114 上' });
        });

        const db = ctx.anon();
        await assertSucceeds(getDoc(doc(db, 'semesters', '114-1')));
    });

    it('anon cannot WRITE semester', async () => {
        const db = ctx.anon();
        await assertFails(setDoc(doc(db, 'semesters', '114-1'), { name: 'X' }));
    });

    it('viewer cannot WRITE semester', async () => {
        const db = ctx.user('viewer-1');
        await assertFails(setDoc(doc(db, 'semesters', '114-1'), { name: 'X' }));
    });

    it('admin (custom claim) CAN write semester', async () => {
        const db = ctx.admin();
        await assertSucceeds(setDoc(doc(db, 'semesters', '114-1'), { name: '114 上' }));
    });

    it('admin can write nested subcollections (teachers)', async () => {
        const db = ctx.admin();
        await assertSucceeds(
            setDoc(doc(db, 'semesters', '114-1', 'teachers', 't1'), { name: '王老師' })
        );
    });

    it('anon cannot write nested subcollections', async () => {
        const db = ctx.anon();
        await assertFails(
            setDoc(doc(db, 'semesters', '114-1', 'teachers', 't1'), { name: 'X' })
        );
    });

    it('anon CAN read nested subcollections (schedules are public)', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(
                doc(c.firestore(), 'semesters', '114-1', 'schedules', 'cls1'),
                { periods: [] }
            );
        });
        const db = ctx.anon();
        await assertSucceeds(
            getDoc(doc(db, 'semesters', '114-1', 'schedules', 'cls1'))
        );
    });
});

// =======================================================================
//  2) users/{userId}:自己讀寫 + admin 全管
// =======================================================================
describe('users/{userId}', () => {
    it('user can READ their own profile', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'alice'), { role: 'viewer' });
        });
        const db = ctx.user('alice');
        await assertSucceeds(getDoc(doc(db, 'users', 'alice')));
    });

    it("user cannot READ another user's profile", async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'bob'), { role: 'viewer' });
        });
        const db = ctx.user('alice');
        await assertFails(getDoc(doc(db, 'users', 'bob')));
    });

    it('admin CAN read anyone', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'bob'), { role: 'viewer' });
        });
        const db = ctx.admin();
        await assertSucceeds(getDoc(doc(db, 'users', 'bob')));
    });

    it('new user CAN create their profile as viewer', async () => {
        const db = ctx.user('alice');
        await assertSucceeds(
            setDoc(doc(db, 'users', 'alice'), {
                role: 'viewer',
                requestedRole: 'viewer',
                email: 'alice@school.tw',
            })
        );
    });

    it('new user CANNOT self-create as admin (privilege escalation)', async () => {
        const db = ctx.user('mallory');
        await assertFails(
            setDoc(doc(db, 'users', 'mallory'), {
                role: 'admin',
                requestedRole: 'admin',
            })
        );
    });

    it('new user CANNOT self-create as editor', async () => {
        const db = ctx.user('mallory');
        await assertFails(
            setDoc(doc(db, 'users', 'mallory'), {
                role: 'editor',
                requestedRole: 'editor',
            })
        );
    });

    it('user CANNOT update own role to admin (escalation via update)', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'alice'), {
                role: 'viewer',
                requestedRole: 'viewer',
            });
        });

        const db = ctx.user('alice');
        await assertFails(
            updateDoc(doc(db, 'users', 'alice'), { role: 'admin' })
        );
    });

    it('user CAN update their non-role profile fields', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'alice'), {
                role: 'viewer',
                requestedRole: 'viewer',
                displayName: 'Alice',
            });
        });

        const db = ctx.user('alice');
        await assertSucceeds(
            updateDoc(doc(db, 'users', 'alice'), { displayName: 'Alice Liddell' })
        );
    });

    it('admin CAN promote a user to editor', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'alice'), {
                role: 'viewer',
                requestedRole: 'viewer',
            });
        });

        const db = ctx.admin();
        await assertSucceeds(
            updateDoc(doc(db, 'users', 'alice'), { role: 'editor' })
        );
    });

    it('non-admin CANNOT delete users', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'alice'), { role: 'viewer' });
        });
        const db = ctx.user('alice');
        await assertFails(deleteDoc(doc(db, 'users', 'alice')));
    });

    it('admin CAN delete users', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'alice'), { role: 'viewer' });
        });
        const db = ctx.admin();
        await assertSucceeds(deleteDoc(doc(db, 'users', 'alice')));
    });
});

// =======================================================================
//  3) 預設 deny:未定義 collection 全擋
// =======================================================================
describe('default deny (unknown collections)', () => {
    it('anon cannot read /foo/*', async () => {
        const db = ctx.anon();
        await assertFails(getDoc(doc(db, 'foo', 'bar')));
    });

    it('authed user cannot read /foo/*', async () => {
        const db = ctx.user('alice');
        await assertFails(getDoc(doc(db, 'foo', 'bar')));
    });

    it('even admin cannot write /foo/* (not explicitly allowed)', async () => {
        const db = ctx.admin();
        await assertFails(setDoc(doc(db, 'foo', 'bar'), { x: 1 }));
    });
});

// =======================================================================
//  4) Firestore fallback:users/{uid}.role='admin' 被視為 admin
// =======================================================================
describe('admin identification via Firestore fallback', () => {
    it('user whose users doc has role=admin is treated as admin', async () => {
        // seed:alice 在 Firestore users 中已標為 admin
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'users', 'alice'), { role: 'admin' });
        });

        // alice 登入但沒有 custom claim
        const db = ctx.user('alice'); // 無 claim
        await assertSucceeds(setDoc(doc(db, 'semesters', '114-1'), { name: '114 上' }));
    });

    it('user without role in Firestore and no claim is NOT admin', async () => {
        const db = ctx.user('alice');
        await assertFails(setDoc(doc(db, 'semesters', '114-1'), { name: '114 上' }));
    });
});
