import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Info, Loader2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
}

const TYPE_CONFIG: Record<ToastType, { icon: React.FC<any>; bg: string; border: string; dot: string }> = {
  success: { icon: CheckCircle, bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  error:   { icon: AlertCircle, bg: 'bg-rose-500/10', border: 'border-rose-500/30', dot: 'bg-rose-400' },
  info:    { icon: Info, bg: 'bg-sky-500/10', border: 'border-sky-500/30', dot: 'bg-sky-400' },
  loading: { icon: Loader2, bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
};

interface ToastProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none sm:max-w-xs">
      {toasts.map((toast) => {
        const config = TYPE_CONFIG[toast.type];
        const Icon = config.icon;
        const timerRef = useRef<number | null>(null);

        // Auto-dismiss after duration
        useEffect(() => {
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (toast.duration && toast.duration > 0) {
            timerRef.current = window.setTimeout(() => onDismiss(toast.id), toast.duration);
          }
          return () => {
            if (timerRef.current !== null) {
              window.clearTimeout(timerRef.current);
            }
          };
        }, [toast.id, toast.duration, onDismiss]);

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl p-3.5 shadow-xl border animate-in fade-in slide-in-from-right-2 duration-300 ${config.bg} ${config.border} text-sm`}
          >
            <div className={`flex-shrink-0 w-6 h-6 rounded-full ${config.dot} flex items-center justify-center text-[10px]`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="font-bold text-xs text-slate-100">{toast.title}</div>
              {toast.message && (
                <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{toast.message}</div>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="ml-2 flex-shrink-0 p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-200 transition"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return <Toast toasts={toasts} onDismiss={onDismiss} />;
};

let toastContainer: {
  add: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
} | null = null;

export const initToast = (api: { add: (toast: Omit<Toast, 'id'>) => void; dismiss: (id: string) => void }) => {
  toastContainer = api;
};

export const showToast = (toast: Omit<Toast, 'id'>) => {
  if (toastContainer) {
    toastContainer.add(toast);
  } else {
    // Fallback if not initialized yet
    console.warn('Toast system not initialized. Falling back to alert.', toast.title, toast.message || '');
  }
};

export default Toast;