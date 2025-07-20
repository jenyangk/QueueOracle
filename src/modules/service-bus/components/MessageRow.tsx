import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ServiceBusMessage } from '@/services/storage/types';
import { ChevronDown, ChevronRight, Trash2, Copy, Eye } from 'lucide-react';

export interface MessageRowProps {
  message: ServiceBusMessage;
  isSelected: boolean;
  isExpanded: boolean;
  onClick: (event: React.MouseEvent) => void;
  onExpand: () => void;
  onDelete: () => void;
}

export const MessageRow: React.FC<MessageRowProps> = ({
  message,
  isSelected,
  isExpanded,
  onClick,
  onExpand,
  onDelete,
}) => {
  const [showRawBody, setShowRawBody] = useState(false);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatJsonBody = (body: unknown) => {
    try {
      if (typeof body === 'string') {
        // Try to parse if it's a JSON string
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
      }
      return JSON.stringify(body, null, 2);
    } catch {
      return String(body);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleCopyMessage = (event: React.MouseEvent) => {
    event.stopPropagation();
    const messageData = {
      messageId: message.messageId,
      sequenceNumber: message.sequenceNumber,
      enqueuedTimeUtc: message.enqueuedTimeUtc,
      body: message.body,
      properties: message.properties,
      sessionId: message.sessionId,
      partitionKey: message.partitionKey,
      deliveryCount: message.deliveryCount,
    };
    copyToClipboard(JSON.stringify(messageData, null, 2));
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete();
  };

  const handleExpand = (event: React.MouseEvent) => {
    event.stopPropagation();
    onExpand();
  };

  return (
    <div
      className={cn(
        'border-b border-green-400/20 transition-colors cursor-pointer',
        'hover:bg-green-400/5',
        isSelected && 'bg-green-400/10 border-green-400/40'
      )}
      onClick={onClick}
    >
      {/* Main Row */}
      <div className="flex items-center p-2 gap-2">
        {/* Expand/Collapse Button */}
        <button
          onClick={handleExpand}
          className="text-green-400 hover:text-green-300 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Selection Indicator */}
        <div className={cn(
          'w-2 h-2 border border-green-400',
          isSelected ? 'bg-green-400' : 'bg-transparent'
        )} />

        {/* Message Info */}
        <div className="flex-1 grid grid-cols-12 gap-2 text-sm font-mono">
          {/* Message ID */}
          <div className="col-span-3 truncate">
            <span className="text-green-400/60">ID:</span>
            <span className="text-green-400 ml-1">{message.messageId}</span>
          </div>

          {/* Sequence Number */}
          <div className="col-span-2 truncate">
            <span className="text-green-400/60">SEQ:</span>
            <span className="text-green-400 ml-1">{message.sequenceNumber}</span>
          </div>

          {/* Enqueued Time */}
          <div className="col-span-3 truncate">
            <span className="text-green-400/60">TIME:</span>
            <span className="text-green-400 ml-1">{formatDate(message.enqueuedTimeUtc)}</span>
          </div>

          {/* Delivery Count */}
          <div className="col-span-1 truncate">
            <span className="text-green-400/60">DC:</span>
            <span className="text-green-400 ml-1">{message.deliveryCount}</span>
          </div>

          {/* Body Preview */}
          <div className="col-span-3 truncate">
            <span className="text-green-400/60">BODY:</span>
            <span className="text-green-400 ml-1">
              {typeof message.body === 'string' 
                ? message.body.substring(0, 30) + (message.body.length > 30 ? '...' : '')
                : JSON.stringify(message.body).substring(0, 30) + '...'
              }
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyMessage}
            className="p-1 text-green-400/60 hover:text-green-400 transition-colors"
            title="Copy message"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-red-400/60 hover:text-red-400 transition-colors"
            title="Delete message"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-green-400/20 bg-black/50">
          <div className="p-4 space-y-4">
            {/* Message Properties */}
            <div>
              <div className="text-green-400 font-bold mb-2 flex items-center gap-2">
                <span>MESSAGE PROPERTIES</span>
                <div className="flex-1 border-b border-green-400/30" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div>
                  <span className="text-green-400/60">Message ID:</span>
                  <span className="text-green-400 ml-2">{message.messageId}</span>
                </div>
                <div>
                  <span className="text-green-400/60">Sequence Number:</span>
                  <span className="text-green-400 ml-2">{message.sequenceNumber}</span>
                </div>
                <div>
                  <span className="text-green-400/60">Enqueued Time:</span>
                  <span className="text-green-400 ml-2">{formatDate(message.enqueuedTimeUtc)}</span>
                </div>
                <div>
                  <span className="text-green-400/60">Delivery Count:</span>
                  <span className="text-green-400 ml-2">{message.deliveryCount}</span>
                </div>
                {message.sessionId && (
                  <div>
                    <span className="text-green-400/60">Session ID:</span>
                    <span className="text-green-400 ml-2">{message.sessionId}</span>
                  </div>
                )}
                {message.partitionKey && (
                  <div>
                    <span className="text-green-400/60">Partition Key:</span>
                    <span className="text-green-400 ml-2">{message.partitionKey}</span>
                  </div>
                )}
                {message.timeToLive && (
                  <div>
                    <span className="text-green-400/60">TTL:</span>
                    <span className="text-green-400 ml-2">{message.timeToLive}ms</span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Properties */}
            {Object.keys(message.properties).length > 0 && (
              <div>
                <div className="text-green-400 font-bold mb-2 flex items-center gap-2">
                  <span>CUSTOM PROPERTIES</span>
                  <div className="flex-1 border-b border-green-400/30" />
                </div>
                <div className="bg-black border border-green-400/30 p-2 rounded">
                  <pre className="text-xs text-green-400 whitespace-pre-wrap">
                    {JSON.stringify(message.properties, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Message Body */}
            <div>
              <div className="text-green-400 font-bold mb-2 flex items-center gap-2">
                <span>MESSAGE BODY</span>
                <div className="flex-1 border-b border-green-400/30" />
                <button
                  onClick={() => setShowRawBody(!showRawBody)}
                  className="text-xs px-2 py-1 border border-green-400/30 hover:bg-green-400/10 transition-colors"
                >
                  <Eye className="w-3 h-3 inline mr-1" />
                  {showRawBody ? 'FORMATTED' : 'RAW'}
                </button>
                <button
                  onClick={() => copyToClipboard(formatJsonBody(message.body))}
                  className="text-xs px-2 py-1 border border-green-400/30 hover:bg-green-400/10 transition-colors"
                >
                  <Copy className="w-3 h-3 inline mr-1" />
                  COPY
                </button>
              </div>
              <div className="bg-black border border-green-400/30 p-2 rounded max-h-96 overflow-auto">
                <pre className="text-xs text-green-400 whitespace-pre-wrap">
                  {showRawBody 
                    ? String(message.body)
                    : formatJsonBody(message.body)
                  }
                </pre>
              </div>
            </div>

            {/* JSON Fields Analysis */}
            {Object.keys(message.jsonFields).length > 0 && (
              <div>
                <div className="text-green-400 font-bold mb-2 flex items-center gap-2">
                  <span>ANALYZED JSON FIELDS</span>
                  <div className="flex-1 border-b border-green-400/30" />
                </div>
                <div className="bg-black border border-green-400/30 p-2 rounded">
                  <pre className="text-xs text-green-400 whitespace-pre-wrap">
                    {JSON.stringify(message.jsonFields, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};