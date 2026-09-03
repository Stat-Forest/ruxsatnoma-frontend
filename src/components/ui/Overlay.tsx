import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// ── 1. Modal Component ──────────────────────────────────────────────────────
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full ${maxWidthClasses[maxWidth]} bg-white rounded-xl shadow-xl z-10 overflow-hidden animate-in zoom-in-95 duration-200 border border-[#E4E7EA]`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#E4E7EA]">
          <div>
            <h3 className="text-lg font-semibold text-[#1A1F24]">{title}</h3>
            {subtitle && <p className="text-xs text-[#5A646D] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#767F87] hover:text-[#1A1F24] hover:bg-[#F8F9FA] transition-colors"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto text-sm text-[#1A1F24] leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 bg-[#F8F9FA] border-t border-[#E4E7EA] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ── 2. Drawer Component ─────────────────────────────────────────────────────
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: 'left' | 'right';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  position = 'right',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const posClass = position === 'right' ? 'right-0' : 'left-0';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40 transition-opacity" onClick={onClose} />

      <div
        className={`fixed top-0 bottom-0 ${posClass} w-full max-w-md bg-white shadow-2xl z-10 flex flex-col border-l border-[#E4E7EA] animate-in slide-in-from-right duration-300`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#E4E7EA]">
          <h3 className="font-semibold text-base text-[#1A1F24]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded text-[#767F87] hover:text-[#1A1F24]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto">{children}</div>

        {footer && <div className="p-4 border-t border-[#E4E7EA] bg-[#F8F9FA]">{footer}</div>}
      </div>
    </div>
  );
};

// ── 3. Tooltip Component ───────────────────────────────────────────────────
export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
}) => {
  const [visible, setVisible] = React.useState(false);

  const posClasses =
    position === 'top'
      ? '-top-9 left-1/2 -translate-x-1/2'
      : 'top-full mt-2 left-1/2 -translate-x-1/2';

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute ${posClasses} z-50 px-2.5 py-1 text-xs font-medium text-white bg-[#1A1F24] rounded shadow-md whitespace-nowrap pointer-events-none transition-opacity duration-150`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};
