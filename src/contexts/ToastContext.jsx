import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import './ToastContext.css';

/**
 * Toast 通知系統
 *
 * API:
 *   const toast = useToast();
 *   toast.success('儲存成功');
 *   toast.error('網路錯誤');
 *   toast.warning('請先選擇班級');
 *   toast.info('匯入中…', { duration: 0 });  // 0 = 不自動關閉
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm('確定刪除？', { variant: 'danger' });
 *
 * 單元測試友好：ToastContext 不依賴 DOM 專有 API。
 */

const ToastContext = createContext(null);

const TOAST_DEFAULT_DURATION = 3500;

let _idCounter = 0;
const nextId = () => `toast-${++_idCounter}-${Date.now()}`;

const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳',
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null); // { message, resolve, variant, confirmText, cancelText }
    const timersRef = useRef(new Map());

    const remove = useCallback((id) => {
        setToasts((list) => list.filter((t) => t.id !== id));
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const push = useCallback((type, message, options = {}) => {
        const id = options.id || nextId();
        const duration = options.duration ?? TOAST_DEFAULT_DURATION;
        const toast = {
            id,
            type,
            message,
            title: options.title,
            action: options.action, // { label, onClick }
            createdAt: Date.now(),
            duration,
        };

        setToasts((list) => {
            // 支援 id 去重（loading → success 情境）
            const filtered = list.filter((t) => t.id !== id);
            return [...filtered, toast];
        });

        if (duration > 0) {
            const timer = setTimeout(() => remove(id), duration);
            timersRef.current.set(id, timer);
        }

        return id;
    }, [remove]);

    const toast = {
        success: (msg, opts) => push('success', msg, opts),
        error: (msg, opts) => push('error', msg, { duration: 5000, ...opts }), // 錯誤訊息停久一點
        warning: (msg, opts) => push('warning', msg, opts),
        info: (msg, opts) => push('info', msg, opts),
        loading: (msg, opts) => push('loading', msg, { duration: 0, ...opts }),
        dismiss: remove,
        update: (id, type, message, opts = {}) => push(type, message, { ...opts, id }),
    };

    const showConfirm = useCallback((message, options = {}) => {
        return new Promise((resolve) => {
            setConfirmState({
                message,
                resolve,
                variant: options.variant || 'default', // 'default' | 'danger'
                confirmText: options.confirmText || '確定',
                cancelText: options.cancelText || '取消',
                title: options.title,
            });
        });
    }, []);

    const handleConfirmClose = (result) => {
        if (confirmState?.resolve) confirmState.resolve(result);
        setConfirmState(null);
    };

    return (
        <ToastContext.Provider value={{ toast, showConfirm }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={remove} />
            {confirmState && (
                <ConfirmDialog
                    {...confirmState}
                    onConfirm={() => handleConfirmClose(true)}
                    onCancel={() => handleConfirmClose(false)}
                />
            )}
        </ToastContext.Provider>
    );
};

// ---------- Components ----------

const ToastContainer = ({ toasts, onDismiss }) => {
    if (!toasts.length) return null;
    return (
        <div className="toast-container" role="region" aria-label="通知訊息" aria-live="polite">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`toast toast--${t.type}`}
                    role={t.type === 'error' ? 'alert' : 'status'}
                >
                    <span className="toast__icon" aria-hidden="true">{ICONS[t.type] || 'ℹ️'}</span>
                    <div className="toast__body">
                        {t.title && <div className="toast__title">{t.title}</div>}
                        <div className="toast__message">{t.message}</div>
                    </div>
                    {t.action && (
                        <button
                            className="toast__action"
                            onClick={() => {
                                t.action.onClick?.();
                                onDismiss(t.id);
                            }}
                        >
                            {t.action.label}
                        </button>
                    )}
                    <button
                        className="toast__close"
                        onClick={() => onDismiss(t.id)}
                        aria-label="關閉通知"
                    >×</button>
                </div>
            ))}
        </div>
    );
};

const ConfirmDialog = ({ message, title, variant, confirmText, cancelText, onConfirm, onCancel }) => {
    const confirmBtnRef = useRef(null);

    React.useEffect(() => {
        confirmBtnRef.current?.focus();
        const onKey = (e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onConfirm();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onCancel, onConfirm]);

    return (
        <div className="confirm-overlay" onClick={onCancel} role="presentation">
            <div
                className={`confirm-dialog confirm-dialog--${variant}`}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="confirm-dialog__header">
                    <span className="confirm-dialog__icon" aria-hidden="true">
                        {variant === 'danger' ? '⚠️' : '❓'}
                    </span>
                    <h3 id="confirm-title" className="confirm-dialog__title">
                        {title || (variant === 'danger' ? '請再次確認' : '確認操作')}
                    </h3>
                </div>
                <div className="confirm-dialog__body">{message}</div>
                <div className="confirm-dialog__footer">
                    <button type="button" className="confirm-dialog__btn confirm-dialog__btn--cancel" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        className={`confirm-dialog__btn confirm-dialog__btn--confirm confirm-dialog__btn--${variant}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ---------- Hooks ----------

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast 必須在 <ToastProvider> 內使用');
    return ctx.toast;
};

export const useConfirm = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useConfirm 必須在 <ToastProvider> 內使用');
    return ctx.showConfirm;
};

export default ToastContext;
