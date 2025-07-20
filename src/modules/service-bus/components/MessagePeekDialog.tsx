import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Eye } from 'lucide-react';

export interface MessagePeekDialogProps {
  onPeek: (count: number) => Promise<void>;
  onClose: () => void;
}

export const MessagePeekDialog: React.FC<MessagePeekDialogProps> = ({
  onPeek,
  onClose,
}) => {
  const [messageCount, setMessageCount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  const handlePeek = async () => {
    setIsLoading(true);
    try {
      await onPeek(messageCount);
    } finally {
      setIsLoading(false);
    }
  };

  const presetCounts = [1, 5, 10, 25, 50, 100];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-black border border-green-400 font-mono text-green-400 w-full max-w-md mx-4">
        {/* Dialog Header */}
        <div className="border-b border-green-400 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span className="font-bold">PEEK MESSAGES</span>
          </div>
          <button
            onClick={onClose}
            className="text-green-400 hover:text-green-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="p-4 space-y-4">
          <div>
            <div className="text-green-400/60 text-xs mb-2">
              Peek messages from the queue without removing them
            </div>
            
            <div className="space-y-3">
              {/* Message Count Input */}
              <div>
                <label className="block text-xs text-green-400 mb-1">
                  Number of messages to peek:
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={messageCount}
                  onChange={(e) => setMessageCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-black border border-green-400/30 text-green-400 font-mono text-sm focus:outline-none focus:border-green-400"
                />
              </div>

              {/* Preset Buttons */}
              <div>
                <div className="text-xs text-green-400/60 mb-2">Quick select:</div>
                <div className="flex flex-wrap gap-2">
                  {presetCounts.map((count) => (
                    <button
                      key={count}
                      onClick={() => setMessageCount(count)}
                      className={cn(
                        'px-3 py-1 text-xs border transition-colors',
                        messageCount === count
                          ? 'border-green-400 text-green-400 bg-green-400/10'
                          : 'border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400'
                      )}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning for large counts */}
              {messageCount > 50 && (
                <div className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 p-2">
                  ⚠️ Peeking large numbers of messages may impact performance
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-green-400/30">
            <button
              onClick={handlePeek}
              disabled={isLoading}
              className={cn(
                'flex-1 px-4 py-2 text-sm border transition-colors',
                'border-green-400 text-green-400 hover:bg-green-400/10',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? 'PEEKING...' : `PEEK ${messageCount} MESSAGES`}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>

        {/* ASCII Art Footer */}
        <div className="border-t border-green-400/30 px-4 py-2 text-xs text-green-400/40">
          <div className="text-center">
            ┌─ PEEK OPERATION ─┐ Messages remain in queue
          </div>
        </div>
      </div>
    </div>
  );
};