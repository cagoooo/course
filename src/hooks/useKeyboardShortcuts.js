import { useEffect, useRef } from 'react';

/**
 * useKeyboardShortcuts — 全域快捷鍵綁定 hook
 *
 * @param {Array<{keys: string|string[], handler: (e: KeyboardEvent) => void, preventDefault?: boolean, allowInInput?: boolean, description?: string}>} shortcuts
 * @param {Object} options
 * @param {boolean} options.enabled           是否啟用(預設 true)
 * @param {boolean} options.globalAllowInput  預設是否忽略「正在輸入 input/textarea」的情境
 *
 * keys 字串格式:
 *   "ctrl+s"             Windows/Linux 專用
 *   "mod+s"              跨平台(Mac 自動轉 cmd)
 *   "ctrl+shift+z"       多鍵組合
 *   ["mod+s", "ctrl+enter"]  多快捷鍵綁同一 handler
 *
 * 範例:
 *   useKeyboardShortcuts([
 *     { keys: 'mod+s', handler: () => save(), description: '儲存課表' },
 *     { keys: 'mod+z', handler: () => undo(),  description: '復原' },
 *     { keys: 'mod+e', handler: () => openExport(), description: '匯出 Excel' },
 *   ]);
 */
export function useKeyboardShortcuts(shortcuts, options = {}) {
    const { enabled = true, globalAllowInput = false } = options;
    const shortcutsRef = useRef(shortcuts);
    shortcutsRef.current = shortcuts;

    useEffect(() => {
        if (!enabled) return;

        const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');

        const matchKey = (keyStr, e) => {
            const parts = keyStr.toLowerCase().split('+').map((p) => p.trim());
            const key = parts[parts.length - 1];
            const modifiers = new Set(parts.slice(0, -1));

            const needCtrl = modifiers.has('ctrl');
            const needMeta = modifiers.has('cmd') || modifiers.has('meta');
            const needMod = modifiers.has('mod');
            const needShift = modifiers.has('shift');
            const needAlt = modifiers.has('alt') || modifiers.has('option');

            // mod = cmd on Mac, ctrl elsewhere
            const modOk = needMod ? (isMac ? e.metaKey : e.ctrlKey) : true;
            const ctrlOk = needCtrl === e.ctrlKey;
            const metaOk = needMeta === e.metaKey;
            const shiftOk = needShift === e.shiftKey;
            const altOk = needAlt === e.altKey;

            // 若只用了 "mod",其他不指定就容忍
            const exactModsOk = needMod
                ? modOk && shiftOk && altOk
                : ctrlOk && metaOk && shiftOk && altOk;

            const pressedKey = (e.key || '').toLowerCase();
            return exactModsOk && pressedKey === key;
        };

        const handler = (e) => {
            const target = e.target;
            const tag = (target?.tagName || '').toUpperCase();
            const isEditable =
                tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
                target?.isContentEditable === true;

            for (const sc of shortcutsRef.current) {
                if (!sc || !sc.keys || !sc.handler) continue;
                if (isEditable && !(sc.allowInInput ?? globalAllowInput)) continue;

                const keysList = Array.isArray(sc.keys) ? sc.keys : [sc.keys];
                if (keysList.some((k) => matchKey(k, e))) {
                    if (sc.preventDefault !== false) e.preventDefault();
                    sc.handler(e);
                    break;
                }
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [enabled, globalAllowInput]);
}

/**
 * 取得作業系統適配的顯示文字(UI 提示用)
 *   formatShortcut('mod+s') → "Ctrl+S" or "⌘S"
 */
export function formatShortcut(keyStr) {
    const isMac = typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
    return keyStr
        .split('+')
        .map((p) => {
            const k = p.trim().toLowerCase();
            if (k === 'mod') return isMac ? '⌘' : 'Ctrl';
            if (k === 'ctrl') return isMac ? '⌃' : 'Ctrl';
            if (k === 'cmd' || k === 'meta') return '⌘';
            if (k === 'shift') return isMac ? '⇧' : 'Shift';
            if (k === 'alt' || k === 'option') return isMac ? '⌥' : 'Alt';
            if (k === 'enter') return '↵';
            if (k === 'escape' || k === 'esc') return 'Esc';
            return k.length === 1 ? k.toUpperCase() : k;
        })
        .join(isMac ? '' : '+');
}
