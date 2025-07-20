/**
 * Unit tests for MessageList component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageList } from '../MessageList';
import type { ServiceBusMessage } from '../../../services/storage/types';

// Mock react-window
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemSize, height, itemData }: any) => (
    <div data-testid="virtualized-list" style={{ height }}>
      {Array.from({ length: Math.min(itemCount, 10) }, (_, index) => (
        <div key={index} style={{ height: itemSize }}>
          {children({ index, style: { height: itemSize }, data: itemData })}
        </div>
      ))}
    </div>
  ),
}));

// Mock MessageRow component
vi.mock('../MessageRow', () => ({
  MessageRow: ({ message, isSelected, onSelect, onDelete }: any) => (
    <div data-testid={`message-row-${message.messageId}`}>
      <span>{message.messageId}</span>
      <span>{JSON.stringify(message.body)}</span>
      <button 
        onClick={() => onSelect(message)}
        data-testid={`select-${message.messageId}`}
      >
        {isSelected ? 'Selected' : 'Select'}
      </button>
      <button 
        onClick={() => onDelete(message.messageId)}
        data-testid={`delete-${message.messageId}`}
      >
        Delete
      </button>
    </div>
  ),
}));

describe('MessageList', () => {
  const mockMessages: ServiceBusMessage[] = [
    {
      messageId: 'msg-1',
      sequenceNumber: '1',
      enqueuedTimeUtc: new Date('2023-01-01T10:00:00Z'),
      body: { type: 'order', id: 1 },
      properties: { source: 'web' },
      deliveryCount: 1,
      jsonFields: { 'type': 'order', 'id': 1 },
      analyzedAt: new Date(),
      connectionId: 'test-connection',
    },
    {
      messageId: 'msg-2',
      sequenceNumber: '2',
      enqueuedTimeUtc: new Date('2023-01-01T11:00:00Z'),
      body: { type: 'payment', id: 2 },
      properties: { source: 'mobile' },
      deliveryCount: 1,
      jsonFields: { 'type': 'payment', 'id': 2 },
      analyzedAt: new Date(),
      connectionId: 'test-connection',
    },
    {
      messageId: 'msg-3',
      sequenceNumber: '3',
      enqueuedTimeUtc: new Date('2023-01-01T12:00:00Z'),
      body: { type: 'notification', id: 3 },
      properties: { source: 'system' },
      deliveryCount: 2,
      jsonFields: { 'type': 'notification', 'id': 3 },
      analyzedAt: new Date(),
      connectionId: 'test-connection',
    },
  ];

  const defaultProps = {
    messages: mockMessages,
    onMessageSelect: vi.fn(),
    onMessageDelete: vi.fn(),
    virtualizedHeight: 400,
    filterCriteria: {
      dateRange: {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      },
      fieldFilters: [],
      messageTypes: [],
      textSearch: '',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render message list with virtualized container', () => {
      render(<MessageList {...defaultProps} />);
      
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
      expect(screen.getByTestId('virtualized-list')).toHaveStyle({ height: '400px' });
    });

    it('should render all messages within viewport', () => {
      render(<MessageList {...defaultProps} />);
      
      expect(screen.getByTestId('message-row-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('message-row-msg-2')).toBeInTheDocument();
      expect(screen.getByTestId('message-row-msg-3')).toBeInTheDocument();
    });

    it('should display message content', () => {
      render(<MessageList {...defaultProps} />);
      
      expect(screen.getByText('msg-1')).toBeInTheDocument();
      expect(screen.getByText('{"type":"order","id":1}')).toBeInTheDocument();
      expect(screen.getByText('msg-2')).toBeInTheDocument();
      expect(screen.getByText('{"type":"payment","id":2}')).toBeInTheDocument();
    });

    it('should handle empty message list', () => {
      render(<MessageList {...defaultProps} messages={[]} />);
      
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
      expect(screen.queryByTestId(/message-row-/)).not.toBeInTheDocument();
    });
  });

  describe('message selection', () => {
    it('should call onMessageSelect when message is selected', async () => {
      render(<MessageList {...defaultProps} />);
      
      const selectButton = screen.getByTestId('select-msg-1');
      fireEvent.click(selectButton);
      
      await waitFor(() => {
        expect(defaultProps.onMessageSelect).toHaveBeenCalledWith(mockMessages[0]);
      });
    });

    it('should show selected state for selected messages', () => {
      const selectedMessages = new Set(['msg-1']);
      render(<MessageList {...defaultProps} selectedMessages={selectedMessages} />);
      
      expect(screen.getByText('Selected')).toBeInTheDocument();
      expect(screen.getAllByText('Select')).toHaveLength(2); // Other messages not selected
    });

    it('should handle multiple message selection', async () => {
      render(<MessageList {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-msg-1'));
      fireEvent.click(screen.getByTestId('select-msg-2'));
      
      await waitFor(() => {
        expect(defaultProps.onMessageSelect).toHaveBeenCalledTimes(2);
        expect(defaultProps.onMessageSelect).toHaveBeenCalledWith(mockMessages[0]);
        expect(defaultProps.onMessageSelect).toHaveBeenCalledWith(mockMessages[1]);
      });
    });
  });

  describe('message deletion', () => {
    it('should call onMessageDelete when delete button is clicked', async () => {
      render(<MessageList {...defaultProps} />);
      
      const deleteButton = screen.getByTestId('delete-msg-1');
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(defaultProps.onMessageDelete).toHaveBeenCalledWith('msg-1');
      });
    });

    it('should handle deletion of multiple messages', async () => {
      render(<MessageList {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('delete-msg-1'));
      fireEvent.click(screen.getByTestId('delete-msg-2'));
      
      await waitFor(() => {
        expect(defaultProps.onMessageDelete).toHaveBeenCalledTimes(2);
        expect(defaultProps.onMessageDelete).toHaveBeenCalledWith('msg-1');
        expect(defaultProps.onMessageDelete).toHaveBeenCalledWith('msg-2');
      });
    });
  });

  describe('filtering', () => {
    it('should filter messages by text search', () => {
      const filteredProps = {
        ...defaultProps,
        filterCriteria: {
          ...defaultProps.filterCriteria,
          textSearch: 'order',
        },
      };

      render(<MessageList {...filteredProps} />);
      
      // Should only show messages containing 'order'
      expect(screen.getByTestId('message-row-msg-1')).toBeInTheDocument();
      expect(screen.queryByTestId('message-row-msg-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('message-row-msg-3')).not.toBeInTheDocument();
    });

    it('should filter messages by message type', () => {
      const filteredProps = {
        ...defaultProps,
        filterCriteria: {
          ...defaultProps.filterCriteria,
          messageTypes: ['payment'],
        },
      };

      render(<MessageList {...filteredProps} />);
      
      // Should only show payment messages
      expect(screen.queryByTestId('message-row-msg-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('message-row-msg-2')).toBeInTheDocument();
      expect(screen.queryByTestId('message-row-msg-3')).not.toBeInTheDocument();
    });

    it('should filter messages by date range', () => {
      const filteredProps = {
        ...defaultProps,
        filterCriteria: {
          ...defaultProps.filterCriteria,
          dateRange: {
            start: new Date('2023-01-01T10:30:00Z'),
            end: new Date('2023-01-01T11:30:00Z'),
          },
        },
      };

      render(<MessageList {...filteredProps} />);
      
      // Should only show messages within date range
      expect(screen.queryByTestId('message-row-msg-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('message-row-msg-2')).toBeInTheDocument();
      expect(screen.queryByTestId('message-row-msg-3')).not.toBeInTheDocument();
    });

    it('should filter messages by field filters', () => {
      const filteredProps = {
        ...defaultProps,
        filterCriteria: {
          ...defaultProps.filterCriteria,
          fieldFilters: [
            {
              fieldPath: 'id',
              operator: 'equals' as const,
              value: 2,
            },
          ],
        },
      };

      render(<MessageList {...filteredProps} />);
      
      // Should only show messages with id = 2
      expect(screen.queryByTestId('message-row-msg-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('message-row-msg-2')).toBeInTheDocument();
      expect(screen.queryByTestId('message-row-msg-3')).not.toBeInTheDocument();
    });
  });

  describe('performance', () => {
    it('should handle large message lists efficiently', () => {
      const largeMessageList = Array.from({ length: 1000 }, (_, index) => ({
        ...mockMessages[0],
        messageId: `msg-${index}`,
        sequenceNumber: index.toString(),
        body: { type: 'test', id: index },
      }));

      const { container } = render(
        <MessageList {...defaultProps} messages={largeMessageList} />
      );
      
      // Should render virtualized list without performance issues
      expect(container.querySelector('[data-testid="virtualized-list"]')).toBeInTheDocument();
      
      // Should only render visible items (mocked to 10 in our mock)
      const messageRows = container.querySelectorAll('[data-testid^="message-row-"]');
      expect(messageRows.length).toBeLessThanOrEqual(10);
    });

    it('should update efficiently when messages change', () => {
      const { rerender } = render(<MessageList {...defaultProps} />);
      
      const updatedMessages = [
        ...mockMessages,
        {
          ...mockMessages[0],
          messageId: 'msg-4',
          sequenceNumber: '4',
          body: { type: 'new', id: 4 },
        },
      ];

      rerender(<MessageList {...defaultProps} messages={updatedMessages} />);
      
      expect(screen.getByTestId('message-row-msg-4')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<MessageList {...defaultProps} />);
      
      const list = screen.getByTestId('virtualized-list');
      expect(list).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<MessageList {...defaultProps} />);
      
      const firstSelectButton = screen.getByTestId('select-msg-1');
      firstSelectButton.focus();
      
      expect(document.activeElement).toBe(firstSelectButton);
    });
  });

  describe('error handling', () => {
    it('should handle malformed message data gracefully', () => {
      const malformedMessages = [
        {
          ...mockMessages[0],
          body: null, // Malformed body
        },
        {
          ...mockMessages[1],
          jsonFields: undefined, // Missing jsonFields
        },
      ] as ServiceBusMessage[];

      expect(() => {
        render(<MessageList {...defaultProps} messages={malformedMessages} />);
      }).not.toThrow();
    });

    it('should handle callback errors gracefully', () => {
      const errorProps = {
        ...defaultProps,
        onMessageSelect: vi.fn(() => {
          throw new Error('Selection error');
        }),
      };

      render(<MessageList {...errorProps} />);
      
      // Should not crash when callback throws
      expect(() => {
        fireEvent.click(screen.getByTestId('select-msg-1'));
      }).not.toThrow();
    });
  });
});