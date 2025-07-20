/**
 * Analytics Dashboard Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { AnalyticsDashboard } from '../AnalyticsDashboard';
import { useMessageStore } from '../../../../stores/messageStore';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the message store
vi.mock('../../../../stores/messageStore');
const mockUseMessageStore = useMessageStore as any;

// Mock ECharts
vi.mock('echarts-for-react', () => ({
  default: ({ option }: any) => (
    <div data-testid="echarts-mock">{JSON.stringify(option.title)}</div>
  ),
}));

describe('AnalyticsDashboard', () => {
  const mockStore = {
    analytics: {
      id: 'test-analytics',
      connectionId: 'test-connection',
      totalMessages: 1000,
      messageTypes: { 'type1': 600, 'type2': 400 },
      fieldAnalytics: {},
      timeSeriesData: [],
      correlationMatrix: [],
      lastUpdated: new Date(),
    },
    fieldAnalytics: {},
    isAnalyzing: false,
    isAnalyticsEnabled: true,
    analyzeMessages: vi.fn(),
    setAnalyticsEnabled: vi.fn(),
  };

  beforeEach(() => {
    mockUseMessageStore.mockReturnValue(mockStore as any);
  });

  it('renders analytics dashboard with overview', () => {
    render(<AnalyticsDashboard connectionId="test-connection" />);
    
    expect(screen.getByText(/ANALYTICS DASHBOARD/)).toBeInTheDocument();
    expect(screen.getAllByText('TOTAL MESSAGES')[0]).toBeInTheDocument();
    expect(screen.getAllByText('1,000')[0]).toBeInTheDocument();
  });

  it('shows no data message when analytics is null', () => {
    mockUseMessageStore.mockReturnValue({
      ...mockStore,
      analytics: null,
    } as any);

    render(<AnalyticsDashboard connectionId="test-connection" />);
    
    expect(screen.getByText('┌─ No Analytics Data ─┐')).toBeInTheDocument();
    expect(screen.getByText('analyze')).toBeInTheDocument();
  });

  it('handles navigation between views', () => {
    render(<AnalyticsDashboard connectionId="test-connection" />);
    
    const fieldsButton = screen.getByTitle('Field Analysis');
    fireEvent.click(fieldsButton);
    
    // Should switch to fields view
    expect(screen.getByText('FIELD ANALYTICS')).toBeInTheDocument();
  });

  it('calls analyzeMessages when analyze button is clicked', () => {
    mockUseMessageStore.mockReturnValue({
      ...mockStore,
      analytics: null,
    } as any);

    render(<AnalyticsDashboard connectionId="test-connection" />);
    
    const analyzeButton = screen.getByText('analyze');
    fireEvent.click(analyzeButton);
    
    expect(mockStore.analyzeMessages).toHaveBeenCalledWith('test-connection');
  });
});