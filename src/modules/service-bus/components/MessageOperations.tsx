import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { TerminalWindow } from '@/components/terminal/TerminalWindow';
import { MessagePeekDialog } from './MessagePeekDialog';
import { MessageSendDialog } from './MessageSendDialog';
import { MessageDeleteDialog } from './MessageDeleteDialog';
import { MessageScheduleDialog } from './MessageScheduleDialog';
import { BatchOperationsDialog } from './BatchOperationsDialog';
import { DataExportDialog } from './DataExportDialog';
import { ExportScheduleDialog } from './ExportScheduleDialog';
import { useMessageStore } from '@/stores/messageStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { Eye, Send, Trash2, Clock, Package, RefreshCw, Download, Calendar } from 'lucide-react';

export interface MessageOperationsProps {
  className?: string;
  onPeekMessages?: (count: number) => Promise<void>;
  onSendMessage?: (message: any) => Promise<void>;
  onDeleteMessages?: (messageIds: string[]) => Promise<void>;
  onScheduleMessage?: (message: any, scheduledTime: Date) => Promise<void>;
  onRefreshMessages?: () => Promise<void>;
}

export const MessageOperations: React.FC<MessageOperationsProps> = ({
  className,
  onPeekMessages,
  onSendMessage,
  onDeleteMessages,
  onScheduleMessage,
  onRefreshMessages,
}) => {
  const { selectedMessageIds, isLoadingMessages, filteredMessages, analytics, fieldAnalytics } = useMessageStore();
  const activeConnection = useConnectionStore(state => state.getActiveProfile());
  
  const [showPeekDialog, setShowPeekDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showScheduleExportDialog, setShowScheduleExportDialog] = useState(false);

  const handlePeekMessages = useCallback(async (count: number) => {
    try {
      await onPeekMessages?.(count);
      setShowPeekDialog(false);
    } catch (error) {
      console.error('Failed to peek messages:', error);
    }
  }, [onPeekMessages]);

  const handleSendMessage = useCallback(async (message: any) => {
    try {
      await onSendMessage?.(message);
      setShowSendDialog(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [onSendMessage]);

  const handleDeleteMessages = useCallback(async (messageIds: string[]) => {
    try {
      await onDeleteMessages?.(messageIds);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete messages:', error);
    }
  }, [onDeleteMessages]);

  const handleScheduleMessage = useCallback(async (message: any, scheduledTime: Date) => {
    try {
      await onScheduleMessage?.(message, scheduledTime);
      setShowScheduleDialog(false);
    } catch (error) {
      console.error('Failed to schedule message:', error);
    }
  }, [onScheduleMessage]);

  const handleRefreshMessages = useCallback(async () => {
    try {
      await onRefreshMessages?.();
    } catch (error) {
      console.error('Failed to refresh messages:', error);
    }
  }, [onRefreshMessages]);

  const isConnected = activeConnection !== null;
  const hasSelectedMessages = selectedMessageIds.length > 0;

  const terminalActions = [
    {
      label: 'PEEK',
      command: 'peek-messages',
      onClick: () => setShowPeekDialog(true),
      disabled: !isConnected || isLoadingMessages,
    },
    {
      label: 'SEND',
      command: 'send-message',
      onClick: () => setShowSendDialog(true),
      disabled: !isConnected || isLoadingMessages,
    },
    {
      label: 'REFRESH',
      command: 'refresh-messages',
      onClick: handleRefreshMessages,
      disabled: !isConnected || isLoadingMessages,
    },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Message Operations Panel */}
      <TerminalWindow
        title="Message Operations"
        status={isConnected ? 'connected' : 'disconnected'}
        actions={terminalActions}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Peek Messages */}
          <button
            onClick={() => setShowPeekDialog(true)}
            disabled={!isConnected || isLoadingMessages}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border transition-colors',
              'hover:bg-green-400/10 active:bg-green-400/20',
              isConnected && !isLoadingMessages
                ? 'border-green-400 text-green-400'
                : 'border-gray-600 text-gray-600 cursor-not-allowed'
            )}
          >
            <Eye className="w-6 h-6" />
            <span className="text-xs font-mono">PEEK</span>
            <span className="text-xs text-green-400/60">View messages</span>
          </button>

          {/* Send Message */}
          <button
            onClick={() => setShowSendDialog(true)}
            disabled={!isConnected || isLoadingMessages}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border transition-colors',
              'hover:bg-green-400/10 active:bg-green-400/20',
              isConnected && !isLoadingMessages
                ? 'border-green-400 text-green-400'
                : 'border-gray-600 text-gray-600 cursor-not-allowed'
            )}
          >
            <Send className="w-6 h-6" />
            <span className="text-xs font-mono">SEND</span>
            <span className="text-xs text-green-400/60">New message</span>
          </button>

          {/* Schedule Message */}
          <button
            onClick={() => setShowScheduleDialog(true)}
            disabled={!isConnected || isLoadingMessages}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border transition-colors',
              'hover:bg-green-400/10 active:bg-green-400/20',
              isConnected && !isLoadingMessages
                ? 'border-green-400 text-green-400'
                : 'border-gray-600 text-gray-600 cursor-not-allowed'
            )}
          >
            <Clock className="w-6 h-6" />
            <span className="text-xs font-mono">SCHEDULE</span>
            <span className="text-xs text-green-400/60">Delayed send</span>
          </button>

          {/* Export Data */}
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={filteredMessages.length === 0 || isLoadingMessages}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border transition-colors',
              'hover:bg-green-400/10 active:bg-green-400/20',
              filteredMessages.length > 0 && !isLoadingMessages
                ? 'border-green-400 text-green-400'
                : 'border-gray-600 text-gray-600 cursor-not-allowed'
            )}
          >
            <Download className="w-6 h-6" />
            <span className="text-xs font-mono">EXPORT</span>
            <span className="text-xs text-green-400/60">
              {filteredMessages.length > 0 ? `${filteredMessages.length} messages` : 'No data'}
            </span>
          </button>

          {/* Schedule Export */}
          <button
            onClick={() => setShowScheduleExportDialog(true)}
            disabled={!isConnected || isLoadingMessages}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border transition-colors',
              'hover:bg-green-400/10 active:bg-green-400/20',
              isConnected && !isLoadingMessages
                ? 'border-green-400 text-green-400'
                : 'border-gray-600 text-gray-600 cursor-not-allowed'
            )}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-xs font-mono">AUTO-EXPORT</span>
            <span className="text-xs text-green-400/60">Schedule exports</span>
          </button>

          {/* Batch Operations */}
          <button
            onClick={() => setShowBatchDialog(true)}
            disabled={!hasSelectedMessages || isLoadingMessages}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border transition-colors',
              'hover:bg-green-400/10 active:bg-green-400/20',
              hasSelectedMessages && !isLoadingMessages
                ? 'border-green-400 text-green-400'
                : 'border-gray-600 text-gray-600 cursor-not-allowed'
            )}
          >
            <Package className="w-6 h-6" />
            <span className="text-xs font-mono">BATCH</span>
            <span className="text-xs text-green-400/60">
              {hasSelectedMessages ? `${selectedMessageIds.length} selected` : 'No selection'}
            </span>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t border-green-400/30">
          <div className="text-green-400 text-xs font-mono mb-2">QUICK ACTIONS</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowDeleteDialog(true)}
              disabled={!hasSelectedMessages || isLoadingMessages}
              className={cn(
                'px-3 py-1 text-xs border transition-colors',
                hasSelectedMessages && !isLoadingMessages
                  ? 'border-red-400 text-red-400 hover:bg-red-400/10'
                  : 'border-gray-600 text-gray-600 cursor-not-allowed'
              )}
            >
              <Trash2 className="w-3 h-3 inline mr-1" />
              DELETE SELECTED ({selectedMessageIds.length})
            </button>
            
            <button
              onClick={handleRefreshMessages}
              disabled={!isConnected || isLoadingMessages}
              className={cn(
                'px-3 py-1 text-xs border transition-colors',
                isConnected && !isLoadingMessages
                  ? 'border-green-400 text-green-400 hover:bg-green-400/10'
                  : 'border-gray-600 text-gray-600 cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('w-3 h-3 inline mr-1', isLoadingMessages && 'animate-spin')} />
              REFRESH
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mt-4 pt-4 border-t border-green-400/30">
          <div className="text-xs text-green-400/60 font-mono">
            Status: {isConnected ? (
              <span className="text-green-400">Connected</span>
            ) : (
              <span className="text-red-400">Disconnected</span>
            )}
            {isLoadingMessages && (
              <span className="ml-2 text-yellow-400">Loading...</span>
            )}
          </div>
        </div>
      </TerminalWindow>

      {/* Dialogs */}
      {showPeekDialog && (
        <MessagePeekDialog
          onPeek={handlePeekMessages}
          onClose={() => setShowPeekDialog(false)}
        />
      )}

      {showSendDialog && (
        <MessageSendDialog
          onSend={handleSendMessage}
          onClose={() => setShowSendDialog(false)}
        />
      )}

      {showDeleteDialog && (
        <MessageDeleteDialog
          messageIds={selectedMessageIds}
          onDelete={handleDeleteMessages}
          onClose={() => setShowDeleteDialog(false)}
        />
      )}

      {showScheduleDialog && (
        <MessageScheduleDialog
          onSchedule={handleScheduleMessage}
          onClose={() => setShowScheduleDialog(false)}
        />
      )}

      {showBatchDialog && (
        <BatchOperationsDialog
          selectedMessageIds={selectedMessageIds}
          onClose={() => setShowBatchDialog(false)}
          onDelete={handleDeleteMessages}
        />
      )}

      {showExportDialog && (
        <DataExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          messages={filteredMessages}
          analytics={analytics}
          fieldAnalytics={fieldAnalytics}
        />
      )}

      {showScheduleExportDialog && activeConnection && (
        <ExportScheduleDialog
          isOpen={showScheduleExportDialog}
          onClose={() => setShowScheduleExportDialog(false)}
          connectionId={activeConnection.id}
        />
      )}
    </div>
  );
};