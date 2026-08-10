import React from 'react';
import { ChevronRight, Check } from 'lucide-react';

// ── 1. Breadcrumbs ─────────────────────────────────────────────────────────
export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-sm ${className}`}>
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-[#9AA3AB] mx-1.5 shrink-0" />
              )}
              {isLast ? (
                <span className="font-semibold text-[#1A1F24]" aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  className="text-[#5A646D] hover:text-[#2E7D4F] transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <button
                  onClick={item.onClick}
                  className="text-[#5A646D] hover:text-[#2E7D4F] transition-colors"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// ── 2. Tabs ────────────────────────────────────────────────────────────────
export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTabId,
  onChange,
  className = '',
}) => {
  return (
    <div className={`border-b border-[#E4E7EA] ${className}`}>
      <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onChange(tab.id)}
              disabled={tab.disabled}
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                isActive
                  ? 'border-[#2E7D4F] text-[#2E7D4F] font-semibold'
                  : 'border-transparent text-[#5A646D] hover:text-[#1A1F24] hover:border-[#9AA3AB]'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-[#F0F7F1] text-[#2E7D4F]' : 'bg-[#E4E7EA] text-[#5A646D]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

// ── 3. Pagination ──────────────────────────────────────────────────────────
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  totalRecords?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize = 10,
  onPageSizeChange,
  totalRecords,
  className = '',
}) => {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 text-sm text-[#5A646D] ${className}`}>
      {totalRecords && (
        <div>
          Jami <span className="font-semibold text-[#1A1F24]">{totalRecords}</span> ta yozuv
        </div>
      )}

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 mr-4">
            <span className="text-xs">Qatolar:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 border border-[#767F87] rounded px-2 text-xs bg-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}

        <div className="flex items-center space-x-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-8 px-2.5 rounded border border-[#767F87] hover:bg-[#F8F9FA] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Oldingi
          </button>
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`h-8 w-8 rounded text-xs font-semibold ${
                p === currentPage
                  ? 'bg-[#2E7D4F] text-white'
                  : 'hover:bg-[#F8F9FA] border border-transparent text-[#1A1F24]'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-8 px-2.5 rounded border border-[#767F87] hover:bg-[#F8F9FA] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Keyingi
          </button>
        </div>
      </div>
    </div>
  );
};

// ── 4. Stepper ─────────────────────────────────────────────────────────────
export interface StepItem {
  id: number;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <div className={`w-full py-4 ${className}`}>
      <ol className="flex items-center w-full text-xs font-medium text-center text-gray-500 sm:text-base">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <li
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              className={`flex md:w-full items-center ${
                index !== steps.length - 1 ? 'after:w-full after:h-0.5 after:border-b after:border-gray-200 after:border-1 after:inline-block md:after:inline-block' : ''
              } ${onStepClick ? 'cursor-pointer' : ''}`}
            >
              <span className="flex items-center after:content-['/'] sm:after:hidden after:mx-2 after:text-gray-200">
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                    isCompleted
                      ? 'bg-[#2E7D4F] text-white'
                      : isActive
                      ? 'bg-[#F0F7F1] border-2 border-[#2E7D4F] text-[#2E7D4F] font-bold'
                      : 'bg-[#E4E7EA] text-[#5A646D]'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </span>
                <span className="ml-2 hidden sm:inline-block text-left">
                  <span className={`block text-xs font-semibold ${isActive ? 'text-[#2E7D4F]' : 'text-[#1A1F24]'}`}>
                    {step.title}
                  </span>
                  {step.description && (
                    <span className="block text-[11px] text-[#5A646D]">{step.description}</span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
