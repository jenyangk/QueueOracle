import React from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  active?: boolean;
  disabled?: boolean;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className
}) => {
  return (
    <div className={cn("border-b border-green-400/30", className)}>
      {/* ASCII Tab Headers */}
      <div className="flex">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const isFirst = index === 0;
          const isLast = index === tabs.length - 1;
          
          return (
            <div key={tab.id} className="relative">
              {/* Tab Content */}
              <button
                onClick={() => !tab.disabled && onTabChange(tab.id)}
                disabled={tab.disabled}
                className={cn(
                  "px-4 py-2 text-sm font-mono transition-colors",
                  "border-r border-green-400/30",
                  isActive
                    ? "bg-green-400/10 text-green-300 border-b-2 border-green-400"
                    : "text-green-600 hover:text-green-400 hover:bg-green-400/5",
                  tab.disabled && "opacity-50 cursor-not-allowed",
                  isFirst && "border-l border-green-400/30"
                )}
              >
                <div className="flex items-center gap-2">
                  {tab.icon && <span className="text-xs">{tab.icon}</span>}
                  <span>{tab.label}</span>
                  {isActive && <span className="text-green-300">●</span>}
                </div>
              </button>
              
              {/* ASCII Tab Decorations */}
              {isActive && (
                <div className="absolute -bottom-px left-0 right-0">
                  <div className="text-green-400 text-xs leading-none">
                    {isFirst ? '┌' : '├'}
                    {'─'.repeat(tab.label.length + (tab.icon ? 6 : 4))}
                    {isLast ? '┐' : '┤'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Tab Content Border */}
      <div className="text-green-400/30 text-xs leading-none">
        {'─'.repeat(80)}
      </div>
    </div>
  );
};