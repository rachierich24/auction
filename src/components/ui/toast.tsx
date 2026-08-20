"use client";

import * as React from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastContextValue = {
  toast: (input: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}

const DURATION = 5200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: Omit<Toast, "id">) => {
      const id = ++counter.current;
      setToasts((current) => [...current.slice(-3), { ...input, id }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: "success", title, description }),
      error: (title, description) => toast({ tone: "error", title, description }),
      info: (title, description) => toast({ tone: "info", title, description }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // Announced politely so a bid confirmation reaches screen readers
        // without interrupting whatever they are currently reading.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS: Record<ToastTone, React.ReactNode> = {
  success: <Check className="size-4" />,
  error: <AlertTriangle className="size-4" />,
  info: <Info className="size-4" />,
};

const TONES: Record<ToastTone, string> = {
  success: "text-positive",
  error: "text-live",
  info: "text-accent-deep",
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3",
        "rounded-sm border border-line bg-surface px-4 py-3 shadow-lift",
        "animate-[fade-up_0.32s_cubic-bezier(0.22,1,0.36,1)_both]",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", TONES[toast.tone])}>
        {ICONS[toast.tone]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-medium text-ink">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 shrink-0 rounded-sm p-1 text-faint transition-colors hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
