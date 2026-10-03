import type { ApplicationStatus } from './api';
import { APPLICATION_STATUS_STYLE, GREY, type StatusStyle } from './statusMeta';

export interface ApplicationStatusBadgeProps {
  /** A plain string, not only `ApplicationStatus`: a notification's
   * `status_to` param is untyped JSON, and an unknown code must still draw
   * (grey, no icon) rather than crash the inbox. */
  status: string;
  /** The caller's own wording — the applicant's screens and the staff's
   * label some statuses differently ("Yuborildi" / "Yuborilgan"); the badge
   * only decides how the status looks. */
  label: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export function ApplicationStatusBadge({
  status,
  label,
  size = 'sm',
  showIcon = true,
  className = '',
}: ApplicationStatusBadgeProps) {
  const style: StatusStyle | undefined = APPLICATION_STATUS_STYLE[status as ApplicationStatus];
  const Icon = style?.icon;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-sm gap-1.5';
  return (
    <span
      data-status={status}
      className={`inline-flex items-center whitespace-nowrap rounded-full border font-semibold ${
        style?.className ?? GREY
      } ${sizeClasses} ${className}`}
    >
      {showIcon && Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
