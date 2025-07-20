import React from 'react';
import { cn } from '@/lib/utils';

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'connecting' | 'error' | 'warning' | 'success';
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const statusConfig = {
  online: {
    color: 'text-green-400',
    bgColor: 'bg-green-400',
    symbol: '●',
    label: 'ONLINE',
  },
  offline: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-400',
    symbol: '○',
    label: 'OFFLINE',
  },
  connecting: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400',
    symbol: '◐',
    label: 'CONNECTING',
  },
  error: {
    color: 'text-red-400',
    bgColor: 'bg-red-400',
    symbol: '✕',
    label: 'ERROR',
  },
  warning: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-400',
    symbol: '⚠',
    label: 'WARNING',
  },
  success: {
    color: 'text-green-400',
    bgColor: 'bg-green-400',
    symbol: '✓',
    label: 'SUCCESS',
  },
};

const sizeConfig = {
  sm: {
    text: 'text-xs',
    symbol: 'text-sm',
    spacing: 'gap-1',
  },
  md: {
    text: 'text-sm',
    symbol: 'text-base',
    spacing: 'gap-2',
  },
  lg: {
    text: 'text-base',
    symbol: 'text-lg',
    spacing: 'gap-3',
  },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  showLabel = true,
  size = 'md',
  animated = false,
  className,
}) => {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const displayLabel = label || config.label;

  return (
    <div className={cn(
      'flex items-center font-mono',
      sizeStyles.spacing,
      className
    )}>
      {/* Status Symbol */}
      <span className={cn(
        config.color,
        sizeStyles.symbol,
        animated && status === 'connecting' && 'animate-spin',
        animated && status === 'online' && 'animate-pulse'
      )}>
        {config.symbol}
      </span>

      {/* Status Label */}
      {showLabel && (
        <span className={cn(
          config.color,
          sizeStyles.text,
          'font-bold tracking-wider'
        )}>
          [{displayLabel}]
        </span>
      )}
    </div>
  );
};

// Progress Bar Component for terminal-style loading
export interface TerminalProgressProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  width?: number;
  className?: string;
}

export const TerminalProgress: React.FC<TerminalProgressProps> = ({
  progress,
  label,
  showPercentage = true,
  width = 40,
  className,
}) => {
  const filledWidth = Math.round((progress / 100) * width);
  const emptyWidth = width - filledWidth;

  return (
    <div className={cn('font-mono text-green-400', className)}>
      {label && (
        <div className="text-xs mb-1 opacity-80">
          {label}
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <span className="text-xs">[</span>
        
        <div className="flex">
          {/* Filled portion */}
          <span className="text-green-400">
            {'█'.repeat(filledWidth)}
          </span>
          
          {/* Empty portion */}
          <span className="text-green-400/30">
            {'░'.repeat(emptyWidth)}
          </span>
        </div>
        
        <span className="text-xs">]</span>
        
        {showPercentage && (
          <span className="text-xs font-bold min-w-[3ch] text-right">
            {Math.round(progress)}%
          </span>
        )}
      </div>
    </div>
  );
};