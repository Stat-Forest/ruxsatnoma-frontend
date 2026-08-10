import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'touch';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // Base classes adhering to WCAG and design system metrics
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap';

    // Size variants
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2', // Standard 40px control height
      lg: 'h-12 px-6 text-base gap-2.5',
      touch: 'h-12 px-6 text-base gap-2.5 font-semibold shadow-sm', // 48px touch target for mobile/field work
    };

    // Color/Variant styles using defined design tokens
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-[#2E7D4F] hover:bg-[#23653F] active:bg-[#23653F] text-white focus:ring-[#2E7D4F] shadow-sm',
      secondary:
        'bg-white border border-[#767F87] text-[#1A1F24] hover:bg-[#F8F9FA] hover:border-[#9AA3AB] focus:ring-[#2E7D4F]',
      ghost:
        'bg-transparent text-[#2E7D4F] hover:bg-[#F0F7F1] focus:ring-[#2E7D4F]',
      danger:
        'bg-[#B91C1C] hover:bg-[#991B1B] active:bg-[#991B1B] text-white focus:ring-[#B91C1C] shadow-sm',
      success:
        'bg-[#15803D] hover:bg-[#166534] active:bg-[#166534] text-white focus:ring-[#15803D] shadow-sm',
      outline:
        'bg-transparent border border-[#E4E7EA] text-[#1A1F24] hover:bg-[#F8F9FA] focus:ring-[#2E7D4F]',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current mr-1" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className = '' }) => {
  return (
    <div className={`inline-flex items-center rounded-md shadow-sm -space-x-px ${className}`}>
      {children}
    </div>
  );
};
