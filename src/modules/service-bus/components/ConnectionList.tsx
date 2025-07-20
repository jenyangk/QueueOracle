import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { TerminalWindow, ASCIITable, CommandButton } from '@/components/terminal';
import type { ConnectionProfile } from '../types/connection';

interface ConnectionListProps {
  connections: ConnectionProfile[];
  activeConnectionId?: string;
  onConnect: (profile: ConnectionProfile) => void;
  onDisconnect: () => void;
  onEdit: (profile: ConnectionProfile) => void;
  onDelete: (profileId: string) => void;
  onAdd: () => void;
  isConnecting?: boolean;
}

export const ConnectionList: React.FC<ConnectionListProps> = ({
  connections,
  activeConnectionId,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onAdd,
  isConnecting = false
}) => {
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getConnectionStatus = (profile: ConnectionProfile) => {
    if (profile.id === activeConnectionId) {
      return { text: 'Connected', color: 'text-green-400' };
    }
    return { text: 'Disconnected', color: 'text-green-600' };
  };

  const columns = [
    {
      key: 'status' as keyof ConnectionProfile,
      header: 'Status',
      width: 12,
      render: (_: unknown, profile: ConnectionProfile) => {
        const status = getConnectionStatus(profile);
        return (
          <span className={cn("font-mono text-xs", status.color)}>
            {profile.id === activeConnectionId ? '●' : '○'} {status.text}
          </span>
        );
      }
    },
    {
      key: 'name' as keyof ConnectionProfile,
      header: 'Name',
      width: 20,
      render: (value: unknown) => (
        <span className="text-green-300 font-mono text-sm">
          {String(value)}
        </span>
      )
    },
    {
      key: 'type' as keyof ConnectionProfile,
      header: 'Type',
      width: 15,
      render: (value: unknown) => (
        <span className="text-green-400 font-mono text-xs">
          {value === 'connectionString' ? 'Conn String' : 'Azure AD'}
        </span>
      )
    },
    {
      key: 'lastUsed' as keyof ConnectionProfile,
      header: 'Last Used',
      width: 15,
      render: (value: unknown) => (
        <span className="text-green-600 font-mono text-xs">
          {formatDate(value as Date)}
        </span>
      )
    },
    {
      key: 'actions' as keyof ConnectionProfile,
      header: 'Actions',
      width: 20,
      render: (_: unknown, profile: ConnectionProfile) => (
        <div className="flex gap-1">
          {profile.id === activeConnectionId ? (
            <CommandButton
              command="disconnect"
              description="Disconnect"
              onClick={() => onDisconnect()}
              variant="secondary"
              disabled={isConnecting}
            />
          ) : (
            <CommandButton
              command="connect"
              description="Connect"
              onClick={() => onConnect(profile)}
              variant="primary"
              disabled={isConnecting}
            />
          )}
          <CommandButton
            command="edit"
            description="Edit"
            onClick={() => onEdit(profile)}
            variant="secondary"
            disabled={isConnecting}
          />
          <CommandButton
            command="delete"
            description="Delete"
            onClick={() => onDelete(profile.id)}
            variant="danger"
            disabled={isConnecting || profile.id === activeConnectionId}
          />
        </div>
      )
    }
  ];

  const handleRowSelect = (profile: ConnectionProfile) => {
    setSelectedConnection(profile.id === selectedConnection ? null : profile.id);
  };

  return (
    <TerminalWindow
      title="Service Bus Connections"
      status={activeConnectionId ? "connected" : "disconnected"}
      actions={[
        {
          label: 'Add Connection',
          command: 'add',
          onClick: onAdd,
          disabled: isConnecting
        }
      ]}
    >
      <div className="space-y-4">
        {connections.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-green-600 text-lg mb-2">📭</div>
            <div className="text-green-400 text-sm font-mono mb-1">
              No connections configured
            </div>
            <div className="text-green-600 text-xs">
              Add a connection to get started
            </div>
          </div>
        ) : (
          <>
            <ASCIITable
              data={connections}
              columns={columns}
              onRowSelect={handleRowSelect}
              virtualizedRows={10}
              sortable={true}
            />
            
            {/* Connection Details */}
            {selectedConnection && (
              <div className="border border-green-400/30 p-3">
                <div className="text-green-300 text-sm font-mono mb-2">
                  Connection Details
                </div>
                {(() => {
                  const profile = connections.find(c => c.id === selectedConnection);
                  if (!profile) return null;
                  
                  return (
                    <div className="space-y-1 text-xs font-mono">
                      <div className="text-green-600">
                        <span className="text-green-400">ID:</span> {profile.id}
                      </div>
                      <div className="text-green-600">
                        <span className="text-green-400">Created:</span> {formatDate(profile.createdAt)}
                      </div>
                      <div className="text-green-600">
                        <span className="text-green-400">Type:</span> {profile.type}
                      </div>
                      {profile.type === 'connectionString' && (
                        <div className="text-green-600">
                          <span className="text-green-400">Endpoint:</span> {
                            profile.connectionString.match(/Endpoint=([^;]+)/)?.[1] || 'Unknown'
                          }
                        </div>
                      )}
                      {profile.type === 'azureAD' && profile.azureConfig && (
                        <>
                          <div className="text-green-600">
                            <span className="text-green-400">Tenant:</span> {profile.azureConfig.tenantId}
                          </div>
                          <div className="text-green-600">
                            <span className="text-green-400">Client:</span> {profile.azureConfig.clientId}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </TerminalWindow>
  );
};