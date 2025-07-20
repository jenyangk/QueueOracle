import React, { useState } from 'react';
import { TerminalWindow, ASCIITable, CommandButton } from '@/components/terminal';
import { GridContainer, GridPanel } from '@/components/layout';
import { useServiceBusClient } from '../hooks/useServiceBusClient';
import { useConnectionProfiles } from '../hooks/useConnectionProfiles';
import type { ServiceBusEntity } from '../services/ServiceBusClientService';

export const ServiceBusDemo: React.FC = () => {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  
  const {
    isConnected,
    isConnecting,
    currentProfile,
    entities,
    isLoadingEntities,
    messages,
    isLoadingMessages,
    connect,
    disconnect,
    discoverEntities,
    peekMessages,
    sendMessage
  } = useServiceBusClient();

  const { activeProfile } = useConnectionProfiles();

  const handleConnect = async () => {
    if (activeProfile) {
      try {
        await connect(activeProfile);
      } catch (error) {
        console.error('Connection failed:', error);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const handlePeekMessages = async () => {
    if (selectedEntity) {
      try {
        await peekMessages(selectedEntity, 10);
      } catch (error) {
        console.error('Peek failed:', error);
      }
    }
  };

  const handleSendTestMessage = async () => {
    if (selectedEntity) {
      try {
        await sendMessage(selectedEntity, {
          body: {
            message: 'Test message from Service Bus Explorer',
            timestamp: new Date().toISOString(),
            source: 'PWA'
          },
          properties: {
            messageType: 'test',
            version: '1.0'
          },
          subject: 'Test Message'
        });
      } catch (error) {
        console.error('Send failed:', error);
      }
    }
  };

  const entityColumns = [
    {
      key: 'name' as keyof ServiceBusEntity,
      header: 'Name',
      width: 30,
      render: (value: unknown) => (
        <span className="text-green-300 font-mono text-sm">
          {String(value)}
        </span>
      )
    },
    {
      key: 'type' as keyof ServiceBusEntity,
      header: 'Type',
      width: 15,
      render: (value: unknown) => (
        <span className="text-green-400 font-mono text-xs">
          {String(value).toUpperCase()}
        </span>
      )
    },
    {
      key: 'messageCount' as keyof ServiceBusEntity,
      header: 'Messages',
      width: 10,
      render: (value: unknown) => (
        <span className="text-green-600 font-mono text-xs">
          {String(value || '0')}
        </span>
      )
    },
    {
      key: 'activeMessageCount' as keyof ServiceBusEntity,
      header: 'Active',
      width: 10,
      render: (value: unknown) => (
        <span className="text-green-600 font-mono text-xs">
          {String(value || '0')}
        </span>
      )
    },
    {
      key: 'deadLetterMessageCount' as keyof ServiceBusEntity,
      header: 'Dead Letter',
      width: 10,
      render: (value: unknown) => (
        <span className="text-red-400 font-mono text-xs">
          {String(value || '0')}
        </span>
      )
    }
  ];

  const messageColumns = [
    {
      key: 'messageId' as string,
      header: 'Message ID',
      width: 25,
      render: (value: unknown) => (
        <span className="text-green-300 font-mono text-xs">
          {String(value).substring(0, 20)}...
        </span>
      )
    },
    {
      key: 'enqueuedTimeUtc' as string,
      header: 'Enqueued',
      width: 20,
      render: (value: unknown) => (
        <span className="text-green-600 font-mono text-xs">
          {value ? new Date(value as string).toLocaleString() : 'N/A'}
        </span>
      )
    },
    {
      key: 'deliveryCount' as string,
      header: 'Delivery Count',
      width: 15,
      render: (value: unknown) => (
        <span className="text-green-400 font-mono text-xs">
          {String(value || '0')}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <TerminalWindow
        title="Service Bus Connection"
        status={isConnected ? "connected" : "disconnected"}
        actions={[
          {
            label: isConnected ? 'Disconnect' : 'Connect',
            command: isConnected ? 'disconnect' : 'connect',
            onClick: isConnected ? handleDisconnect : handleConnect,
            disabled: isConnecting || !activeProfile
          },
          {
            label: 'Discover',
            command: 'discover',
            onClick: discoverEntities,
            disabled: !isConnected || isLoadingEntities
          }
        ]}
      >
        <div className="space-y-2 text-sm">
          <div className="text-green-600">
            Status: <span className={isConnected ? "text-green-400" : "text-red-400"}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="text-green-600">
            Profile: <span className="text-green-300">
              {currentProfile?.name || activeProfile?.name || 'None selected'}
            </span>
          </div>
          <div className="text-green-600">
            Entities: <span className="text-green-300">{entities.length}</span>
          </div>
        </div>
      </TerminalWindow>

      <GridContainer columns={2} gap="md">
        {/* Entities Panel */}
        <GridPanel title="Service Bus Entities" fullHeight>
          {entities.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-green-600 text-lg mb-2">📭</div>
              <div className="text-green-400 text-sm font-mono mb-1">
                No entities discovered
              </div>
              <div className="text-green-600 text-xs">
                {isConnected ? 'Click Discover to find entities' : 'Connect to Service Bus first'}
              </div>
            </div>
          ) : (
            <ASCIITable
              data={entities}
              columns={entityColumns}
              onRowSelect={(entity) => setSelectedEntity(entity.name)}
              virtualizedRows={10}
              sortable={true}
            />
          )}
        </GridPanel>

        {/* Messages Panel */}
        <GridPanel title="Messages" fullHeight>
          <div className="space-y-3">
            {selectedEntity && (
              <div className="flex gap-2 mb-3">
                <CommandButton
                  command="peek"
                  description="Peek Messages"
                  onClick={handlePeekMessages}
                  variant="primary"
                  disabled={!isConnected || isLoadingMessages}
                />
                <CommandButton
                  command="send"
                  description="Send Test Message"
                  onClick={handleSendTestMessage}
                  variant="secondary"
                  disabled={!isConnected}
                />
              </div>
            )}
            
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-green-600 text-lg mb-2">📨</div>
                <div className="text-green-400 text-sm font-mono mb-1">
                  No messages loaded
                </div>
                <div className="text-green-600 text-xs">
                  {selectedEntity ? 'Click Peek Messages to load' : 'Select an entity first'}
                </div>
              </div>
            ) : (
              <ASCIITable
                data={messages}
                columns={messageColumns}
                virtualizedRows={10}
                sortable={true}
              />
            )}
          </div>
        </GridPanel>
      </GridContainer>

      {/* Selected Entity Details */}
      {selectedEntity && (
        <TerminalWindow
          title={`Entity: ${selectedEntity}`}
          status="connected"
        >
          <div className="space-y-2 text-sm">
            <div className="text-green-600">
              Selected Entity: <span className="text-green-300">{selectedEntity}</span>
            </div>
            <div className="text-green-600">
              Type: <span className="text-green-300">
                {entities.find(e => e.name === selectedEntity)?.type || 'Unknown'}
              </span>
            </div>
            <div className="text-green-600">
              Total Messages: <span className="text-green-300">
                {entities.find(e => e.name === selectedEntity)?.messageCount || '0'}
              </span>
            </div>
            <div className="text-green-600">
              Active Messages: <span className="text-green-300">
                {entities.find(e => e.name === selectedEntity)?.activeMessageCount || '0'}
              </span>
            </div>
            <div className="text-green-600">
              Dead Letter Messages: <span className="text-red-400">
                {entities.find(e => e.name === selectedEntity)?.deadLetterMessageCount || '0'}
              </span>
            </div>
          </div>
        </TerminalWindow>
      )}
    </div>
  );
};