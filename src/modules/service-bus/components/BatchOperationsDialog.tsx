import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Package, Trash2, Download, Copy, AlertTriangle } from 'lucide-react';

export interface BatchOperationsDialogProps {
  selectedMessageIds: string[];
  onClose: () => void;
  onDelete: (messageIds: string[]) => Promise<void>;
}

export const BatchOperationsDialog: React.FC<BatchOperationsDialogProps> = ({
  selectedMessageIds,
  onClose,
  onDelete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [operation, setOperation] = useState<'delete' | 'export' | 'copy' | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const messageCount = selectedMessageIds.length;

  const handleDelete = async () => {
    if (confirmText.toUpperCase() !== 'DELETE ALL') return;
    
    setIsLoading(true);
    try {
      await onDelete(selectedMessageIds);
      onClose();
    } catch (error) {
      console.error('Failed to delete messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      // This would typically call a service to export the messages
      // For now, we'll just simulate the operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create a simple export format
      const exportData = {
        exportedAt: new Date().toISOString(),
        messageCount: selectedMessageIds.length,
        messageIds: selectedMessageIds,
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-bus-messages-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      onClose();
    } catch (error) {
      console.error('Failed to export messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyIds = async () => {
    try {
      await navigator.clipboard.writeText(selectedMessageIds.join('\n'));
      onClose();
    } catch (error) {
      console.error('Failed to copy message IDs:', error);
    }
  };

  const renderOperationContent = () => {
    switch (operation) {
      case 'delete':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 border border-red-400/30 bg-red-400/10">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold mb-1 text-red-400">DESTRUCTIVE OPERATION</div>
                <div className="text-red-400/80">
                  This will permanently delete {messageCount} selected messages. This cannot be undone.
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-red-400 mb-2">
                Type "DELETE ALL" to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-red-400/30 text-red-400 font-mono text-sm focus:outline-none focus:border-red-400"
                placeholder="DELETE ALL"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isLoading || confirmText.toUpperCase() !== 'DELETE ALL'}
                className={cn(
                  'flex-1 px-4 py-2 text-sm border transition-colors',
                  'border-red-400 text-red-400 hover:bg-red-400/10',
                  (isLoading || confirmText.toUpperCase() !== 'DELETE ALL') && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isLoading ? 'DELETING...' : `DELETE ${messageCount} MESSAGES`}
              </button>
              <button
                onClick={() => setOperation(null)}
                disabled={isLoading}
                className="px-4 py-2 text-sm border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              >
                BACK
              </button>
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="space-y-4">
            <div className="text-sm text-green-400/80">
              Export {messageCount} selected messages to a JSON file. This will include message IDs and metadata.
            </div>

            <div className="bg-black border border-green-400/30 p-3 text-xs font-mono">
              <div className="text-green-400/60">Export will include:</div>
              <ul className="mt-2 space-y-1 text-green-400/80">
                <li>• Message IDs ({messageCount} messages)</li>
                <li>• Export timestamp</li>
                <li>• Message count summary</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={isLoading}
                className={cn(
                  'flex-1 px-4 py-2 text-sm border transition-colors',
                  'border-green-400 text-green-400 hover:bg-green-400/10',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isLoading ? 'EXPORTING...' : 'EXPORT TO JSON'}
              </button>
              <button
                onClick={() => setOperation(null)}
                disabled={isLoading}
                className="px-4 py-2 text-sm border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              >
                BACK
              </button>
            </div>
          </div>
        );

      case 'copy':
        return (
          <div className="space-y-4">
            <div className="text-sm text-green-400/80">
              Copy all {messageCount} selected message IDs to clipboard (one per line).
            </div>

            <div className="bg-black border border-green-400/30 p-3 max-h-32 overflow-y-auto">
              <div className="text-xs font-mono text-green-400/80">
                {selectedMessageIds.slice(0, 10).map((id, _index) => (
                  <div key={id}>{id}</div>
                ))}
                {selectedMessageIds.length > 10 && (
                  <div className="text-green-400/60 mt-1">
                    ... and {selectedMessageIds.length - 10} more
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyIds}
                className="flex-1 px-4 py-2 text-sm border border-green-400 text-green-400 hover:bg-green-400/10 transition-colors"
              >
                COPY TO CLIPBOARD
              </button>
              <button
                onClick={() => setOperation(null)}
                className="px-4 py-2 text-sm border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              >
                BACK
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="text-sm text-green-400/80">
              Select a batch operation to perform on {messageCount} selected messages:
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setOperation('delete')}
                className="flex items-center gap-3 p-4 border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-bold">Delete Messages</div>
                  <div className="text-xs text-red-400/60">Permanently remove selected messages</div>
                </div>
              </button>

              <button
                onClick={() => setOperation('export')}
                className="flex items-center gap-3 p-4 border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors"
              >
                <Download className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-bold">Export Messages</div>
                  <div className="text-xs text-green-400/60">Download message data as JSON</div>
                </div>
              </button>

              <button
                onClick={() => setOperation('copy')}
                className="flex items-center gap-3 p-4 border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors"
              >
                <Copy className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-bold">Copy Message IDs</div>
                  <div className="text-xs text-green-400/60">Copy all message IDs to clipboard</div>
                </div>
              </button>
            </div>

            <div className="flex gap-2 pt-4 border-t border-green-400/30">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-black border border-green-400 font-mono text-green-400 w-full max-w-md mx-4">
        {/* Dialog Header */}
        <div className="border-b border-green-400 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span className="font-bold">BATCH OPERATIONS</span>
          </div>
          <button
            onClick={onClose}
            className="text-green-400 hover:text-green-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="p-4">
          {renderOperationContent()}
        </div>

        {/* ASCII Art Footer */}
        <div className="border-t border-green-400/30 px-4 py-2 text-xs text-green-400/40">
          <div className="text-center">
            ┌─ BATCH OPERATIONS ─┐ {messageCount} messages selected
          </div>
        </div>
      </div>
    </div>
  );
};