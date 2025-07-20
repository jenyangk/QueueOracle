/**
 * Analytics Dashboard - Main analytics interface for Service Bus messages
 */

import React, { useState, useMemo } from 'react';
import { useMessageStore } from '../../../stores/messageStore';
import { FieldAnalyticsTable } from './FieldAnalyticsTable';
import { FieldDetailView } from './FieldDetailView';
import { MessageVolumeChart } from './MessageVolumeChart';
import { CorrelationMatrix } from './CorrelationMatrix';
import { MessagePatternChart } from './MessagePatternChart';
import { TerminalWindow } from '../../../components/terminal/TerminalWindow';
import { CommandButton } from '../../../components/terminal/CommandButton';
import { StatusIndicator } from '../../../components/terminal/StatusIndicator';

interface AnalyticsDashboardProps {
  connectionId: string;
}

type DashboardView = 'overview' | 'fields' | 'patterns' | 'correlations' | 'trends';

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ connectionId }) => {
  const {
    analytics,
    fieldAnalytics,
    isAnalyzing,
    isAnalyticsEnabled,
    analyzeMessages,
    setAnalyticsEnabled,
  } = useMessageStore();

  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [selectedField, setSelectedField] = useState<string | null>(null);

  const fieldAnalyticsArray = useMemo(() => {
    return Object.values(fieldAnalytics).sort((a, b) => b.count - a.count);
  }, [fieldAnalytics]);

  const handleAnalyzeMessages = async () => {
    await analyzeMessages(connectionId);
  };

  const handleFieldSelect = (fieldPath: string) => {
    setSelectedField(fieldPath);
    setCurrentView('fields');
  };

  const renderViewContent = () => {
    if (!analytics && !isAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-green-400 text-lg">┌─ No Analytics Data ─┐</div>
          <div className="text-green-300">│ Run analysis to view insights │</div>
          <div className="text-green-400">└─────────────────────┘</div>
          <CommandButton
            command="analyze"
            description="Analyze messages"
            onClick={handleAnalyzeMessages}
            disabled={isAnalyzing}
          />
        </div>
      );
    }

    switch (currentView) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-green-500 p-4 bg-black/50">
                <div className="text-green-400 text-sm">TOTAL MESSAGES</div>
                <div className="text-green-300 text-2xl font-mono">
                  {analytics?.totalMessages.toLocaleString() || 0}
                </div>
              </div>
              <div className="border border-green-500 p-4 bg-black/50">
                <div className="text-green-400 text-sm">UNIQUE FIELDS</div>
                <div className="text-green-300 text-2xl font-mono">
                  {fieldAnalyticsArray.length}
                </div>
              </div>
              <div className="border border-green-500 p-4 bg-black/50">
                <div className="text-green-400 text-sm">MESSAGE TYPES</div>
                <div className="text-green-300 text-2xl font-mono">
                  {Object.keys(analytics?.messageTypes || {}).length}
                </div>
              </div>
              <div className="border border-green-500 p-4 bg-black/50">
                <div className="text-green-400 text-sm">CORRELATIONS</div>
                <div className="text-green-300 text-2xl font-mono">
                  {analytics?.correlationMatrix.length || 0}
                </div>
              </div>
            </div>
            
            {analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MessageVolumeChart 
                  timeSeriesData={analytics.timeSeriesData}
                  title="Message Volume Over Time"
                />
                <MessagePatternChart 
                  messageTypes={analytics.messageTypes}
                  title="Message Type Distribution"
                />
              </div>
            )}
          </div>
        );

      case 'fields':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <FieldAnalyticsTable
                fieldAnalytics={fieldAnalyticsArray}
                onFieldSelect={handleFieldSelect}
                selectedField={selectedField}
              />
            </div>
            <div>
              {selectedField && fieldAnalytics[selectedField] && (
                <FieldDetailView
                  fieldAnalytics={fieldAnalytics[selectedField]}
                  onClose={() => setSelectedField(null)}
                />
              )}
            </div>
          </div>
        );

      case 'patterns':
        return (
          <div className="space-y-6">
            <MessagePatternChart 
              messageTypes={analytics?.messageTypes || {}}
              title="Message Pattern Analysis"
              showDetails={true}
            />
            {analytics && (
              <MessageVolumeChart 
                timeSeriesData={analytics.timeSeriesData}
                title="Pattern Trends Over Time"
                showPatterns={true}
              />
            )}
          </div>
        );

      case 'correlations':
        return (
          <div className="space-y-6">
            {analytics && (
              <CorrelationMatrix 
                correlationData={analytics.correlationMatrix}
                fieldAnalytics={fieldAnalyticsArray}
              />
            )}
          </div>
        );

      case 'trends':
        return (
          <div className="space-y-6">
            {analytics && (
              <>
                <MessageVolumeChart 
                  timeSeriesData={analytics.timeSeriesData}
                  title="Message Volume Trends"
                  showTrendLine={true}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {fieldAnalyticsArray.slice(0, 4).map(field => (
                    <MessageVolumeChart
                      key={field.fieldPath}
                      timeSeriesData={field.trend}
                      title={`Field Trend: ${field.fieldPath}`}
                      showTrendLine={true}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const navigationButtons = [
    { key: 'overview', label: 'Overview', command: 'overview' },
    { key: 'fields', label: 'Field Analysis', command: 'fields' },
    { key: 'patterns', label: 'Patterns', command: 'patterns' },
    { key: 'correlations', label: 'Correlations', command: 'correlations' },
    { key: 'trends', label: 'Trends', command: 'trends' },
  ];

  return (
    <TerminalWindow
      title="Analytics Dashboard"
      status={isAnalyzing ? 'connected' : analytics ? 'connected' : 'disconnected'}
      actions={[
        {
          label: isAnalyticsEnabled ? 'Disable Analytics' : 'Enable Analytics',
          command: 'toggle-analytics',
          onClick: () => setAnalyticsEnabled(!isAnalyticsEnabled),
        },
        {
          label: 'Refresh Analysis',
          command: 'refresh',
          onClick: handleAnalyzeMessages,
          disabled: isAnalyzing || !isAnalyticsEnabled,
        },
      ]}
    >
      <div className="space-y-4">
        {/* Status Bar */}
        <div className="flex items-center justify-between border-b border-green-500 pb-2">
          <div className="flex items-center space-x-4">
            <StatusIndicator 
              status={isAnalyzing ? 'connecting' : analytics ? 'online' : 'offline'}
              label={isAnalyzing ? 'Analyzing...' : analytics ? 'Analytics Ready' : 'No Data'}
            />
            {analytics && (
              <div className="text-green-400 text-sm font-mono">
                Last Updated: {analytics.lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
          <div className="text-green-400 text-sm">
            Analytics: {isAnalyticsEnabled ? 'ENABLED' : 'DISABLED'}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2">
          {navigationButtons.map(button => (
            <CommandButton
              key={button.key}
              command={button.command}
              description={button.label}
              onClick={() => setCurrentView(button.key as DashboardView)}
              variant={currentView === button.key ? 'primary' : 'secondary'}
              disabled={!analytics && !isAnalyzing}
            />
          ))}
        </div>

        {/* Content */}
        <div className="min-h-96">
          {renderViewContent()}
        </div>
      </div>
    </TerminalWindow>
  );
};