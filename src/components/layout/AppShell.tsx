import React from 'react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({ children, className }) => {
  return (
    <div className={cn(
      "min-h-screen bg-black text-green-400 font-mono",
      "flex flex-col",
      className
    )}>
      {/* ASCII Header */}
      <header className="border-b border-green-400/30 p-4">
        <div className="text-center">
          <pre className="text-xs leading-none text-green-300">
{`╔═══════════════════════════════════════════════════════════════════════════════╗
║                        Azure Service Bus Explorer                             ║
║                              Terminal Interface                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝`}
          </pre>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* ASCII Footer */}
      <footer className="border-t border-green-400/30 p-2">
        <div className="text-center text-xs text-green-600">
          <span>PWA Ready</span>
          <span className="mx-2">│</span>
          <span>Secure Storage</span>
          <span className="mx-2">│</span>
          <span>Real-time Analytics</span>
        </div>
      </footer>
    </div>
  );
};