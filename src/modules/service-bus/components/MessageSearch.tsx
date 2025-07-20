import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

export interface MessageSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export const MessageSearch: React.FC<MessageSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search messages...',
  className,
  debounceMs = 300,
}) => {
  const [localValue, setLocalValue] = useState(value);

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, onChange, value, debounceMs]);

  // Update local value when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  return (
    <div className={cn('relative', className)}>
      <div className="relative flex items-center">
        {/* Search Icon */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-400/60">
          <Search className="w-4 h-4" />
        </div>

        {/* Search Input */}
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-10 py-2 bg-black border border-green-400/30',
            'text-green-400 placeholder-green-400/40 font-mono text-sm',
            'focus:outline-none focus:border-green-400 focus:bg-green-400/5',
            'transition-colors'
          )}
        />

        {/* Clear Button */}
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400/60 hover:text-green-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Status */}
      {localValue && (
        <div className="mt-1 text-xs text-green-400/60 font-mono">
          <span className="text-green-400/40">&gt;</span> Searching for: "{localValue}"
        </div>
      )}
    </div>
  );
};