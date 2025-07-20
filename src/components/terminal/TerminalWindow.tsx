import React from 'react';
import { cn } from '@/lib/utils';

export interface TerminalAction {
  label: string;
  command: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface TerminalWindowProps {
  title: string;
  children: React.ReactNode;
  actions?: TerminalAction[];
  status: 'connected' | 'disconnected' | 'error';
  className?: string;
}

const statusColors = {
  connected: 'text-green-400',
  disconnected: 'text-yellow-400',
  error: 'text-red-400',
};

const statusIndicators = {
  connected: '●',
  disconnected: '○',
  error: '✕',
};

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  title,
  children,
  actions = [],
  status,
  className,
}) => {
  return (
    <div className={cn(
      'bg-black border border-green-400 font-mono text-green-400 text-sm',
      'shadow-lg shadow-green-400/20',
      className
    )}>
      {/* Terminal Header */}
      <div className="border-b border-green-400 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('text-lg', statusColors[status])}>
            {statusIndicators[status]}
          </span>
          <span className="text-green-400 font-bold">
            [{title.toUpperCase()}]
          </span>
        </div>
        
        {actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  'px-2 py-1 text-xs border transition-colors',
                  'hover:bg-green-400/10 active:bg-green-400/20',
                  action.disabled 
                    ? 'border-gray-600 text-gray-600 cursor-not-allowed'
                    : 'border-green-400 text-green-400'
                )}
                title={action.command}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Terminal Content */}
      <div className="p-3">
        {children}
      </div>
    </div>
  );
};