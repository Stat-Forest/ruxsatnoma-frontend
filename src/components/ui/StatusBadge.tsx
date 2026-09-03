import React from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';

export type StatusType = 'draft' | 'pending' | 'approved' | 'rejected' | 'warning' | 'info';

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showIcon = true,
  size = 'md',
  className = '',
}) => {
  const defaultConfig: Record<
    StatusType,
    { textUz: string; textRu: string; bg: string; text: string; dot: string; icon: React.ReactNode }
  > = {
    draft: {
      textUz: 'Qoralama',
      textRu: 'Черновик',
      bg: 'bg-[#F8F9FA] border border-[#E4E7EA]',
      text: 'text-[#5A646D]',
      dot: 'bg-[#9AA3AB]',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    pending: {
      textUz: 'Kutilmoqda',
      textRu: 'В обработке',
      bg: 'bg-[#E0F2FE] border border-[#BAE6FD]',
      text: 'text-[#0369A1]',
      dot: 'bg-[#0284C7]',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    approved: {
      textUz: 'Tasdiqlandi',
      textRu: 'Одобрено',
      bg: 'bg-[#F0F7F1] border border-[#D9EBDC]',
      text: 'text-[#123522]',
      dot: 'bg-[#15803D]',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    rejected: {
      textUz: 'Rad etildi',
      textRu: 'Отклонено',
      bg: 'bg-[#FEF2F2] border border-[#FCA5A5]',
      text: 'text-[#991B1B]',
      dot: 'bg-[#B91C1C]',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    warning: {
      textUz: 'Muddati tugamoqda',
      textRu: 'Срок истекает',
      bg: 'bg-[#FFFBEB] border border-[#FDE68A]',
      text: 'text-[#92400E]',
      dot: 'bg-[#B45309]',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    info: {
      textUz: 'Maʼlumot',
      textRu: 'Информация',
      bg: 'bg-[#F0F9FF] border border-[#E0F2FE]',
      text: 'text-[#0369A1]',
      dot: 'bg-[#0369A1]',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
  };

  const conf = defaultConfig[status] || defaultConfig.draft;
  const displayText = label || conf.textUz;

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-sm gap-1.5 font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-full ${conf.bg} ${conf.text} ${sizeClasses} ${className}`}
    >
      {showIcon ? (
        <span className="shrink-0">{conf.icon}</span>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${conf.dot} shrink-0`} />
      )}
      <span>{displayText}</span>
    </span>
  );
};

export interface StatusCardProps {
  title: string;
  count: number | string;
  status: StatusType;
  subtitle?: string;
  className?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  count,
  status,
  subtitle,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-[#E4E7EA] rounded-xl p-5 shadow-sm flex items-center justify-between ${className}`}
    >
      <div>
        <span className="text-xs font-semibold text-[#5A646D] uppercase tracking-wider">
          {title}
        </span>
        <div className="text-2xl font-bold text-[#1A1F24] mt-1">{count}</div>
        {subtitle && <p className="text-xs text-[#767F87] mt-1">{subtitle}</p>}
      </div>
      <StatusBadge status={status} size="sm" />
    </div>
  );
};
