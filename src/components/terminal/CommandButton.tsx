import React from 'react';
import { cn } from '@/lib/utils';

export interface CommandButtonProps {
  command: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles = {
  primary: {
    border: 'border-green-400',
    text: 'text-green-400',
    hover: 'hover:bg-green-400/10 hover:shadow-green-400/20',
    active: 'active:bg-green-400/20',
  },
  secondary: {
    border: 'border-blue-400',
    text: 'text-blue-400',
    hover: 'hover:bg-blue-400/10 hover:shadow-blue-400/20',
    active: 'active:bg-blue-400/20',
  },
  danger: {
    border: 'border-red-400',
    text: 'text-red-400',
    hover: 'hover:bg-red-400/10 hover:shadow-red-400/20',
    active: 'active:bg-red-400/20',
  },
};

const sizeStyles = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
};

export const CommandButton: React.FC<CommandButtonProps> = ({
  command,
  description,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className,
}) => {
  const styles = variantStyles[variant];
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'font-mono border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black',
        styles.border,
        styles.text,
        sizeStyles[size],
        disabled 
          ? 'opacity-50 cursor-not-allowed border-gray-600 text-gray-600'
          : cn(styles.hover, styles.active, 'shadow-lg'),
        className
      )}
      title={description}
    >
      <div className="flex items-center gap-2">
        <span className="opacity-60">$</span>
        <span>{command}</span>
      </div>
    </button>
  );
};