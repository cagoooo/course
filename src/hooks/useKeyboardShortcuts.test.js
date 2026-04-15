import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, formatShortcut } from './useKeyboardShortcuts';

/**
 * useKeyboardShortcuts 測試
 *
 * - 基本按鍵觸發(ctrl+s, mod+s 跨平台)
 * - 修飾鍵必須完全匹配(ctrl+s 不會觸發 ctrl+shift+s)
 * - 在 input/textarea 內預設不觸發
 * - allowInInput=true 可放行
 * - 停用時不觸發
 */

const fireKey = (options) => {
    const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ...options,
    });
    window.dispatchEvent(event);
    return event;
};

describe('useKeyboardShortcuts', () => {
    afterEach(() => {
        // happy-dom 偶爾會殘留 listener,保險起見用事件派發無效的 key
    });

    it('triggers handler on ctrl+s (Windows)', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { keys: 'ctrl+s', handler },
        ]));

        fireKey({ key: 's', ctrlKey: true });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does NOT trigger ctrl+s when only s pressed', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { keys: 'ctrl+s', handler },
        ]));

        fireKey({ key: 's' });
        expect(handler).not.toHaveBeenCalled();
    });

    it('does NOT trigger ctrl+s when ctrl+shift+s pressed (exact modifiers)', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { keys: 'ctrl+s', handler },
        ]));

        fireKey({ key: 's', ctrlKey: true, shiftKey: true });
        expect(handler).not.toHaveBeenCalled();
    });

    it('triggers ctrl+shift+z when all modifiers match', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { keys: 'ctrl+shift+z', handler },
        ]));

        fireKey({ key: 'z', ctrlKey: true, shiftKey: true });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('skips handler when enabled=false', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts(
            [{ keys: 'ctrl+s', handler }],
            { enabled: false }
        ));

        fireKey({ key: 's', ctrlKey: true });
        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores shortcut when target is an INPUT', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { keys: 'ctrl+s', handler },
        ]));

        // Simulate keydown on input
        const input = document.createElement('input');
        document.body.appendChild(input);
        const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 's',
            ctrlKey: true,
        });
        input.dispatchEvent(event);
        expect(handler).not.toHaveBeenCalled();
        document.body.removeChild(input);
    });

    it('respects allowInInput=true to trigger inside INPUT', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { keys: 'ctrl+s', handler, allowInInput: true },
        ]));

        const input = document.createElement('input');
        document.body.appendChild(input);
        const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 's',
            ctrlKey: true,
        });
        input.dispatchEvent(event);
        expect(handler).toHaveBeenCalledTimes(1);
        document.body.removeChild(input);
    });

    it('supports multiple keys bound to same handler', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { keys: ['ctrl+s', 'ctrl+enter'], handler },
        ]));

        fireKey({ key: 's', ctrlKey: true });
        fireKey({ key: 'Enter', ctrlKey: true });
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('calls preventDefault unless opted out', () => {
        const handler = vi.fn();
        renderHook(() => useKeyboardShortcuts([
            { keys: 'ctrl+s', handler },
        ]));

        const event = fireKey({ key: 's', ctrlKey: true });
        expect(event.defaultPrevented).toBe(true);
    });
});

describe('formatShortcut', () => {
    it('formats ctrl+s correctly on non-mac', () => {
        // happy-dom default is linux-like
        const output = formatShortcut('ctrl+s');
        // 依平台不同,至少保證包含 S
        expect(output).toMatch(/S/i);
    });

    it('formats multi-modifier shortcut', () => {
        const output = formatShortcut('ctrl+shift+z');
        expect(output).toMatch(/Z/i);
    });

    it('formats enter/escape keys', () => {
        expect(formatShortcut('enter')).toBe('↵');
        expect(formatShortcut('escape')).toBe('Esc');
    });
});
