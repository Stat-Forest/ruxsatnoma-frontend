import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// ── FormField Container ──────────────────────────────────────────────────────
export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  helperText,
  children,
  className = '',
  htmlFor,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold uppercase tracking-wider text-[#5A646D] flex items-center gap-1"
        >
          <span>{label}</span>
          {required && <span className="text-[#B91C1C] font-bold" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-[#B91C1C] flex items-center gap-1 mt-0.5" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-[#5A646D] mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
};

// ── Text Input Component ─────────────────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  touchSize?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      error,
      success,
      leftIcon,
      rightIcon,
      touchSize = false,
      disabled,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const isError = Boolean(error);
    const heightClass = touchSize ? 'h-[48px] text-base' : 'h-[40px] text-sm';

    let borderClass = 'border-[#767F87] focus:border-[#2E7D4F] focus:ring-2 focus:ring-[#2E7D4F]/20';
    if (isError) {
      borderClass = 'border-[#B91C1C] focus:border-[#B91C1C] focus:ring-2 focus:ring-[#B91C1C]/20';
    } else if (success) {
      borderClass = 'border-[#15803D] focus:border-[#15803D] focus:ring-2 focus:ring-[#15803D]/20';
    }

    return (
      <div className="relative w-full inline-flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-[#767F87] pointer-events-none inline-flex items-center">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          className={`w-full bg-white border rounded-md px-3 text-[#1A1F24] placeholder-[#9AA3AB] transition-all outline-none disabled:bg-[#F8F9FA] disabled:text-[#9AA3AB] disabled:cursor-not-allowed ${heightClass} ${
            leftIcon ? 'pl-9' : ''
          } ${rightIcon || isError || success ? 'pr-9' : ''} ${borderClass} ${className}`}
          {...props}
        />
        {(rightIcon || isError || success) && (
          <span className="absolute right-3 inline-flex items-center pointer-events-none">
            {isError ? (
              <AlertCircle className="w-4 h-4 text-[#B91C1C]" />
            ) : success ? (
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
            ) : (
              rightIcon
            )}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ── Select Component ────────────────────────────────────────────────────────
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  error?: boolean;
  touchSize?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, error, touchSize = false, className = '', disabled, ...props }, ref) => {
    const heightClass = touchSize ? 'h-[48px] text-base' : 'h-[40px] text-sm';
    const borderClass = error
      ? 'border-[#B91C1C] focus:ring-2 focus:ring-[#B91C1C]/20'
      : 'border-[#767F87] focus:border-[#2E7D4F] focus:ring-2 focus:ring-[#2E7D4F]/20';

    return (
      <select
        ref={ref}
        disabled={disabled}
        className={`w-full bg-white border rounded-md px-3 text-[#1A1F24] transition-all outline-none disabled:bg-[#F8F9FA] disabled:text-[#9AA3AB] disabled:cursor-not-allowed ${heightClass} ${borderClass} ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);
Select.displayName = 'Select';

// ── Textarea Component ──────────────────────────────────────────────────────
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  maxLength?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, maxLength, value, onChange, className = '', disabled, ...props }, ref) => {
    const charCount = typeof value === 'string' ? value.length : 0;
    const borderClass = error
      ? 'border-[#B91C1C] focus:ring-2 focus:ring-[#B91C1C]/20'
      : 'border-[#767F87] focus:border-[#2E7D4F] focus:ring-2 focus:ring-[#2E7D4F]/20';

    return (
      <div className="w-full flex flex-col">
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          disabled={disabled}
          className={`w-full bg-white border rounded-md p-3 text-sm text-[#1A1F24] placeholder-[#9AA3AB] min-h-[100px] resize-y transition-all outline-none disabled:bg-[#F8F9FA] disabled:text-[#9AA3AB] ${borderClass} ${className}`}
          {...props}
        />
        {maxLength && (
          <div className="text-right text-xs text-[#5A646D] mt-1 font-mono">
            {charCount}/{maxLength}
          </div>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ── Checkbox Component ──────────────────────────────────────────────────────
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, hint, className = '', disabled, id, ...props }, ref) => {
    const inputId = id || `checkbox-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className={`flex items-start gap-2.5 ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          disabled={disabled}
          className="w-5 h-5 mt-0.5 accent-[#2E7D4F] border-[#767F87] rounded cursor-pointer disabled:cursor-not-allowed"
          {...props}
        />
        <div className="flex flex-col">
          <label
            htmlFor={inputId}
            className={`text-sm font-medium text-[#1A1F24] cursor-pointer select-none ${
              disabled ? 'text-[#9AA3AB] cursor-not-allowed' : ''
            }`}
          >
            {label}
          </label>
          {hint && <span className="text-xs text-[#5A646D]">{hint}</span>}
        </div>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

// ── RadioGroup Component ────────────────────────────────────────────────────
export interface RadioOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  selectedValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  selectedValue,
  onChange,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-2.5 cursor-pointer ${
            opt.disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={selectedValue === opt.value}
            disabled={opt.disabled}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-5 h-5 mt-0.5 accent-[#2E7D4F] border-[#767F87] cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[#1A1F24] select-none">{opt.label}</span>
            {opt.hint && <span className="text-xs text-[#5A646D]">{opt.hint}</span>}
          </div>
        </label>
      ))}
    </div>
  );
};

// ── Switch (Toggle) Component ───────────────────────────────────────────────
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors ${
            checked ? 'bg-[#2E7D4F]' : 'bg-[#9AA3AB]'
          }`}
        />
        <div
          className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      {label && <span className="text-sm font-medium text-[#1A1F24] select-none">{label}</span>}
    </label>
  );
};
