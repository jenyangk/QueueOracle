import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { TerminalWindow } from '@/components/terminal';
import { ASCIISpinner } from '@/components/layout';
import type { ConnectionFormData, ConnectionValidationResult, ConnectionTestResult } from '../types/connection';

interface ConnectionFormProps {
  initialData?: Partial<ConnectionFormData>;
  onSubmit: (data: ConnectionFormData) => Promise<void>;
  onTest?: (data: ConnectionFormData) => Promise<ConnectionTestResult>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  initialData,
  onSubmit,
  onTest,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: initialData?.name || '',
    connectionString: initialData?.connectionString || '',
    type: initialData?.type || 'connectionString',
    azureConfig: initialData?.azureConfig || {
      tenantId: '',
      clientId: '',
      scopes: ['https://servicebus.azure.net/.default']
    }
  });

  const [validation, setValidation] = useState<ConnectionValidationResult>({
    isValid: true,
    errors: []
  });

  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const validateForm = (): ConnectionValidationResult => {
    const errors: ConnectionValidationResult['errors'] = [];

    if (!formData.name.trim()) {
      errors.push({ field: 'name', message: 'Connection name is required' });
    }

    if (formData.type === 'connectionString') {
      if (!formData.connectionString.trim()) {
        errors.push({ field: 'connectionString', message: 'Connection string is required' });
      } else if (!formData.connectionString.includes('Endpoint=')) {
        errors.push({ field: 'connectionString', message: 'Invalid connection string format' });
      }
    } else if (formData.type === 'azureAD') {
      if (!formData.azureConfig?.tenantId.trim()) {
        errors.push({ field: 'azureConfig', message: 'Tenant ID is required for Azure AD' });
      }
      if (!formData.azureConfig?.clientId.trim()) {
        errors.push({ field: 'azureConfig', message: 'Client ID is required for Azure AD' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationResult = validateForm();
    setValidation(validationResult);

    if (validationResult.isValid) {
      try {
        await onSubmit(formData);
      } catch (error) {
        console.error('Failed to save connection:', error);
      }
    }
  };

  const handleTest = async () => {
    if (!onTest) return;

    const validationResult = validateForm();
    setValidation(validationResult);

    if (validationResult.isValid) {
      setIsTesting(true);
      setTestResult(null);
      
      try {
        const result = await onTest(formData);
        setTestResult(result);
      } catch (error) {
        setTestResult({
          success: false,
          message: 'Connection test failed: ' + (error as Error).message
        });
      } finally {
        setIsTesting(false);
      }
    }
  };

  const getFieldError = (field: keyof ConnectionFormData) => {
    return validation.errors.find(error => error.field === field)?.message;
  };

  return (
    <TerminalWindow
      title="Connection Configuration"
      status="disconnected"
      actions={[
        {
          label: 'Test',
          command: 'test',
          onClick: handleTest,
          disabled: isTesting || isLoading
        },
        {
          label: 'Save',
          command: 'save',
          onClick: () => handleSubmit({} as React.FormEvent),
          disabled: isLoading
        },
        {
          label: 'Cancel',
          command: 'cancel',
          onClick: onCancel,
          disabled: isLoading
        }
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Connection Name */}
        <div>
          <label className="block text-green-300 text-sm font-mono mb-1">
            Connection Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className={cn(
              "w-full bg-black border font-mono text-sm p-2",
              "text-green-400 placeholder-green-600",
              getFieldError('name') ? "border-red-400" : "border-green-400/30",
              "focus:border-green-400 focus:outline-none"
            )}
            placeholder="My Service Bus Connection"
            disabled={isLoading}
          />
          {getFieldError('name') && (
            <div className="text-red-400 text-xs mt-1 font-mono">
              {getFieldError('name')}
            </div>
          )}
        </div>

        {/* Connection Type */}
        <div>
          <label className="block text-green-300 text-sm font-mono mb-1">
            Authentication Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm font-mono">
              <input
                type="radio"
                value="connectionString"
                checked={formData.type === 'connectionString'}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'connectionString' }))}
                className="text-green-400"
                disabled={isLoading}
              />
              <span className="text-green-400">Connection String</span>
            </label>
            <label className="flex items-center gap-2 text-sm font-mono">
              <input
                type="radio"
                value="azureAD"
                checked={formData.type === 'azureAD'}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'azureAD' }))}
                className="text-green-400"
                disabled={isLoading}
              />
              <span className="text-green-400">Azure AD</span>
            </label>
          </div>
        </div>

        {/* Connection String */}
        {formData.type === 'connectionString' && (
          <div>
            <label className="block text-green-300 text-sm font-mono mb-1">
              Connection String
            </label>
            <textarea
              value={formData.connectionString}
              onChange={(e) => setFormData(prev => ({ ...prev, connectionString: e.target.value }))}
              className={cn(
                "w-full bg-black border font-mono text-sm p-2 h-24 resize-none",
                "text-green-400 placeholder-green-600",
                getFieldError('connectionString') ? "border-red-400" : "border-green-400/30",
                "focus:border-green-400 focus:outline-none"
              )}
              placeholder="Endpoint=sb://your-namespace.servicebus.windows.net/;SharedAccessKeyName=..."
              disabled={isLoading}
            />
            {getFieldError('connectionString') && (
              <div className="text-red-400 text-xs mt-1 font-mono">
                {getFieldError('connectionString')}
              </div>
            )}
          </div>
        )}

        {/* Azure AD Configuration */}
        {formData.type === 'azureAD' && (
          <div className="space-y-3">
            <div>
              <label className="block text-green-300 text-sm font-mono mb-1">
                Tenant ID
              </label>
              <input
                type="text"
                value={formData.azureConfig?.tenantId || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  azureConfig: { ...prev.azureConfig!, tenantId: e.target.value }
                }))}
                className={cn(
                  "w-full bg-black border font-mono text-sm p-2",
                  "text-green-400 placeholder-green-600",
                  getFieldError('azureConfig') ? "border-red-400" : "border-green-400/30",
                  "focus:border-green-400 focus:outline-none"
                )}
                placeholder="your-tenant-id"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-green-300 text-sm font-mono mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={formData.azureConfig?.clientId || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  azureConfig: { ...prev.azureConfig!, clientId: e.target.value }
                }))}
                className={cn(
                  "w-full bg-black border font-mono text-sm p-2",
                  "text-green-400 placeholder-green-600",
                  getFieldError('azureConfig') ? "border-red-400" : "border-green-400/30",
                  "focus:border-green-400 focus:outline-none"
                )}
                placeholder="your-client-id"
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Test Result */}
        {(isTesting || testResult) && (
          <div className="border border-green-400/30 p-3">
            <div className="text-green-300 text-sm font-mono mb-2">
              Connection Test
            </div>
            {isTesting ? (
              <div className="flex items-center gap-2 text-sm">
                <ASCIISpinner size="sm" />
                <span className="text-green-400">Testing connection...</span>
              </div>
            ) : testResult && (
              <div className="space-y-1">
                <div className={cn(
                  "text-sm font-mono",
                  testResult.success ? "text-green-400" : "text-red-400"
                )}>
                  {testResult.success ? '✓' : '✗'} {testResult.message}
                </div>
                {testResult.details && (
                  <div className="text-xs text-green-600 space-y-1">
                    {testResult.details.endpoint && (
                      <div>Endpoint: {testResult.details.endpoint}</div>
                    )}
                    {testResult.details.entityPath && (
                      <div>Entity: {testResult.details.entityPath}</div>
                    )}
                    {testResult.details.permissions && (
                      <div>Permissions: {testResult.details.permissions.join(', ')}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </TerminalWindow>
  );
};