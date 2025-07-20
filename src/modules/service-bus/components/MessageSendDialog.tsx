import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Send, Plus, Trash2 } from 'lucide-react';

export interface MessageSendDialogProps {
  onSend: (message: {
    body: any;
    properties?: Record<string, any>;
    sessionId?: string;
    partitionKey?: string;
    timeToLive?: number;
  }) => Promise<void>;
  onClose: () => void;
}

export const MessageSendDialog: React.FC<MessageSendDialogProps> = ({
  onSend,
  onClose,
}) => {
  const [messageBody, setMessageBody] = useState('{\n  "message": "Hello World",\n  "timestamp": "' + new Date().toISOString() + '"\n}');
  const [sessionId, setSessionId] = useState('');
  const [partitionKey, setPartitionKey] = useState('');
  const [timeToLive, setTimeToLive] = useState('');
  const [customProperties, setCustomProperties] = useState<Array<{ key: string; value: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bodyFormat, setBodyFormat] = useState<'json' | 'text'>('json');

  const handleAddProperty = () => {
    setCustomProperties([...customProperties, { key: '', value: '' }]);
  };

  const handleRemoveProperty = (index: number) => {
    setCustomProperties(customProperties.filter((_, i) => i !== index));
  };

  const handlePropertyChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customProperties];
    updated[index][field] = value;
    setCustomProperties(updated);
  };

  const handleSend = async () => {
    setIsLoading(true);
    try {
      let parsedBody: any;
      
      if (bodyFormat === 'json') {
        try {
          parsedBody = JSON.parse(messageBody);
        } catch {
          throw new Error('Invalid JSON format in message body');
        }
      } else {
        parsedBody = messageBody;
      }

      const properties: Record<string, any> = {};
      customProperties.forEach(prop => {
        if (prop.key.trim()) {
          properties[prop.key] = prop.value;
        }
      });

      const message = {
        body: parsedBody,
        properties: Object.keys(properties).length > 0 ? properties : undefined,
        sessionId: sessionId.trim() || undefined,
        partitionKey: partitionKey.trim() || undefined,
        timeToLive: timeToLive ? parseInt(timeToLive) * 1000 : undefined, // Convert to milliseconds
      };

      await onSend(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isValidJson = () => {
    if (bodyFormat !== 'json') return true;
    try {
      JSON.parse(messageBody);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-black border border-green-400 font-mono text-green-400 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Dialog Header */}
        <div className="border-b border-green-400 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            <span className="font-bold">SEND MESSAGE</span>
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
          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-green-400">Message Body:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setBodyFormat('json')}
                  className={cn(
                    'px-2 py-1 text-xs border transition-colors',
                    bodyFormat === 'json'
                      ? 'border-green-400 text-green-400 bg-green-400/10'
                      : 'border-green-400/30 text-green-400/60 hover:text-green-400'
                  )}
                >
                  JSON
                </button>
                <button
                  onClick={() => setBodyFormat('text')}
                  className={cn(
                    'px-2 py-1 text-xs border transition-colors',
                    bodyFormat === 'text'
                      ? 'border-green-400 text-green-400 bg-green-400/10'
                      : 'border-green-400/30 text-green-400/60 hover:text-green-400'
                  )}
                >
                  TEXT
                </button>
              </div>
            </div>
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={8}
              className={cn(
                'w-full px-3 py-2 bg-black border text-green-400 font-mono text-sm resize-none focus:outline-none',
                isValidJson() ? 'border-green-400/30 focus:border-green-400' : 'border-red-400 focus:border-red-400'
              )}
              placeholder={bodyFormat === 'json' ? '{\n  "key": "value"\n}' : 'Your message text here...'}
            />
            {!isValidJson() && (
              <div className="text-xs text-red-400 mt-1">Invalid JSON format</div>
            )}
          </div>

          {/* Message Properties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Session ID */}
            <div>
              <label className="block text-xs text-green-400 mb-1">Session ID (optional):</label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-green-400/30 text-green-400 font-mono text-sm focus:outline-none focus:border-green-400"
                placeholder="session-123"
              />
            </div>

            {/* Partition Key */}
            <div>
              <label className="block text-xs text-green-400 mb-1">Partition Key (optional):</label>
              <input
                type="text"
                value={partitionKey}
                onChange={(e) => setPartitionKey(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-green-400/30 text-green-400 font-mono text-sm focus:outline-none focus:border-green-400"
                placeholder="partition-key"
              />
            </div>

            {/* Time to Live */}
            <div>
              <label className="block text-xs text-green-400 mb-1">Time to Live (seconds, optional):</label>
              <input
                type="number"
                min="1"
                value={timeToLive}
                onChange={(e) => setTimeToLive(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-green-400/30 text-green-400 font-mono text-sm focus:outline-none focus:border-green-400"
                placeholder="3600"
              />
            </div>
          </div>

          {/* Custom Properties */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-green-400">Custom Properties:</label>
              <button
                onClick={handleAddProperty}
                className="px-2 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              >
                <Plus className="w-3 h-3 inline mr-1" />
                ADD
              </button>
            </div>
            
            {customProperties.length === 0 ? (
              <div className="text-xs text-green-400/40 italic">No custom properties</div>
            ) : (
              <div className="space-y-2">
                {customProperties.map((prop, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={prop.key}
                      onChange={(e) => handlePropertyChange(index, 'key', e.target.value)}
                      placeholder="Property key"
                      className="flex-1 px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
                    />
                    <input
                      type="text"
                      value={prop.value}
                      onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
                      placeholder="Property value"
                      className="flex-1 px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
                    />
                    <button
                      onClick={() => handleRemoveProperty(index)}
                      className="px-2 py-1 text-xs border border-red-400/30 text-red-400/60 hover:text-red-400 hover:border-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-green-400/30">
            <button
              onClick={handleSend}
              disabled={isLoading || !isValidJson() || !messageBody.trim()}
              className={cn(
                'flex-1 px-4 py-2 text-sm border transition-colors',
                'border-green-400 text-green-400 hover:bg-green-400/10',
                (isLoading || !isValidJson() || !messageBody.trim()) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? 'SENDING...' : 'SEND MESSAGE'}
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
            ┌─ SEND OPERATION ─┐ Message will be added to queue
          </div>
        </div>
      </div>
    </div>
  );
};