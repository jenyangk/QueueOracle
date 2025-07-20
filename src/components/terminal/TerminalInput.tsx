import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface TerminalInputProps {
  onSubmit: (command: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  prompt?: string;
  history?: string[];
  autoComplete?: string[];
}

export const TerminalInput: React.FC<TerminalInputProps> = ({
  onSubmit,
  placeholder = 'Enter command...',
  disabled = false,
  className,
  prompt = '$',
  history = [],
  autoComplete = [],
}) => {
  const [value, setValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle command submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue('');
      setHistoryIndex(-1);
      setShowSuggestions(false);
    }
  };

  // Handle input changes and auto-complete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setHistoryIndex(-1);

    // Show suggestions if there's input
    if (newValue.trim() && autoComplete.length > 0) {
      const filtered = autoComplete.filter(cmd => 
        cmd.toLowerCase().startsWith(newValue.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (history.length > 0) {
          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          setValue(history[history.length - 1 - newIndex] || '');
          setShowSuggestions(false);
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setValue(history[history.length - 1 - newIndex] || '');
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setValue('');
        }
        setShowSuggestions(false);
        break;
        
      case 'Tab':
        e.preventDefault();
        if (suggestions.length > 0) {
          setValue(suggestions[0] || '');
          setShowSuggestions(false);
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Focus input on mount
  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit} className="flex items-center">
        {/* Command Prompt */}
        <span className="text-green-400 font-mono text-sm mr-2 select-none">
          {prompt}
        </span>
        
        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex-1 bg-transparent border-none outline-none',
            'font-mono text-sm text-green-400 placeholder-green-400/40',
            'focus:ring-0 focus:border-none',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        
        {/* Cursor */}
        <span className="text-green-400 font-mono text-sm animate-pulse ml-1">
          █
        </span>
      </form>

      {/* Auto-complete Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1">
          <div className="bg-black border border-green-400 shadow-lg shadow-green-400/20">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  'w-full text-left px-3 py-1 font-mono text-sm',
                  'text-green-400 hover:bg-green-400/10',
                  'border-b border-green-400/30 last:border-b-0',
                  'transition-colors'
                )}
              >
                <span className="opacity-60">$ </span>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};