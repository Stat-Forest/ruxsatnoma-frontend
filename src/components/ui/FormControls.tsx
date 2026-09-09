import React, { useState, useRef, useEffect, useId } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { useLanguage, useT } from '../../i18n/useT';

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
        <span className="text-xs font-semibold uppercase tracking-wider text-[#5A646D] flex items-center gap-1">
          {/* The asterisk sits OUTSIDE the <label>: an accessible name is read
              from the label's text content, so a marker inside it turns "Rol"
              into "Rol*" and every by-label query on a required field misses —
              for a screen reader as much as for a test. */}
          <label htmlFor={htmlFor}>{label}</label>
          {required && (
            <span className="text-[#B91C1C] font-bold" aria-hidden="true">
              *
            </span>
          )}
        </span>
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

const DATE_PLACEHOLDERS: Record<string, string> = {
  en: 'YYYY-MM-DD',
  uz_latn: 'KK.OO.YYYY',
  uz_cyrl: 'КК.ОО.ЙЙЙЙ',
  ru: 'ДД.ММ.ГГГГ',
  kaa: 'KK.AA.JJJJ',
};

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
      type,
      value,
      defaultValue,
      placeholder,
      onFocus,
      onBlur,
      onChange,
      onInput,
      ...props
    },
    ref
  ) => {
    const isError = Boolean(error);
    const heightClass = touchSize ? 'h-[48px] text-base' : 'h-[40px] text-sm';

    let borderClass = 'border-[#E4E7EA] hover:border-[#CBD5E1] focus:border-[#2E7D4F] focus:ring-4 focus:ring-[#2E7D4F]/10';
    if (isError) {
      borderClass = 'border-[#B91C1C] focus:border-[#B91C1C] focus:ring-4 focus:ring-[#B91C1C]/15';
    } else if (success) {
      borderClass = 'border-[#15803D] focus:border-[#15803D] focus:ring-4 focus:ring-[#15803D]/15';
    }

    const { lang } = useLanguage();
    const isDate = type === 'date';
    const isControlled = value !== undefined;
    const [isFocused, setIsFocused] = useState(false);
    const [uncontrolledHasValue, setUncontrolledHasValue] = useState<boolean>(Boolean(defaultValue));
    const hasValue = isControlled ? Boolean(value) : uncontrolledHasValue;

    const datePlaceholder = placeholder || (isDate ? (DATE_PLACEHOLDERS[lang] ?? 'YYYY-MM-DD') : undefined);
    const showDatePlaceholder = isDate && !isFocused && !hasValue;

    const dateClasses = showDatePlaceholder
      ? 'text-transparent [&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent [&::-webkit-datetime-edit-text]:text-transparent [&::-webkit-datetime-edit-month-field]:text-transparent [&::-webkit-datetime-edit-day-field]:text-transparent [&::-webkit-datetime-edit-year-field]:text-transparent [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer'
      : isDate
      ? '[&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer'
      : '';

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
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={isDate ? undefined : placeholder}
          disabled={disabled}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            if (!isControlled) {
              setUncontrolledHasValue(Boolean(e.target.value));
            }
            onBlur?.(e);
          }}
          onChange={(e) => {
            if (!isControlled) {
              setUncontrolledHasValue(Boolean(e.target.value));
            }
            onChange?.(e);
          }}
          onInput={(e) => {
            if (!isControlled) {
              setUncontrolledHasValue(Boolean((e.target as HTMLInputElement).value));
            }
            onInput?.(e);
          }}
          className={`w-full bg-white border rounded-xl px-3.5 text-[#1A1F24] placeholder-[#9AA3AB] shadow-2xs transition-all outline-none disabled:bg-[#F8F9FA] disabled:text-[#9AA3AB] disabled:border-[#E4E7EA] disabled:cursor-not-allowed disabled:shadow-none ${heightClass} ${
            leftIcon ? 'pl-9' : ''
          } ${rightIcon || isError || success ? 'pr-9' : ''} ${borderClass} ${dateClasses} ${className}`}
          {...props}
        />
        {showDatePlaceholder && (
          <span
            data-testid="date-placeholder-overlay"
            aria-hidden="true"
            className={`absolute left-3.5 text-[#9AA3AB] pointer-events-none select-none tracking-wide ${
              touchSize ? 'text-base' : 'text-sm'
            } ${leftIcon ? 'pl-6' : ''}`}
          >
            {datePlaceholder}
          </span>
        )}
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
  (
    {
      options,
      error,
      touchSize = false,
      className = '',
      disabled,
      value,
      defaultValue,
      onChange,
      id,
      name,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const nativeSelectRef = useRef<HTMLSelectElement | null>(null);
    const autoId = useId();
    const selectId = id || autoId;

    const [internalValue, setInternalValue] = useState<string>(
      value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : ''
    );

    const currentValue = value !== undefined ? String(value) : internalValue;
    const selectedOption = options.find((opt) => String(opt.value) === currentValue);
    const displayLabel = selectedOption ? selectedOption.label : (options[0]?.label ?? '');

    useEffect(() => {
      if (!isOpen) return;
      function handleClickOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      }
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen]);

    function handleSelect(val: string) {
      if (disabled) return;
      setInternalValue(val);
      setIsOpen(false);

      if (nativeSelectRef.current) {
        nativeSelectRef.current.value = val;
        const event = new Event('change', { bubbles: true });
        nativeSelectRef.current.dispatchEvent(event);
      }

      if (onChange) {
        const syntheticEvent = {
          target: { value: val, name, id: selectId },
          currentTarget: { value: val, name, id: selectId },
        } as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
    }

    const heightClass = touchSize ? 'h-[48px] text-base' : 'h-[40px] text-sm';
    const borderClass = error
      ? 'border-[#B91C1C] ring-4 ring-[#B91C1C]/15'
      : isOpen
      ? 'border-[#2E7D4F] ring-4 ring-[#2E7D4F]/10'
      : 'border-[#E4E7EA] hover:border-[#CBD5E1]';

    return (
      <div ref={containerRef} className="relative w-full">
        {/* Accessible select for forms, testing-library and screen readers */}
        <select
          ref={(node) => {
            nativeSelectRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = node;
          }}
          id={selectId}
          name={name}
          value={currentValue}
          onChange={(e) => {
            setInternalValue(e.target.value);
            onChange?.(e);
          }}
          disabled={disabled}
          className="sr-only"
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom styled trigger button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between bg-white border rounded-xl pl-3.5 pr-3 text-[#1A1F24] font-medium shadow-2xs transition-all duration-150 outline-none text-left cursor-pointer hover:bg-[#FDFDFD] focus:bg-white disabled:bg-[#F8F9FA] disabled:text-[#9AA3AB] disabled:border-[#E4E7EA] disabled:cursor-not-allowed disabled:shadow-none ${heightClass} ${borderClass} ${className}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="truncate pr-2">{displayLabel}</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#2E7D4F]' : disabled ? 'text-[#C2C9D0]' : 'text-[#767F87]'
            }`}
          />
        </button>

        {/* Custom floating dropdown popover with smooth shadcn-like styling */}
        {isOpen && (
          <div
            role="listbox"
            className="absolute left-0 top-[calc(100%+6px)] w-full min-w-full z-50 bg-white border border-[#E4E7EA] rounded-2xl shadow-xl p-1.5 max-h-64 overflow-y-auto outline-none transition-all"
          >
            {options.map((opt) => {
              const isSelected = String(opt.value) === currentValue;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-colors cursor-pointer select-none ${
                    opt.disabled
                      ? 'text-[#9AA3AB] cursor-not-allowed bg-transparent'
                      : isSelected
                      ? 'bg-[#F0FDF4] text-[#15803D] font-semibold'
                      : 'text-[#1A1F24] hover:bg-[#F8F9FA]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-[#15803D] shrink-0 ml-2" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
      ? 'border-[#B91C1C] focus:border-[#B91C1C] focus:ring-4 focus:ring-[#B91C1C]/15'
      : 'border-[#E4E7EA] hover:border-[#CBD5E1] focus:border-[#2E7D4F] focus:ring-4 focus:ring-[#2E7D4F]/10';

    return (
      <div className="w-full flex flex-col">
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          disabled={disabled}
          className={`w-full bg-white border rounded-xl p-3.5 text-sm text-[#1A1F24] placeholder-[#9AA3AB] shadow-2xs min-h-[100px] resize-y transition-all outline-none disabled:bg-[#F8F9FA] disabled:text-[#9AA3AB] disabled:border-[#E4E7EA] disabled:shadow-none ${borderClass} ${className}`}
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
    const generatedId = React.useId();
    const inputId = id || generatedId;

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

// ── FileInput Component ─────────────────────────────────────────────────────
export interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: File | { name: string } | string | null;
  onChange?: (file: File | null) => void;
  error?: boolean | string;
  buttonLabel?: string;
  clearable?: boolean;
  isLoading?: boolean;
}

export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  (
    {
      id,
      name,
      accept,
      value,
      onChange,
      disabled = false,
      error,
      className = '',
      buttonLabel,
      clearable = true,
      isLoading = false,
      ...props
    },
    ref
  ) => {
    const t = useT();
    const autoId = useId();
    const inputId = id || autoId;
    const nativeInputRef = useRef<HTMLInputElement | null>(null);
    const [internalFile, setInternalFile] = useState<File | null>(null);

    const isError = Boolean(error);
    const isInteractionDisabled = disabled || isLoading;

    // Reset native input if value is cleared externally
    useEffect(() => {
      if (!value && nativeInputRef.current) {
        nativeInputRef.current.value = '';
      }
    }, [value]);

    const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0] ?? null;
      setInternalFile(selectedFile);
      onChange?.(selectedFile);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (nativeInputRef.current) {
        nativeInputRef.current.value = '';
      }
      setInternalFile(null);
      onChange?.(null);
    };

    const displayFileName =
      value !== undefined
        ? typeof value === 'string'
          ? value
          : value?.name ?? null
        : internalFile?.name ?? null;

    return (
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        <input
          ref={(node) => {
            nativeInputRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }}
          type="file"
          id={inputId}
          name={name}
          accept={accept}
          disabled={disabled}
          onChange={handleNativeChange}
          className="sr-only"
          {...props}
        />
        <button
          type="button"
          disabled={isInteractionDisabled}
          onClick={() => !isInteractionDisabled && nativeInputRef.current?.click()}
          className={`h-[40px] px-4 rounded-xl border bg-white font-medium text-sm inline-flex items-center gap-2 shadow-2xs transition-all cursor-pointer select-none outline-none ${
            isError
              ? 'border-[#B91C1C] text-[#B91C1C] hover:bg-[#FEF2F2] focus:ring-4 focus:ring-[#B91C1C]/15'
              : 'border-[#E4E7EA] text-[#1A1F24] hover:bg-[#F8F9FA] hover:border-[#CBD5E1] focus:border-[#2E7D4F] focus:ring-4 focus:ring-[#2E7D4F]/10'
          } disabled:bg-[#F8F9FA] disabled:text-[#9AA3AB] disabled:border-[#E4E7EA] disabled:cursor-not-allowed disabled:shadow-none`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#2E7D4F] shrink-0" />
          ) : (
            <Upload
              className={`w-4 h-4 shrink-0 ${
                isInteractionDisabled ? 'text-[#9AA3AB]' : isError ? 'text-[#B91C1C]' : 'text-[#2E7D4F]'
              }`}
            />
          )}
          <span>{buttonLabel || t('common.chooseFile')}</span>
        </button>

        {displayFileName ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0FDF4] border border-[#2E7D4F]/20 text-xs font-medium text-[#15803D] min-w-0 max-w-full">
            <Paperclip className="w-3.5 h-3.5 text-[#2E7D4F] shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-xs" title={displayFileName}>
              {displayFileName}
            </span>
            {clearable && !isInteractionDisabled && (
              <button
                type="button"
                onClick={handleClear}
                title={t('common.removeFile')}
                aria-label={t('common.removeFile')}
                className="p-0.5 -mr-1 rounded-md text-[#2E7D4F] hover:text-[#B91C1C] hover:bg-[#B91C1C]/10 transition-colors cursor-pointer inline-flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-[#767F87] select-none truncate">
            {t('common.noFileChosen')}
          </span>
        )}
      </div>
    );
  }
);
FileInput.displayName = 'FileInput';
