import { useState, useCallback, useRef, useEffect } from 'react';
import type { ServiceBusReceivedMessage } from '@azure/service-bus';
import { ServiceBusClientService, type ServiceBusEntity, type SendMessageOptions } from '../services/ServiceBusClientService';
import type { ConnectionProfile } from '../types/connection';
import { useNotifications } from '@/components/layout';

export interface UseServiceBusClientReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  currentProfile: ConnectionProfile | null;
  
  // Entity discovery
  entities: ServiceBusEntity[];
  isLoadingEntities: boolean;
  
  // Message operations
  messages: ServiceBusReceivedMessage[];
  isLoadingMessages: boolean;
  
  // Error state
  error: string | null;
  
  // Connection methods
  connect: (profile: ConnectionProfile) => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Entity methods
  discoverEntities: () => Promise<void>;
  refreshEntity: (entityName: string) => Promise<void>;
  
  // Message methods
  peekMessages: (entityName: string, maxMessages?: number) => Promise<ServiceBusReceivedMessage[]>;
  receiveMessages: (entityName: string, maxMessages?: number) => Promise<ServiceBusReceivedMessage[]>;
  sendMessage: (entityName: string, options: SendMessageOptions) => Promise<void>;
  sendMessages: (entityName: string, messages: SendMessageOptions[]) => Promise<void>;
  
  // Message management
  completeMessages: (entityName: string, messages: ServiceBusReceivedMessage[]) => Promise<void>;
  abandonMessages: (entityName: string, messages: ServiceBusReceivedMessage[]) => Promise<void>;
  deadLetterMessages: (entityName: string, messages: ServiceBusReceivedMessage[], reason?: string) => Promise<void>;
  
  // Dead letter operations
  getDeadLetterMessages: (entityName: string, maxMessages?: number) => Promise<ServiceBusReceivedMessage[]>;
  reprocessDeadLetterMessages: (entityName: string, messages: ServiceBusReceivedMessage[]) => Promise<void>;
  
  // Utilities
  clearMessages: () => void;
  clearError: () => void;
}

export const useServiceBusClient = (): UseServiceBusClientReturn => {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<ConnectionProfile | null>(null);
  const [entities, setEntities] = useState<ServiceBusEntity[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [messages, setMessages] = useState<ServiceBusReceivedMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Service instance
  const clientServiceRef = useRef<ServiceBusClientService>(new ServiceBusClientService());
  const { success, error: notifyError, info } = useNotifications();

  // Entity methods
  const discoverEntities = useCallback(async () => {
    if (!isConnected) return;
    
    setIsLoadingEntities(true);
    setError(null);
    
    try {
      const discoveredEntities = await clientServiceRef.current.discoverEntities();
      setEntities(discoveredEntities);
      
      info('Entities Discovered', `Found ${discoveredEntities.length} entities`);
    } catch (err) {
      const errorMessage = `Failed to discover entities: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Discovery Error', errorMessage);
    } finally {
      setIsLoadingEntities(false);
    }
  }, [isConnected, info, notifyError]);

  // Connection methods
  const connect = useCallback(async (profile: ConnectionProfile) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await clientServiceRef.current.connect(profile);
      setIsConnected(true);
      setCurrentProfile(profile);
      
      success('Connected', `Successfully connected to "${profile.name}"`);
      
      // Auto-discover entities after connection
      await discoverEntities();
    } catch (err) {
      const errorMessage = `Connection failed: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Connection Error', errorMessage);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [success, notifyError, discoverEntities]);

  const disconnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await clientServiceRef.current.disconnect();
      setIsConnected(false);
      setCurrentProfile(null);
      setEntities([]);
      setMessages([]);
      
      info('Disconnected', 'Successfully disconnected from Service Bus');
    } catch (err) {
      const errorMessage = `Disconnect failed: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Disconnect Error', errorMessage);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [info, notifyError]);

  const refreshEntity = useCallback(async (_entityName: string) => {
    if (!isConnected) return;
    
    try {
      // Re-discover all entities to get updated counts
      await discoverEntities();
    } catch (err) {
      const errorMessage = `Failed to refresh entity: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Refresh Error', errorMessage);
    }
  }, [isConnected, discoverEntities, notifyError]);

  // Message methods
  const peekMessages = useCallback(async (entityName: string, maxMessages: number = 10): Promise<ServiceBusReceivedMessage[]> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setIsLoadingMessages(true);
    setError(null);
    
    try {
      const result = await clientServiceRef.current.peekMessages(entityName, maxMessages);
      
      if (result.success && result.messages) {
        setMessages(result.messages);
        info('Messages Peeked', result.message);
        return result.messages;
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to peek messages: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Peek Error', errorMessage);
      throw err;
    } finally {
      setIsLoadingMessages(false);
    }
  }, [isConnected, info, notifyError]);

  const receiveMessages = useCallback(async (entityName: string, maxMessages: number = 10): Promise<ServiceBusReceivedMessage[]> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setIsLoadingMessages(true);
    setError(null);
    
    try {
      const result = await clientServiceRef.current.receiveMessages(entityName, maxMessages);
      
      if (result.success && result.messages) {
        setMessages(result.messages);
        success('Messages Received', result.message);
        return result.messages;
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to receive messages: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Receive Error', errorMessage);
      throw err;
    } finally {
      setIsLoadingMessages(false);
    }
  }, [isConnected, success, notifyError]);

  const sendMessage = useCallback(async (entityName: string, options: SendMessageOptions): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setError(null);
    
    try {
      const result = await clientServiceRef.current.sendMessage(entityName, options);
      
      if (result.success) {
        success('Message Sent', result.message);
        await refreshEntity(entityName);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to send message: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Send Error', errorMessage);
      throw err;
    }
  }, [isConnected, success, notifyError, refreshEntity]);

  const sendMessages = useCallback(async (entityName: string, messageOptions: SendMessageOptions[]): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setError(null);
    
    try {
      const result = await clientServiceRef.current.sendMessages(entityName, messageOptions);
      
      if (result.success) {
        success('Messages Sent', result.message);
        await refreshEntity(entityName);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to send messages: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Send Error', errorMessage);
      throw err;
    }
  }, [isConnected, success, notifyError, refreshEntity]);

  // Message management
  const completeMessages = useCallback(async (entityName: string, messagesToComplete: ServiceBusReceivedMessage[]): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setError(null);
    
    try {
      const result = await clientServiceRef.current.completeMessages(entityName, messagesToComplete);
      
      if (result.success) {
        success('Messages Completed', result.message);
        // Remove completed messages from current messages
        setMessages(prev => prev.filter(msg => !messagesToComplete.some(completed => completed.messageId === msg.messageId)));
        await refreshEntity(entityName);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to complete messages: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Complete Error', errorMessage);
      throw err;
    }
  }, [isConnected, success, notifyError, refreshEntity]);

  const abandonMessages = useCallback(async (entityName: string, messagesToAbandon: ServiceBusReceivedMessage[]): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setError(null);
    
    try {
      const result = await clientServiceRef.current.abandonMessages(entityName, messagesToAbandon);
      
      if (result.success) {
        info('Messages Abandoned', result.message);
        // Remove abandoned messages from current messages
        setMessages(prev => prev.filter(msg => !messagesToAbandon.some(abandoned => abandoned.messageId === msg.messageId)));
        await refreshEntity(entityName);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to abandon messages: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Abandon Error', errorMessage);
      throw err;
    }
  }, [isConnected, info, notifyError, refreshEntity]);

  const deadLetterMessages = useCallback(async (entityName: string, messagesToDeadLetter: ServiceBusReceivedMessage[], reason?: string): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setError(null);
    
    try {
      const result = await clientServiceRef.current.deadLetterMessages(entityName, messagesToDeadLetter, reason);
      
      if (result.success) {
        info('Messages Dead Lettered', result.message);
        // Remove dead lettered messages from current messages
        setMessages(prev => prev.filter(msg => !messagesToDeadLetter.some(deadLetter => deadLetter.messageId === msg.messageId)));
        await refreshEntity(entityName);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to dead letter messages: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Dead Letter Error', errorMessage);
      throw err;
    }
  }, [isConnected, info, notifyError, refreshEntity]);

  // Dead letter operations
  const getDeadLetterMessages = useCallback(async (entityName: string, maxMessages: number = 10): Promise<ServiceBusReceivedMessage[]> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setIsLoadingMessages(true);
    setError(null);
    
    try {
      const result = await clientServiceRef.current.getDeadLetterMessages(entityName, maxMessages);
      
      if (result.success && result.messages) {
        setMessages(result.messages);
        info('Dead Letter Messages Retrieved', result.message);
        return result.messages;
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to get dead letter messages: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Dead Letter Error', errorMessage);
      throw err;
    } finally {
      setIsLoadingMessages(false);
    }
  }, [isConnected, info, notifyError]);

  const reprocessDeadLetterMessages = useCallback(async (entityName: string, messagesToReprocess: ServiceBusReceivedMessage[]): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Service Bus');
    }
    
    setError(null);
    
    try {
      const result = await clientServiceRef.current.reprocessDeadLetterMessages(entityName, messagesToReprocess);
      
      if (result.success) {
        success('Messages Reprocessed', result.message);
        // Remove reprocessed messages from current messages
        setMessages(prev => prev.filter(msg => !messagesToReprocess.some(reprocessed => reprocessed.messageId === msg.messageId)));
        await refreshEntity(entityName);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      const errorMessage = `Failed to reprocess dead letter messages: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Reprocess Error', errorMessage);
      throw err;
    }
  }, [isConnected, success, notifyError, refreshEntity]);

  // Utilities
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const clientService = clientServiceRef.current;
    return () => {
      if (clientService.isConnected()) {
        clientService.disconnect().catch(console.error);
      }
    };
  }, []);

  return {
    // Connection state
    isConnected,
    isConnecting,
    currentProfile,
    
    // Entity discovery
    entities,
    isLoadingEntities,
    
    // Message operations
    messages,
    isLoadingMessages,
    
    // Error state
    error,
    
    // Connection methods
    connect,
    disconnect,
    
    // Entity methods
    discoverEntities,
    refreshEntity,
    
    // Message methods
    peekMessages,
    receiveMessages,
    sendMessage,
    sendMessages,
    
    // Message management
    completeMessages,
    abandonMessages,
    deadLetterMessages,
    
    // Dead letter operations
    getDeadLetterMessages,
    reprocessDeadLetterMessages,
    
    // Utilities
    clearMessages,
    clearError
  };
};