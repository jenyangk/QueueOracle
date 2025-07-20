import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Trash2, AlertTriangle } from 'lucide-react';

export interface MessageDeleteDialogProps {
  messageIds: string[];
  onDelete: (messageIds: string[]) => Promise<void>;
  onClose: () => void;
}

export const MessageDeleteDialog: React.FC<MessageDeleteDialogProps> = ({
  messageIds,
  onDelete,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const messageCount = messageIds.length;
  const requiredConfirmText = messageCount > 1 ? 'DELETE ALL' : 'DELETE';
  const isConfirmed = confirmText.toUpperCase() === requiredConfirmText;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    
    setIsLoading(true);
    try {
      await onDelete(messageIds);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-black border border-red-400 font-mono text-red-400 w-full max-w-md mx-4">
        {/* Dialog Header */}
        <div className="border-b border-red-400 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            <span className="font-bold">DELETE MESSAGES</span>
          </div>
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="p-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 border border-red-400/30 bg-red-400/10">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-bold mb-1">DESTRUCTIVE OPERATION</div>
              <div className="text-red-400/80">
                This action will permanently delete {messageCount} message{messageCount !== 1 ? 's' : ''} 
                from the Service Bus queue. This operation cannot be undone.
              </div>
            </div>
          </div>

          {/* Message Details */}
          <div>
            <div className="text-xs text-red-400/60 mb-2">Messages to be deleted:</div>
            <div className="bg-black border border-red-400/30 p-2 max-h-32 overflow-y-auto">
              {messageIds.slice(0, 10).map((id, index) => (
                <div key={id} className="text-xs font-mono text-red-400/80">
                  {index + 1}. {id}
                </div>
              ))}
              {messageIds.length > 10 && (
                <div className="text-xs font-mono text-red-400/60 mt-1">
                  ... and {messageIds.length - 10} more messages
                </div>
              )}
            </div>
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-xs text-red-400 mb-2">
              Type "{requiredConfirmText}" to confirm deletion:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-red-400/30 text-red-400 font-mono text-sm focus:outline-none focus:border-red-400"
              placeholder={requiredConfirmText}
              autoComplete="off"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-red-400/30">
            <button
              onClick={handleDelete}
              disabled={isLoading || !isConfirmed}
              className={cn(
                'flex-1 px-4 py-2 text-sm border transition-colors',
                'border-red-400 text-red-400 hover:bg-red-400/10',
                (isLoading || !isConfirmed) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? 'DELETING...' : `DELETE ${messageCount} MESSAGE${messageCount !== 1 ? 'S' : ''}`}
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
        <div className="border-t border-red-400/30 px-4 py-2 text-xs text-red-400/40">
          <div className="text-center">
            ┌─ DESTRUCTIVE OPERATION ─┐ Messages will be permanently removed
          </div>
        </div>
      </div>
    </div>
  );
};