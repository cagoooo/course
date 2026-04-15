import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ToastProvider, useToast, useConfirm } from './ToastContext';

/**
 * ToastContext 測試
 *
 * - 四類 toast 顯示(success / error / warning / info)
 * - loading 不自動關閉
 * - dismiss/update API
 * - useConfirm 流程(resolve true/false)
 */

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

const TestHarness = ({ children }) => <ToastProvider>{children}</ToastProvider>;

function ToastButton({ type, msg, options, onIdCapture }) {
    const toast = useToast();
    const onClick = () => {
        const id = toast[type](msg, options);
        onIdCapture?.(id);
    };
    return <button onClick={onClick}>push</button>;
}

describe('ToastProvider + useToast', () => {
    it('throws when useToast is used outside provider', () => {
        const Broken = () => {
            useToast();
            return null;
        };
        // Suppress React error output
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<Broken />)).toThrow();
        errSpy.mockRestore();
    });

    it('renders a success toast with message', () => {
        render(
            <TestHarness>
                <ToastButton type="success" msg="儲存成功" />
            </TestHarness>
        );
        fireEvent.click(screen.getByText('push'));
        expect(screen.getByText('儲存成功')).toBeTruthy();
    });

    it('auto-dismisses toast after default duration', () => {
        render(
            <TestHarness>
                <ToastButton type="info" msg="Hello" />
            </TestHarness>
        );
        fireEvent.click(screen.getByText('push'));
        expect(screen.queryByText('Hello')).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(4000); // default 3500
        });
        expect(screen.queryByText('Hello')).toBeNull();
    });

    it('loading toast does NOT auto-dismiss', () => {
        render(
            <TestHarness>
                <ToastButton type="loading" msg="Loading..." />
            </TestHarness>
        );
        fireEvent.click(screen.getByText('push'));

        act(() => {
            vi.advanceTimersByTime(10000);
        });
        expect(screen.queryByText('Loading...')).toBeTruthy();
    });

    it('close button dismisses toast', () => {
        render(
            <TestHarness>
                <ToastButton type="info" msg="Bye" />
            </TestHarness>
        );
        fireEvent.click(screen.getByText('push'));
        const closeBtn = screen.getByLabelText('關閉通知');
        fireEvent.click(closeBtn);
        expect(screen.queryByText('Bye')).toBeNull();
    });

    it('update() replaces loading → success with same id', () => {
        function TwoStep() {
            const toast = useToast();
            const [id, setId] = React.useState(null);
            return (
                <>
                    <button onClick={() => setId(toast.loading('pending'))}>start</button>
                    <button onClick={() => toast.update(id, 'success', 'done')}>finish</button>
                </>
            );
        }

        render(
            <TestHarness>
                <TwoStep />
            </TestHarness>
        );
        fireEvent.click(screen.getByText('start'));
        expect(screen.queryByText('pending')).toBeTruthy();

        fireEvent.click(screen.getByText('finish'));
        expect(screen.queryByText('pending')).toBeNull();
        expect(screen.queryByText('done')).toBeTruthy();
    });
});

describe('useConfirm', () => {
    function ConfirmTester({ onResult }) {
        const confirm = useConfirm();
        return (
            <button
                onClick={async () => {
                    const ok = await confirm('刪除這個項目嗎?', { variant: 'danger' });
                    onResult(ok);
                }}
            >
                ask
            </button>
        );
    }

    it('resolves true when confirm is clicked', async () => {
        vi.useRealTimers(); // waitFor 需要真實 timer
        const onResult = vi.fn();
        render(
            <TestHarness>
                <ConfirmTester onResult={onResult} />
            </TestHarness>
        );
        fireEvent.click(screen.getByText('ask'));

        const confirmBtn = await screen.findByText('確定');
        fireEvent.click(confirmBtn);

        await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    });

    it('resolves false when cancel is clicked', async () => {
        vi.useRealTimers();
        const onResult = vi.fn();
        render(
            <TestHarness>
                <ConfirmTester onResult={onResult} />
            </TestHarness>
        );
        fireEvent.click(screen.getByText('ask'));

        const cancelBtn = await screen.findByText('取消');
        fireEvent.click(cancelBtn);

        await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    });
});
