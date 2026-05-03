'use client';
import { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useState } from 'react';
import { clsx } from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

// ── Button ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  as?: 'button' | 'span';
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-brand-600 hover:bg-brand-500 text-white border-transparent shadow-lg hover:shadow-brand-600/25',
  secondary: 'bg-surface-700 hover:bg-surface-700/80 text-white border-white/10',
  danger:    'bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/30',
  ghost:     'bg-transparent hover:bg-white/5 text-white/70 hover:text-white border-transparent',
  outline:   'bg-transparent hover:bg-white/5 text-white border-white/15 hover:border-white/25',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm:  'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5',
  md:  'px-4 py-2   text-sm font-medium rounded-lg gap-2',
  lg:  'px-6 py-2.5 text-sm font-semibold rounded-xl gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, as = 'button', ...props }, ref) => {
    const classes = clsx(
        'inline-flex items-center justify-center border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      );
    const content = (
      <>
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        {children}
      </>
    );

    if (as === 'span') {
      return <span className={classes} aria-disabled={disabled || loading}>{content}</span>;
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {content}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ── Input ───────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = props.type === 'password';
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-white/70">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full px-3.5 py-2.5 text-sm rounded-lg transition-all',
              isPassword && 'pr-10',
              error && 'border-red-500/50 focus:border-red-500',
              className
            )}
            {...props}
            type={isPassword && showPassword ? 'text' : props.type}
          />
          {isPassword && (
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/35 transition hover:bg-white/5 hover:text-white/70"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-white/40">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ── Select ──────────────────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={selectId} className="text-sm font-medium text-white/70">{label}</label>}
        <select
          ref={ref}
          id={selectId}
          className={clsx('w-full px-3.5 py-2.5 text-sm rounded-lg transition-all cursor-pointer', className)}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={textareaId} className="text-sm font-medium text-white/70">{label}</label>}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx('w-full px-3.5 py-2.5 text-sm rounded-lg transition-all resize-none', className)}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ── Badge ───────────────────────────────────────────────────────────────────
type BadgeVariant = 'present' | 'absent' | 'late' | 'excused' | 'pending' | 'approved' | 'rejected' | 'admin' | 'teacher' | 'student';

const badgeMap: Record<string, string> = {
  present:  'badge-present',
  absent:   'badge-absent',
  late:     'badge-late',
  excused:  'badge-excused',
  pending:  'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  admin:    'bg-purple-500/15 text-purple-300 border border-purple-500/25',
  teacher:  'bg-brand-500/15 text-brand-300 border border-brand-500/25',
  student:  'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25',
};

export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
      badgeMap[value] || 'bg-white/10 text-white/60',
      className
    )}>
      {value}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('card p-4 sm:p-6', className)} {...props}>
      {children}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({
  title, value, subtitle, icon, color = 'blue', trend,
}: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ReactNode; color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  trend?: { value: number; label: string };
}) {
  const colorMap = {
    blue:   { bg: 'bg-brand-500/10',  text: 'text-brand-400',  border: 'border-brand-500/20' },
    green:  { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20' },
    amber:  { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/20' },
    red:    { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  };
  const c = colorMap[color];

  return (
    <div className="card p-5 hover:border-white/12 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className={clsx('p-2.5 rounded-xl border', c.bg, c.border)}>
          <span className={c.text}>{icon}</span>
        </div>
        {trend && (
          <span className={clsx('text-xs font-medium', trend.value >= 0 ? 'text-green-400' : 'text-red-400')}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className="font-display text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm font-medium text-white/60">{title}</div>
      {subtitle && <div className="text-xs text-white/35 mt-0.5">{subtitle}</div>}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  isOpen, onClose, title, children, size = 'md'
}: {
  isOpen: boolean; onClose: () => void; title: string;
  children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!isOpen) return null;
  const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative max-h-[90vh] w-full overflow-y-auto card p-4 sm:p-6 animate-fade-up', sizeMap[size])}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-white/5 mb-4 text-white/30">{icon}</div>
      <h3 className="font-display text-lg font-semibold text-white/60 mb-1">{title}</h3>
      {description && <p className="text-sm text-white/35 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}
