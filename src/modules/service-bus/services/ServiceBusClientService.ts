import { 
  ServiceBusClient, 
  type ServiceBusReceiver, 
  type ServiceBusSender,
  type ServiceBusMessage,
  type ServiceBusReceivedMessage,
  ServiceBusAdministrationClient
} from '@azure/service-bus';
import Long from 'long';

type ReceiveMode = 'peekLock' | 'receiveAndDelete';
import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser';
import type { ConnectionProfile } from '../types/connection';

export interface ServiceBusEntity {
  name: string;
  type: 'queue' | 'topic' | 'subscription';
  messageCount?: number;
  deadLetterMessageCount?: number;
  activeMessageCount?: number;
  scheduledMessageCount?: number;
  status?: string;
}

export interface MessageOperationResult {
  success: boolean;
  message: string;
  messageCount?: number;
  messages?: ServiceBusReceivedMessage[];
}

export interface SendMessageOptions {
  body: unknown;
  properties?: Record<string, unknown>;
  sessionId?: string;
  partitionKey?: string;
  timeToLive?: number;
  scheduledEnqueueTime?: Date;
  subject?: string;
  contentType?: string;
}

export class ServiceBusClientService {
  private client: ServiceBusClient | null = null;
  private adminClient: ServiceBusAdministrationClient | null = null;
  private msalInstance: PublicClientApplication | null = null;
  private currentProfile: ConnectionProfile | null = null;
  private receivers: Map<string, ServiceBusReceiver> = new Map();
  private senders: Map<string, ServiceBusSender> = new Map();

  /**
   * Connect to Service Bus using a connection profile
   */
  async connect(profile: ConnectionProfile): Promise<void> {
    try {
      await this.disconnect(); // Clean up any existing connections

      if (profile.type === 'connectionString') {
        await this.connectWithConnectionString(profile.connectionString);
      } else if (profile.type === 'azureAD') {
        await this.connectWithAzureAD(profile);
      } else {
        throw new Error('Unsupported connection type');
      }

      this.currentProfile = profile;
    } catch (error) {
      throw new Error(`Failed to connect to Service Bus: ${(error as Error).message}`);
    }
  }

  /**
   * Disconnect from Service Bus and clean up resources
   */
  async disconnect(): Promise<void> {
    try {
      // Close all receivers
      for (const [, receiver] of this.receivers) {
        await receiver.close();
      }
      this.receivers.clear();

      // Close all senders
      for (const [, sender] of this.senders) {
        await sender.close();
      }
      this.senders.clear();

      // Close clients
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.adminClient) {
        // Administration client doesn't have a close method
        this.adminClient = null;
      }

      this.currentProfile = null;
    } catch (error) {
      console.error('Error during disconnect:', error);
      throw new Error(`Failed to disconnect: ${(error as Error).message}`);
    }
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return this.client !== null && this.currentProfile !== null;
  }

  /**
   * Get current connection profile
   */
  getCurrentProfile(): ConnectionProfile | null {
    return this.currentProfile;
  }

  /**
   * Discover queues and topics
   */
  async discoverEntities(): Promise<ServiceBusEntity[]> {
    if (!this.adminClient) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const entities: ServiceBusEntity[] = [];

      // Get queues
      const queues = this.adminClient.listQueues();
      for await (const queue of queues) {
        const queueRuntimeProperties = await this.adminClient.getQueueRuntimeProperties(queue.name);
        entities.push({
          name: queue.name,
          type: 'queue',
          messageCount: queueRuntimeProperties.totalMessageCount ?? 0,
          activeMessageCount: queueRuntimeProperties.activeMessageCount,
          deadLetterMessageCount: queueRuntimeProperties.deadLetterMessageCount,
          scheduledMessageCount: queueRuntimeProperties.scheduledMessageCount,
          status: queue.status
        });
      }

      // Get topics
      const topics = this.adminClient.listTopics();
      for await (const topic of topics) {
        entities.push({
          name: topic.name,
          type: 'topic',
          status: topic.status
        });

        // Get subscriptions for each topic
        const subscriptions = this.adminClient.listSubscriptions(topic.name);
        for await (const subscription of subscriptions) {
          const subRuntimeProperties = await this.adminClient.getSubscriptionRuntimeProperties(
            topic.name, 
            subscription.subscriptionName
          );
          entities.push({
            name: `${topic.name}/${subscription.subscriptionName}`,
            type: 'subscription',
            messageCount: subRuntimeProperties.totalMessageCount,
            activeMessageCount: subRuntimeProperties.activeMessageCount,
            deadLetterMessageCount: subRuntimeProperties.deadLetterMessageCount,
            status: subscription.status
          });
        }
      }

      return entities;
    } catch (error) {
      throw new Error(`Failed to discover entities: ${(error as Error).message}`);
    }
  }

  /**
   * Peek messages from a queue or subscription
   */
  async peekMessages(
    entityName: string, 
    maxMessages: number = 10,
    fromSequenceNumber?: bigint
  ): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const receiver = await this.getReceiver(entityName, 'peekLock');
      const messages = await receiver.peekMessages(maxMessages, fromSequenceNumber ? { fromSequenceNumber: Long.fromValue(fromSequenceNumber) } : {});

      return {
        success: true,
        message: `Peeked ${messages.length} messages`,
        messageCount: messages.length,
        messages
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to peek messages: ${(error as Error).message}`
      };
    }
  }

  /**
   * Receive messages from a queue or subscription
   */
  async receiveMessages(
    entityName: string,
    maxMessages: number = 10,
    maxWaitTimeInMs: number = 5000
  ): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const receiver = await this.getReceiver(entityName, 'peekLock');
      const messages = await receiver.receiveMessages(maxMessages, { maxWaitTimeInMs });

      return {
        success: true,
        message: `Received ${messages.length} messages`,
        messageCount: messages.length,
        messages
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to receive messages: ${(error as Error).message}`
      };
    }
  }

  /**
   * Complete (delete) messages
   */
  async completeMessages(entityName: string, messages: ServiceBusReceivedMessage[]): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const receiver = await this.getReceiver(entityName, 'peekLock');
      
      for (const message of messages) {
        await receiver.completeMessage(message);
      }

      return {
        success: true,
        message: `Completed ${messages.length} messages`,
        messageCount: messages.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to complete messages: ${(error as Error).message}`
      };
    }
  }

  /**
   * Abandon messages (return to queue)
   */
  async abandonMessages(entityName: string, messages: ServiceBusReceivedMessage[]): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const receiver = await this.getReceiver(entityName, 'peekLock');
      
      for (const message of messages) {
        await receiver.abandonMessage(message);
      }

      return {
        success: true,
        message: `Abandoned ${messages.length} messages`,
        messageCount: messages.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to abandon messages: ${(error as Error).message}`
      };
    }
  }

  /**
   * Dead letter messages
   */
  async deadLetterMessages(
    entityName: string, 
    messages: ServiceBusReceivedMessage[],
    reason?: string,
    errorDescription?: string
  ): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const receiver = await this.getReceiver(entityName, 'peekLock');
      
      for (const message of messages) {
        await receiver.deadLetterMessage(message, {
          deadLetterReason: reason || 'Manual dead letter',
          deadLetterErrorDescription: errorDescription || 'Manual dead letter'
        });
      }

      return {
        success: true,
        message: `Dead lettered ${messages.length} messages`,
        messageCount: messages.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to dead letter messages: ${(error as Error).message}`
      };
    }
  }

  /**
   * Send a message to a queue or topic
   */
  async sendMessage(entityName: string, options: SendMessageOptions): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const sender = await this.getSender(entityName);
      
      const message: ServiceBusMessage = {
        body: options.body,
        ...(options.properties && { applicationProperties: options.properties as { [key: string]: string | number | boolean | Date | null } }),
        ...(options.sessionId && { sessionId: options.sessionId }),
        ...(options.partitionKey && { partitionKey: options.partitionKey }),
        ...(options.timeToLive && { timeToLive: options.timeToLive }),
        ...(options.scheduledEnqueueTime && { scheduledEnqueueTime: options.scheduledEnqueueTime }),
        ...(options.subject && { subject: options.subject }),
        ...(options.contentType && { contentType: options.contentType })
      };

      await sender.sendMessages(message);

      return {
        success: true,
        message: 'Message sent successfully',
        messageCount: 1
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send message: ${(error as Error).message}`
      };
    }
  }

  /**
   * Send multiple messages to a queue or topic
   */
  async sendMessages(entityName: string, messages: SendMessageOptions[]): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const sender = await this.getSender(entityName);
      
      const serviceBusMessages: ServiceBusMessage[] = messages.map(options => ({
        body: options.body,
        ...(options.properties && { applicationProperties: options.properties as { [key: string]: string | number | boolean | Date | null } }),
        ...(options.sessionId && { sessionId: options.sessionId }),
        ...(options.partitionKey && { partitionKey: options.partitionKey }),
        ...(options.timeToLive && { timeToLive: options.timeToLive }),
        ...(options.scheduledEnqueueTime && { scheduledEnqueueTime: options.scheduledEnqueueTime }),
        ...(options.subject && { subject: options.subject }),
        ...(options.contentType && { contentType: options.contentType })
      }));

      await sender.sendMessages(serviceBusMessages);

      return {
        success: true,
        message: `Sent ${messages.length} messages successfully`,
        messageCount: messages.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send messages: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get dead letter messages
   */
  async getDeadLetterMessages(entityName: string, maxMessages: number = 10): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const deadLetterEntityName = `${entityName}/$deadletterqueue`;
      const receiver = await this.getReceiver(deadLetterEntityName, 'peekLock');
      const messages = await receiver.receiveMessages(maxMessages, { maxWaitTimeInMs: 5000 });

      return {
        success: true,
        message: `Retrieved ${messages.length} dead letter messages`,
        messageCount: messages.length,
        messages
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get dead letter messages: ${(error as Error).message}`
      };
    }
  }

  /**
   * Reprocess dead letter messages (move back to main queue)
   */
  async reprocessDeadLetterMessages(
    entityName: string, 
    messages: ServiceBusReceivedMessage[]
  ): Promise<MessageOperationResult> {
    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    try {
      const deadLetterEntityName = `${entityName}/$deadletterqueue`;
      const deadLetterReceiver = await this.getReceiver(deadLetterEntityName, 'peekLock');
      const sender = await this.getSender(entityName);

      for (const message of messages) {
        // Send the message back to the main queue
        const newMessage: ServiceBusMessage = {
          body: message.body,
          ...(message.applicationProperties && { applicationProperties: message.applicationProperties }),
          ...(message.subject && { subject: message.subject }),
          ...(message.contentType && { contentType: message.contentType })
        };

        await sender.sendMessages(newMessage);
        
        // Complete the dead letter message
        await deadLetterReceiver.completeMessage(message);
      }

      return {
        success: true,
        message: `Reprocessed ${messages.length} dead letter messages`,
        messageCount: messages.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reprocess dead letter messages: ${(error as Error).message}`
      };
    }
  }

  /**
   * Connect using connection string
   */
  private async connectWithConnectionString(connectionString: string): Promise<void> {
    this.client = new ServiceBusClient(connectionString);
    this.adminClient = new ServiceBusAdministrationClient(connectionString);
    
    // Test the connection by trying to list queues
    try {
      const queues = this.adminClient.listQueues();
      await queues.next(); // Try to get the first queue to test connection
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Connect using Azure AD
   */
  private async connectWithAzureAD(profile: ConnectionProfile): Promise<void> {
    if (!profile.azureConfig) {
      throw new Error('Azure AD configuration is required');
    }

    // Initialize MSAL
    this.msalInstance = new PublicClientApplication({
      auth: {
        clientId: profile.azureConfig.clientId,
        authority: `https://login.microsoftonline.com/${profile.azureConfig.tenantId}`
      }
    });

    await this.msalInstance.initialize();

    // Get access token
    const accounts = this.msalInstance.getAllAccounts();
    let account: AccountInfo | null = null;

    if (accounts.length > 0) {
      account = accounts[0] || null;
    } else {
      // Interactive login
      const loginResponse = await this.msalInstance.loginPopup({
        scopes: profile.azureConfig.scopes
      });
      account = loginResponse.account;
    }

    if (!account) {
      throw new Error('Failed to authenticate with Azure AD');
    }

    // Get access token for Service Bus
    const tokenResponse = await this.msalInstance.acquireTokenSilent({
      scopes: profile.azureConfig.scopes,
      account
    });

    // Extract namespace from connection string or configuration
    const namespace = this.extractNamespaceFromProfile(profile);
    if (!namespace) {
      throw new Error('Could not determine Service Bus namespace');
    }

    // Create Service Bus client with token credential
    const credential = {
      getToken: async () => ({
        token: tokenResponse.accessToken,
        expiresOnTimestamp: tokenResponse.expiresOn?.getTime() || Date.now() + 3600000
      })
    };

    this.client = new ServiceBusClient(`${namespace}.servicebus.windows.net`, credential);
    this.adminClient = new ServiceBusAdministrationClient(`${namespace}.servicebus.windows.net`, credential);

    // Test the connection
    try {
      const queues = this.adminClient.listQueues();
      await queues.next();
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Get or create a receiver for an entity
   */
  private async getReceiver(entityName: string, receiveMode: ReceiveMode): Promise<ServiceBusReceiver> {
    const key = `${entityName}-${receiveMode}`;
    
    if (this.receivers.has(key)) {
      return this.receivers.get(key)!;
    }

    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    let receiver: ServiceBusReceiver;

    if (entityName.includes('/')) {
      // This is a subscription
      const [topicName, subscriptionName] = entityName.split('/');
      receiver = this.client.createReceiver(topicName || '', subscriptionName || '', { receiveMode });
    } else {
      // This is a queue
      receiver = this.client.createReceiver(entityName, { receiveMode });
    }

    this.receivers.set(key, receiver);
    return receiver;
  }

  /**
   * Get or create a sender for an entity
   */
  private async getSender(entityName: string): Promise<ServiceBusSender> {
    if (this.senders.has(entityName)) {
      return this.senders.get(entityName)!;
    }

    if (!this.client) {
      throw new Error('Not connected to Service Bus');
    }

    // For subscriptions, we send to the topic
    const targetEntity = entityName.includes('/') ? entityName.split('/')[0] : entityName;
    const sender = this.client.createSender(targetEntity || '');

    this.senders.set(entityName, sender);
    return sender;
  }

  /**
   * Extract namespace from connection profile
   */
  private extractNamespaceFromProfile(profile: ConnectionProfile): string | null {
    if (profile.type === 'connectionString') {
      const match = profile.connectionString.match(/Endpoint=sb:\/\/([^.]+)/);
      return match ? match[1] || null : null;
    }
    
    // For Azure AD, we might need additional configuration
    // This is a simplified implementation
    return null;
  }
}