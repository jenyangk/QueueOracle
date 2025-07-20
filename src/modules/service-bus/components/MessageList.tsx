import React, { useMemo, useState, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { cn } from '@/lib/utils';
import type { ServiceBusMessage } from '@/services/storage/types';
import { MessageRow } from './MessageRow';
import { MessageFilter } from './MessageFilter';
import { MessageSearch } from './MessageSearch';
import { TerminalWindow } from '@/components/terminal/TerminalWindow';
import { useMessageStore } from '@/stores/messageStore';

export interface MessageListProps {
  className?: string;
  height?: number;
  onMessageSelect?: (message: ServiceBusMessage) => void;
  onMessageDelete?: (messageId: string) => void;
  onBatchDelete?: (messageIds: string[]) => void;
}

const ROW_HEIGHT = 60;

export const MessageList: React.FC<MessageListProps> = ({
  className,
  height = 600,
  onMessageSelect,
  onMessageDelete,
  onBatchDelete,
}) => {
  const {
    filteredMessages,
    selectedMessageIds,
    isLoadingMessages,
    filter,
    sortBy,
    sortOrder,
    selectMessage,
    deselectMessage,
    toggleMessageSelection,
    deselectAllMessages,
    setFilter,
    setSortBy,
    setSortOrder,
  } = useMessageStore();

  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  // Handle message selection
  const handleMessageClick = useCallback((message: ServiceBusMessage, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select with Ctrl/Cmd
      toggleMessageSelection(message.messageId);
    } else if (event.shiftKey && selectedMessageIds.length > 0) {
      // Range select with Shift
      const lastSelectedIndex = filteredMessages.findIndex(m => 
        m.messageId === selectedMessageIds[selectedMessageIds.length - 1]
      );
      const currentIndex = filteredMessages.findIndex(m => m.messageId === message.messageId);
      
      if (lastSelectedIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex);
        const end = Math.max(lastSelectedIndex, currentIndex);
        const rangeIds = filteredMessages.slice(start, end + 1).map(m => m.messageId);
        
        rangeIds.forEach(id => {
          if (!selectedMessageIds.includes(id)) {
            selectMessage(id);
          }
        });
      }
    } else {
      // Single select
      if (selectedMessageIds.includes(message.messageId)) {
        deselectMessage(message.messageId);
      } else {
        deselectAllMessages();
        selectMessage(message.messageId);
      }
    }
    
    onMessageSelect?.(message);
  }, [
    selectedMessageIds,
    filteredMessages,
    toggleMessageSelection,
    selectMessage,
    deselectMessage,
    deselectAllMessages,
    onMessageSelect,
  ]);

  // Handle message expansion
  const handleMessageExpand = useCallback((messageId: string) => {
    setExpandedMessageId(prev => prev === messageId ? null : messageId);
  }, []);

  // Handle batch operations
  const handleBatchDelete = useCallback(() => {
    if (selectedMessageIds.length > 0) {
      onBatchDelete?.(selectedMessageIds);
    }
  }, [selectedMessageIds, onBatchDelete]);

  const handleSelectAll = useCallback(() => {
    const allIds = filteredMessages.map(m => m.messageId);
    allIds.forEach(id => {
      if (!selectedMessageIds.includes(id)) {
        selectMessage(id);
      }
    });
  }, [filteredMessages, selectedMessageIds, selectMessage]);

  // Terminal actions
  const terminalActions = useMemo(() => [
    {
      label: 'SELECT ALL',
      command: 'select-all',
      onClick: handleSelectAll,
      disabled: filteredMessages.length === 0,
    },
    {
      label: 'CLEAR SELECTION',
      command: 'clear-selection',
      onClick: deselectAllMessages,
      disabled: selectedMessageIds.length === 0,
    },
    {
      label: `DELETE (${selectedMessageIds.length})`,
      command: 'delete-selected',
      onClick: handleBatchDelete,
      disabled: selectedMessageIds.length === 0,
    },
  ], [
    filteredMessages.length,
    selectedMessageIds.length,
    handleSelectAll,
    deselectAllMessages,
    handleBatchDelete,
  ]);

  // Row renderer for react-window
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const message = filteredMessages[index];
    if (!message) return null;

    const isSelected = selectedMessageIds.includes(message.messageId);
    const isExpanded = expandedMessageId === message.messageId;

    return (
      <div style={style}>
        <MessageRow
          message={message}
          isSelected={isSelected}
          isExpanded={isExpanded}
          onClick={(event) => handleMessageClick(message, event)}
          onExpand={() => handleMessageExpand(message.messageId)}
          onDelete={() => onMessageDelete?.(message.messageId)}
        />
      </div>
    );
  }, [
    filteredMessages,
    selectedMessageIds,
    expandedMessageId,
    handleMessageClick,
    handleMessageExpand,
    onMessageDelete,
  ]);

  // Calculate status
  const status = isLoadingMessages ? 'disconnected' : 'connected';

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Search and Filter Controls */}
      <div className="mb-4 space-y-2">
        <MessageSearch
          value={filter.textSearch}
          onChange={(value) => setFilter({ textSearch: value })}
          placeholder="Search messages..."
        />
        <MessageFilter
          filter={filter}
          onFilterChange={setFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(sortBy: 'enqueuedTimeUtc' | 'messageId' | 'sequenceNumber', sortOrder: 'asc' | 'desc') => {
            setSortBy(sortBy);
            setSortOrder(sortOrder);
          }}
        />
      </div>

      {/* Message List */}
      <TerminalWindow
        title={`Messages (${filteredMessages.length})`}
        status={status}
        actions={terminalActions}
        className="flex-1"
      >
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-green-400/60">
              <div className="text-lg animate-pulse">Loading messages...</div>
              <div className="text-sm mt-2">┌─────────────────┐</div>
              <div className="text-sm">│ ████████████████ │</div>
              <div className="text-sm">└─────────────────┘</div>
            </div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-green-400/60 text-center">
              <div className="text-lg">┌─────────────────┐</div>
              <div className="text-lg">│   NO MESSAGES   │</div>
              <div className="text-lg">└─────────────────┘</div>
              <div className="text-sm mt-2">No messages match the current filter</div>
            </div>
          </div>
        ) : (
          <div className="border border-green-400/30">
            <List
              height={height}
              itemCount={filteredMessages.length}
              itemSize={ROW_HEIGHT}
              width="100%"
            >
              {Row}
            </List>
          </div>
        )}

        {/* Status Bar */}
        {filteredMessages.length > 0 && (
          <div className="mt-2 text-xs text-green-400/60 flex justify-between">
            <span>
              {filteredMessages.length} messages
              {selectedMessageIds.length > 0 && ` (${selectedMessageIds.length} selected)`}
            </span>
            <span>
              Sorted by {sortBy} ({sortOrder})
            </span>
          </div>
        )}
      </TerminalWindow>
    </div>
  );
};