import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ASCIISpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ASCIISpinner: React.FC<ASCIISpinnerProps> = ({ 
  size = 'md', 
  className 
}) => {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 100);

    return () => clearInterval(interval);
  }, [frames.length]);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <span className={cn(
      "text-green-400 font-mono",
      sizeClasses[size],
      className
    )}>
      {frames[frame]}
    </span>
  );
};

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  className?: string;
  showPercentage?: boolean;
}

export const ASCIIProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  className,
  showPercentage = true
}) => {
  const barWidth = 40;
  const filledWidth = Math.round((progress / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  return (
    <div className={cn("font-mono text-sm", className)}>
      {label && (
        <div className="text-green-300 mb-1">{label}</div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-green-400">[</span>
        <span className="text-green-400">
          {'█'.repeat(filledWidth)}
          {'░'.repeat(emptyWidth)}
        </span>
        <span className="text-green-400">]</span>
        {showPercentage && (
          <span className="text-green-300 ml-2">
            {progress.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = "Loading...",
  children
}) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <ASCIISpinner size="lg" />
              <span className="text-green-300 font-mono">{message}</span>
            </div>
            <div className="text-green-600 text-xs font-mono">
              ┌─────────────────────┐
              │   Please wait...    │
              └─────────────────────┘
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SkeletonProps {
  lines?: number;
  className?: string;
}

export const ASCIISkeleton: React.FC<SkeletonProps> = ({ 
  lines = 3, 
  className 
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="font-mono text-green-600/50">
          {'░'.repeat(Math.floor(Math.random() * 20) + 20)}
        </div>
      ))}
    </div>
  );
};