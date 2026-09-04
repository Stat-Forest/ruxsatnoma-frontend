import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X, Inbox } from 'lucide-react';

// ── 1. Alert Banner ──────────────────────────────────────────────────────────
export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  actionText,
  onAction,
  className = '',
}) => {
  const variantStyles: Record<
    AlertVariant,
    { bg: string; border: string; text: string; icon: React.ReactNode }
  > = {
    info: {
      bg: 'bg-[#F0F7F1]',
      border: 'border-l-4 border-[#0369A1]',
      text: 'text-[#1A1F24]',
      icon: <Info className="w-5 h-5 text-[#0369A1] shrink-0 mt-0.5" />,
    },
    success: {
      bg: 'bg-[#F0F7F1]',
      border: 'border-l-4 border-[#15803D]',
      text: 'text-[#123522]',
      icon: <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-[#FFFBEB]',
      border: 'border-l-4 border-[#B45309]',
      text: 'text-[#92400E]',
      icon: <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />,
    },
    danger: {
      bg: 'bg-[#FEF2F2]',
      border: 'border-l-4 border-[#B91C1C]',
      text: 'text-[#991B1B]',
      icon: <AlertCircle className="w-5 h-5 text-[#B91C1C] shrink-0 mt-0.5" />,
    },
  };

  const current = variantStyles[variant];

  return (
    <div
      className={`p-4 rounded-r-md ${current.bg} ${current.border} ${current.text} shadow-sm ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {current.icon}
        <div className="flex-1 text-sm leading-relaxed">
          {title && <h4 className="font-semibold text-base mb-1">{title}</h4>}
          <div>{children}</div>
          {actionText && onAction && (
            <button
              onClick={onAction}
              className="mt-2 text-xs font-semibold underline hover:opacity-80 transition-opacity"
            >
              {actionText}
            </button>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black/5 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ── 2. Toast Notification ──────────────────────────────────────────────────
export interface ToastProps {
  variant?: AlertVariant;
  message: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  variant = 'info',
  message,
  description,
  onClose,
  className = '',
}) => {
  return (
    <div
      className={`max-w-md w-full bg-white border border-[#E4E7EA] rounded-lg shadow-lg p-4 flex items-start gap-3 ${className}`}
    >
      <Alert variant={variant} className="w-full bg-transparent border-0 p-0 shadow-none">
        <div className="font-medium">{message}</div>
        {description && <div className="text-xs text-[#5A646D] mt-1">{description}</div>}
      </Alert>
      {onClose && (
        <button onClick={onClose} className="text-[#9AA3AB] hover:text-[#1A1F24]">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ── 3. Progress Bar ────────────────────────────────────────────────────────
export interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  showPercentage?: boolean;
  colorClass?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  showPercentage = true,
  colorClass = 'bg-[#2E7D4F]',
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-xs font-medium text-[#5A646D] mb-1.5">
          {label && <span>{label}</span>}
          {showPercentage && <span>{clamped}%</span>}
        </div>
      )}
      <div className="w-full bg-[#E4E7EA] rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

// ── 4. Skeleton Loader ──────────────────────────────────────────────────────
export interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = 'w-full',
  height = 'h-4',
  circle = false,
}) => {
  const roundedStyle = circle ? 'rounded-full' : 'rounded-md';
  return (
    <div
      className={`animate-pulse bg-[#E4E7EA] ${width} ${height} ${roundedStyle} ${className}`}
    />
  );
};

// ── 5. Empty State ──────────────────────────────────────────────────────────
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-[#E4E7EA] rounded-xl p-8 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-[#F0F7F1] flex items-center justify-center text-[#2E7D4F] mb-4">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-[#1A1F24] mb-1">{title}</h3>
      <p className="text-sm text-[#5A646D] max-w-sm mb-6 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="h-10 px-4 text-sm font-semibold rounded-md bg-[#2E7D4F] text-white hover:bg-[#23653F] transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
