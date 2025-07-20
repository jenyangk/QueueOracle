import React from 'react';
import { cn } from '@/lib/utils';

interface GridContainerProps {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

export const GridContainer: React.FC<GridContainerProps> = ({
  children,
  className,
  columns = 2,
  gap = 'md'
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
    4: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4'
  };

  const gridGap = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  return (
    <div className={cn(
      "grid",
      gridCols[columns],
      gridGap[gap],
      className
    )}>
      {children}
    </div>
  );
};

interface GridPanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  fullHeight?: boolean;
}

export const GridPanel: React.FC<GridPanelProps> = ({
  children,
  title,
  className,
  fullHeight = false
}) => {
  return (
    <div className={cn(
      "border border-green-400/30 bg-black/50",
      fullHeight && "h-full",
      className
    )}>
      {/* ASCII Panel Header */}
      {title && (
        <div className="border-b border-green-400/30 p-2">
          <div className="text-green-300 text-sm font-mono">
            <span className="text-green-400">┌─</span>
            <span className="mx-2">{title}</span>
            <span className="text-green-400">─┐</span>
          </div>
        </div>
      )}
      
      {/* Panel Content */}
      <div className="p-4">
        {children}
      </div>
      
      {/* ASCII Panel Footer */}
      {title && (
        <div className="text-green-400/30 text-xs leading-none px-2">
          └{'─'.repeat(title.length + 4)}┘
        </div>
      )}
    </div>
  );
};