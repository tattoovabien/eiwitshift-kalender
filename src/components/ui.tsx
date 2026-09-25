import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleAlert, Info, X } from 'lucide-react';
import type { MomentType } from '../types';

// ---------------------------------------------------------------------------
// Colours per moment type (full class strings so Tailwind can see them).
// Bar colours are dark enough for white text (≥ 4.5:1).

export const TYPE_STYLE: Record<MomentType, { badge: string; bar: string; dot: string }> = {
  Campagne: { badge: 'bg-teal-50 text-teal-900 ring-teal-200', bar: 'bg-teal-700', dot: 'bg-teal-700' },
  Event: { badge: 'bg-blue-50 text-blue-900 ring-blue-200', bar: 'bg-blue-700', dot: 'bg-blue-700' },
  Webinar: { badge: 'bg-violet-50 text-violet-900 ring-violet-200', bar: 'bg-violet-700', dot: 'bg-violet-700' },
  Workshop: { badge: 'bg-amber-50 text-amber-900 ring-amber-200', bar: 'bg-amber-700', dot: 'bg-amber-700' },
  Publicatie: { badge: 'bg-slate-100 text-slate-900 ring-slate-300', bar: 'bg-slate-700', dot: 'bg-slate-700' },
  Themadag: { badge: 'bg-rose-50 text-rose-900 ring-rose-200', bar: 'bg-rose-700', dot: 'bg-rose-700' },
  Persbericht: { badge: 'bg-cyan-50 text-cyan-900 ring-cyan-200', bar: 'bg-cyan-700', dot: 'bg-cyan-700' },
  Andere: { badge: 'bg-gray-100 text-gray-800 ring-gray-300', bar: 'bg-gray-600', dot: 'bg-gray-600' },
};

export function TypeBadge({ type }: { type: MomentType }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TYPE_STYLE[type].badge}`}>
      {type}
    </span>
  );
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ${className}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Switch

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          size === 'sm' ? 'h-6 w-10' : 'h-7 w-12'
        } ${checked ? 'bg-brand-700' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block rounded-full bg-white shadow transition-transform ${
            size === 'sm' ? 'size-5' : 'size-6'
          } ${checked ? (size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5'}`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm text-gray-800 select-none">
        {label}
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay helpers

// Only the top-most overlay reacts to Escape.
const escStack: symbol[] = [];
function useEscape(onClose: () => void, active: boolean) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!active) return;
    const token = Symbol('overlay');
    escStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escStack[escStack.length - 1] === token) cb.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = escStack.indexOf(token);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, [active]);
}

let openOverlays = 0;
function useBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    openOverlays++;
    document.body.style.overflow = 'hidden';
    return () => {
      openOverlays--;
      if (openOverlays <= 0) document.body.style.overflow = '';
    };
  }, [active]);
}

function useInitialFocus(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current;
      el?.focus({ preventScroll: true });
    }, 30);
    return () => {
      clearTimeout(t);
      previous?.focus?.({ preventScroll: true });
    };
  }, [active, ref]);
}

/** Keep Tab inside the dialog. */
function trapTab(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab' || e.defaultPrevented) return;
  const root = e.currentTarget;
  // Events from a portalled child dialog bubble through React; let that dialog handle them.
  if (!root.contains(e.target as Node)) return;
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscape(onClose, open);
  useBodyLock(open);
  useInitialFocus(ref, open);
  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="anim-fade-in absolute inset-0 bg-gray-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`anim-pop-in relative flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:max-h-[90dvh] sm:rounded-2xl ${width}`}
      >
        <div className="flex items-start gap-3 border-b border-gray-200 px-5 py-3.5 sm:px-6">
          <div className="min-w-0 flex-1 pt-1.5">
            <h2 id={titleId} className="text-lg font-bold text-gray-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label="Sluiten">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-3 sm:px-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose, open);
  useBodyLock(open);
  useInitialFocus(ref, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="anim-fade-in absolute inset-0 bg-gray-900/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="anim-slide-in relative flex h-full w-full flex-col bg-white shadow-2xl outline-none sm:max-w-xl"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Toasts

type Tone = 'success' | 'info' | 'warning';
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="anim-pop-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            {t.tone === 'success' && <Check className="size-4 shrink-0 text-brand-300" />}
            {t.tone === 'info' && <Info className="size-4 shrink-0 text-sky-300" />}
            {t.tone === 'warning' && <CircleAlert className="size-4 shrink-0 text-amber-300" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ---------------------------------------------------------------------------

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-base font-bold text-gray-900">{children}</h3>
      {aside}
    </div>
  );
}

export function SimNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 ring-inset">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
