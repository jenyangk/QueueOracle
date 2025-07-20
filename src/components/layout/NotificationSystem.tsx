import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string | undefined;
  duration?: number; // milliseconds, 0 for persistent
  timestamp: Date;
}

interface NotificationProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

const NotificationItem: React.FC<NotificationProps> = ({ 
  notification, 
  onDismiss 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(notification.id), 300);
      }, notification.duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [notification.duration, notification.id, onDismiss]);

  const typeStyles = {
    info: {
      border: 'border-blue-400/50',
      bg: 'bg-blue-400/10',
      text: 'text-blue-300',
      icon: 'ℹ'
    },
    success: {
      border: 'border-green-400/50',
      bg: 'bg-green-400/10',
      text: 'text-green-300',
      icon: '✓'
    },
    warning: {
      border: 'border-yellow-400/50',
      bg: 'bg-yellow-400/10',
      text: 'text-yellow-300',
      icon: '⚠'
    },
    error: {
      border: 'border-red-400/50',
      bg: 'bg-red-400/10',
      text: 'text-red-300',
      icon: '✗'
    }
  };

  const style = typeStyles[notification.type];

  return (
    <div className={cn(
      "transition-all duration-300 transform",
      isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
    )}>
      <div className={cn(
        "border font-mono p-3 mb-2 relative",
        style.border,
        style.bg
      )}>
        {/* ASCII Border Decoration */}
        <div className={cn("absolute -top-px -left-px text-xs", style.text)}>
          ┌
        </div>
        <div className={cn("absolute -top-px -right-px text-xs", style.text)}>
          ┐
        </div>
        <div className={cn("absolute -bottom-px -left-px text-xs", style.text)}>
          └
        </div>
        <div className={cn("absolute -bottom-px -right-px text-xs", style.text)}>
          ┘
        </div>

        {/* Content */}
        <div className="flex items-start gap-3">
          <span className={cn("text-lg", style.text)}>
            {style.icon}
          </span>
          <div className="flex-1">
            <div className={cn("font-semibold text-sm", style.text)}>
              {notification.title}
            </div>
            {notification.message && (
              <div className={cn("text-xs mt-1", style.text, "opacity-80")}>
                {notification.message}
              </div>
            )}
            <div className="text-xs opacity-60 mt-1">
              {notification.timestamp.toLocaleTimeString()}
            </div>
          </div>
          <button
            onClick={() => onDismiss(notification.id)}
            className={cn(
              "text-xs hover:opacity-80 transition-opacity",
              style.text
            )}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onDismiss,
  position = 'top-right',
  maxNotifications = 5
}) => {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  const visibleNotifications = notifications.slice(0, maxNotifications);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "fixed z-50 w-80 max-w-sm",
      positionClasses[position]
    )}>
      {visibleNotifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
      
      {notifications.length > maxNotifications && (
        <div className="text-center text-xs text-green-600 font-mono mt-2">
          +{notifications.length - maxNotifications} more notifications
        </div>
      )}
    </div>
  );
};

// Hook for managing notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (
    type: Notification['type'],
    title: string,
    message?: string,
    duration: number = 5000
  ) => {
    const notification: Notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      title,
      message: message || undefined,
      duration,
      timestamp: new Date()
    };

    setNotifications(prev => [notification, ...prev]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
    // Convenience methods
    info: (title: string, message?: string, duration?: number) => 
      addNotification('info', title, message, duration),
    success: (title: string, message?: string, duration?: number) => 
      addNotification('success', title, message, duration),
    warning: (title: string, message?: string, duration?: number) => 
      addNotification('warning', title, message, duration),
    error: (title: string, message?: string, duration?: number) => 
      addNotification('error', title, message, duration)
  };
};