import { useState } from 'react';
import { 
  AppShell, 
  TabNavigation, 
  GridContainer, 
  GridPanel,
  NotificationSystem,
  useNotifications 
} from './components/layout';
import { TerminalWindow } from './components/terminal';
import { PWAUpdateNotification } from './components/pwa/PWAUpdateNotification';
import { PWAInstallPrompt } from './components/pwa/PWAInstallPrompt';
import { NetworkStatusIndicator } from './components/pwa/NetworkStatusIndicator';

function App() {
  const [activeTab, setActiveTab] = useState('service-bus');
  const { notifications, dismissNotification, info, success } = useNotifications();

  const tabs = [
    { id: 'service-bus', label: 'Service Bus', icon: '📨' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'chirpstack', label: 'Chirpstack', icon: '📡', disabled: true },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  const handleDemoNotification = () => {
    info('Connection Status', 'Successfully connected to Azure Service Bus');
  };

  const handleDemoSuccess = () => {
    success('Message Sent', 'Message queued successfully');
  };

  return (
    <AppShell>
      <TabNavigation 
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <div className="flex-1 p-4">
        <GridContainer columns={2} gap="md">
          <GridPanel title="Connection Status" fullHeight>
            <TerminalWindow 
              title="Azure Service Bus"
              status="disconnected"
              actions={[
                { 
                  label: 'Connect', 
                  command: 'connect', 
                  onClick: handleDemoNotification 
                },
                { 
                  label: 'Test', 
                  command: 'test', 
                  onClick: handleDemoSuccess 
                }
              ]}
            >
              <div className="space-y-2 text-sm">
                <div className="text-green-600">
                  Status: <span className="text-red-400">Disconnected</span>
                </div>
                <div className="text-green-600">
                  Endpoint: <span className="text-green-300">Not configured</span>
                </div>
                <div className="text-green-600">
                  Last Activity: <span className="text-green-300">Never</span>
                </div>
              </div>
            </TerminalWindow>
          </GridPanel>

          <GridPanel title="Quick Actions" fullHeight>
            <div className="space-y-3">
              <div className="text-green-300 text-sm font-mono">
                Available Commands:
              </div>
              <div className="space-y-2 text-xs">
                <div className="text-green-600">
                  <span className="text-green-400">connect</span> - Connect to Service Bus
                </div>
                <div className="text-green-600">
                  <span className="text-green-400">peek</span> - Peek messages
                </div>
                <div className="text-green-600">
                  <span className="text-green-400">send</span> - Send message
                </div>
                <div className="text-green-600">
                  <span className="text-green-400">analyze</span> - Run analytics
                </div>
              </div>
            </div>
          </GridPanel>

          <GridPanel title="Message Queue" fullHeight>
            <div className="text-center text-green-600 py-8">
              <div className="text-2xl mb-2">📭</div>
              <div className="text-sm">No messages</div>
              <div className="text-xs opacity-60">Connect to view messages</div>
            </div>
          </GridPanel>

          <GridPanel title="Analytics Dashboard" fullHeight>
            <div className="text-center text-green-600 py-8">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm">No data</div>
              <div className="text-xs opacity-60">Process messages to see analytics</div>
            </div>
          </GridPanel>
        </GridContainer>
      </div>

      <NotificationSystem 
        notifications={notifications}
        onDismiss={dismissNotification}
        position="top-right"
      />
      
      {/* PWA Components */}
      <NetworkStatusIndicator />
      <PWAUpdateNotification />
      <PWAInstallPrompt />
    </AppShell>
  );
}

export default App;
