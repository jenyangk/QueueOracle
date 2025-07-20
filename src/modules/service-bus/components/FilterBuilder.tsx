import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  Filter, 
  Plus, 
  X, 
  Save, 
  FolderOpen, 
  Download, 
  Upload,
  Settings,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

export interface FilterCondition {
  id: string;
  fieldPath: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'regex' | 'not_regex' | 'exists' | 'not_exists' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: unknown;
  secondaryValue?: unknown; // For 'between' operator
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  enabled: boolean;
}

export interface FilterGroup {
  id: string;
  name: string;
  operator: 'AND' | 'OR';
  conditions: FilterCondition[];
  groups: FilterGroup[];
  enabled: boolean;
}

export interface SavedFilterProfile {
  id: string;
  name: string;
  description?: string;
  filter: FilterGroup;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  tags: string[];
}

export interface FilterBuilderProps {
  filter: FilterGroup;
  onFilterChange: (filter: FilterGroup) => void;
  availableFields: Array<{
    path: string;
    type: string;
    sampleValues: unknown[];
    frequency: number;
  }>;
  savedProfiles: SavedFilterProfile[];
  onSaveProfile: (profile: Omit<SavedFilterProfile, 'id' | 'createdAt' | 'lastUsed' | 'usageCount'>) => void;
  onLoadProfile: (profile: SavedFilterProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onExportFilter: (filter: FilterGroup) => void;
  onImportFilter: (filterData: string) => void;
  className?: string;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  filter,
  onFilterChange,
  availableFields,
  savedProfiles,
  onSaveProfile,
  onLoadProfile,
  onDeleteProfile,
  onExportFilter,
  onImportFilter,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [newProfileTags, setNewProfileTags] = useState('');
  const [importData, setImportData] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Generate unique ID for new conditions/groups
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Validate filter condition
  const validateCondition = useCallback((condition: FilterCondition): string | null => {
    if (!condition.fieldPath.trim()) {
      return 'Field path is required';
    }

    if (['equals', 'not_equals', 'contains', 'not_contains', 'regex', 'not_regex', 'greater_than', 'less_than', 'in', 'not_in'].includes(condition.operator)) {
      if (condition.value === undefined || condition.value === null || condition.value === '') {
        return 'Value is required for this operator';
      }
    }

    if (condition.operator === 'between') {
      if (condition.value === undefined || condition.secondaryValue === undefined) {
        return 'Both values are required for between operator';
      }
    }

    if (condition.operator === 'regex' || condition.operator === 'not_regex') {
      try {
        new RegExp(String(condition.value));
      } catch {
        return 'Invalid regular expression';
      }
    }

    return null;
  }, []);

  // Add new condition to group
  const addCondition = useCallback((groupId: string) => {
    const newCondition: FilterCondition = {
      id: generateId(),
      fieldPath: '',
      operator: 'equals',
      value: '',
      dataType: 'string',
      enabled: true,
    };

    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: [...group.conditions, newCondition],
        };
      }
      return {
        ...group,
        groups: group.groups.map(updateGroup),
      };
    };

    onFilterChange(updateGroup(filter));
  }, [filter, onFilterChange, generateId]);

  // Helper function to find a condition by ID
  const findCondition = useCallback((group: FilterGroup, conditionId: string): FilterCondition | null => {
    for (const condition of group.conditions) {
      if (condition.id === conditionId) {
        return condition;
      }
    }
    for (const subGroup of group.groups) {
      const found = findCondition(subGroup, conditionId);
      if (found) return found;
    }
    return null;
  }, []);

  // Update condition
  const updateCondition = useCallback((groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.map(condition =>
            condition.id === conditionId ? { ...condition, ...updates } : condition
          ),
        };
      }
      return {
        ...group,
        groups: group.groups.map(updateGroup),
      };
    };

    const updatedFilter = updateGroup(filter);
    onFilterChange(updatedFilter);

    // Validate the updated condition
    const condition = findCondition(updatedFilter, conditionId);
    if (condition) {
      const error = validateCondition(condition);
      setValidationErrors(prev => ({
        ...prev,
        [conditionId]: error || '',
      }));
    }
  }, [filter, onFilterChange, validateCondition, findCondition]);

  // Remove condition
  const removeCondition = useCallback((groupId: string, conditionId: string) => {
    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.filter(condition => condition.id !== conditionId),
        };
      }
      return {
        ...group,
        groups: group.groups.map(updateGroup),
      };
    };

    onFilterChange(updateGroup(filter));
    setValidationErrors(prev => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [conditionId]: _, ...rest } = prev;
      return rest;
    });
  }, [filter, onFilterChange]);

  // Add new group
  const addGroup = useCallback((parentGroupId: string) => {
    const newGroup: FilterGroup = {
      id: generateId(),
      name: 'New Group',
      operator: 'AND',
      conditions: [],
      groups: [],
      enabled: true,
    };

    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === parentGroupId) {
        return {
          ...group,
          groups: [...group.groups, newGroup],
        };
      }
      return {
        ...group,
        groups: group.groups.map(updateGroup),
      };
    };

    onFilterChange(updateGroup(filter));
  }, [filter, onFilterChange, generateId]);

  // Get field suggestions based on available fields
  const getFieldSuggestions = useMemo(() => {
    return availableFields.map(field => ({
      value: field.path,
      label: field.path,
      type: field.type,
      frequency: field.frequency,
    }));
  }, [availableFields]);

  // Save current filter as profile
  const handleSaveProfile = useCallback(() => {
    if (!newProfileName.trim()) return;

    const profile: Omit<SavedFilterProfile, 'id' | 'createdAt' | 'lastUsed' | 'usageCount'> = {
      name: newProfileName.trim(),
      description: newProfileDescription.trim() || undefined,
      filter: filter,
      tags: newProfileTags.split(',').map(tag => tag.trim()).filter(Boolean),
    };

    onSaveProfile(profile);
    setShowSaveDialog(false);
    setNewProfileName('');
    setNewProfileDescription('');
    setNewProfileTags('');
  }, [newProfileName, newProfileDescription, newProfileTags, filter, onSaveProfile]);

  // Import filter from JSON
  const handleImportFilter = useCallback(() => {
    try {
      JSON.parse(importData);
      onImportFilter(importData);
      setShowImportDialog(false);
      setImportData('');
    } catch {
      alert('Invalid JSON format');
    }
  }, [importData, onImportFilter]);

  // Count active conditions recursively
  const countActiveConditions = useCallback((group: FilterGroup): number => {
    const conditionCount = group.conditions.filter(c => c.enabled).length;
    const groupCount = group.groups.reduce((sum, g) => sum + countActiveConditions(g), 0);
    return conditionCount + groupCount;
  }, []);

  const activeConditionsCount = countActiveConditions(filter);

  return (
    <div className={cn('border border-green-400/30 bg-black', className)}>
      {/* Filter Header */}
      <div className="flex items-center justify-between p-2 border-b border-green-400/30">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span className="font-mono text-sm">
            ADVANCED FILTERS {activeConditionsCount > 0 && `(${activeConditionsCount})`}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-2 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
            title="Save Filter Profile"
          >
            <Save className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowLoadDialog(true)}
            className="px-2 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
            title="Load Filter Profile"
          >
            <FolderOpen className="w-3 h-3" />
          </button>
          <button
            onClick={() => onExportFilter(filter)}
            className="px-2 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
            title="Export Filter"
          >
            <Download className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="px-2 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
            title="Import Filter"
          >
            <Upload className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded Filter Content */}
      {isExpanded && (
        <div className="p-4">
          <FilterGroupComponent
            group={filter}
            onUpdateGroup={(updates) => onFilterChange({ ...filter, ...updates })}
            onAddCondition={() => addCondition(filter.id)}
            onUpdateCondition={updateCondition}
            onRemoveCondition={removeCondition}
            onAddGroup={() => addGroup(filter.id)}
            fieldSuggestions={getFieldSuggestions}
            validationErrors={validationErrors}
            level={0}
          />
        </div>
      )}

      {/* Save Profile Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black border border-green-400 p-4 w-96">
            <h3 className="text-green-400 font-mono text-sm mb-4">SAVE FILTER PROFILE</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-green-400/60 font-mono mb-1">NAME *</label>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
                  placeholder="Enter profile name"
                />
              </div>
              <div>
                <label className="block text-xs text-green-400/60 font-mono mb-1">DESCRIPTION</label>
                <textarea
                  value={newProfileDescription}
                  onChange={(e) => setNewProfileDescription(e.target.value)}
                  className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400 resize-none"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-xs text-green-400/60 font-mono mb-1">TAGS</label>
                <input
                  type="text"
                  value={newProfileTags}
                  onChange={(e) => setNewProfileTags(e.target.value)}
                  className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-3 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={!newProfileName.trim()}
                className="px-3 py-1 text-xs border border-green-400 text-green-400 bg-green-400/10 hover:bg-green-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Profile Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black border border-green-400 p-4 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-green-400 font-mono text-sm mb-4">LOAD FILTER PROFILE</h3>
            <div className="space-y-2">
              {savedProfiles.length === 0 ? (
                <div className="text-green-400/60 font-mono text-xs text-center py-4">
                  No saved profiles
                </div>
              ) : (
                savedProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="border border-green-400/30 p-2 hover:border-green-400 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-green-400 font-mono text-xs font-bold">
                          {profile.name}
                        </div>
                        {profile.description && (
                          <div className="text-green-400/60 font-mono text-xs mt-1">
                            {profile.description}
                          </div>
                        )}
                        <div className="text-green-400/40 font-mono text-xs mt-1">
                          Used {profile.usageCount} times • {new Date(profile.lastUsed).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            onLoadProfile(profile);
                            setShowLoadDialog(false);
                          }}
                          className="px-2 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
                        >
                          LOAD
                        </button>
                        <button
                          onClick={() => onDeleteProfile(profile.id)}
                          className="px-2 py-1 text-xs border border-red-400/30 text-red-400/60 hover:text-red-400 hover:border-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowLoadDialog(false)}
                className="px-3 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black border border-green-400 p-4 w-96">
            <h3 className="text-green-400 font-mono text-sm mb-4">IMPORT FILTER</h3>
            <div>
              <label className="block text-xs text-green-400/60 font-mono mb-1">FILTER JSON</label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400 resize-none"
                rows={6}
                placeholder="Paste filter JSON here..."
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-3 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleImportFilter}
                disabled={!importData.trim()}
                className="px-3 py-1 text-xs border border-green-400 text-green-400 bg-green-400/10 hover:bg-green-400/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                IMPORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Filter Group Component (recursive)
interface FilterGroupComponentProps {
  group: FilterGroup;
  onUpdateGroup: (updates: Partial<FilterGroup>) => void;
  onAddCondition: () => void;
  onUpdateCondition: (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => void;
  onRemoveCondition: (groupId: string, conditionId: string) => void;
  onAddGroup: () => void;
  fieldSuggestions: Array<{ value: string; label: string; type: string; frequency: number }>;
  validationErrors: Record<string, string>;
  level: number;
}

const FilterGroupComponent: React.FC<FilterGroupComponentProps> = ({
  group,
  onUpdateGroup,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  onAddGroup,
  fieldSuggestions,
  validationErrors,
  level,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(level > 0);

  return (
    <div className={cn(
      'border border-green-400/20 bg-green-400/5',
      level > 0 && 'ml-4 mt-2'
    )}>
      {/* Group Header */}
      <div className="flex items-center justify-between p-2 border-b border-green-400/20">
        <div className="flex items-center gap-2">
          {level > 0 && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-green-400/60 hover:text-green-400"
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <input
            type="text"
            value={group.name}
            onChange={(e) => onUpdateGroup({ name: e.target.value })}
            className="bg-transparent border-none text-green-400 font-mono text-xs focus:outline-none"
          />
          <select
            value={group.operator}
            onChange={(e) => onUpdateGroup({ operator: e.target.value as 'AND' | 'OR' })}
            className="bg-black border border-green-400/30 text-green-400 font-mono text-xs px-1"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onAddCondition}
            className="px-2 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
            title="Add Condition"
          >
            <Plus className="w-3 h-3" />
          </button>
          {level < 2 && (
            <button
              onClick={onAddGroup}
              className="px-2 py-1 text-xs border border-green-400/30 text-green-400/60 hover:text-green-400 hover:border-green-400 transition-colors"
              title="Add Group"
            >
              <Settings className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Group Content */}
      {!isCollapsed && (
        <div className="p-2 space-y-2">
          {/* Conditions */}
          {group.conditions.map((condition) => (
            <FilterConditionComponent
              key={condition.id}
              condition={condition}
              onUpdate={(updates) => onUpdateCondition(group.id, condition.id, updates)}
              onRemove={() => onRemoveCondition(group.id, condition.id)}
              fieldSuggestions={fieldSuggestions}
              validationError={validationErrors[condition.id]}
            />
          ))}

          {/* Nested Groups */}
          {group.groups.map((subGroup) => (
            <FilterGroupComponent
              key={subGroup.id}
              group={subGroup}
              onUpdateGroup={(updates) => {
                const updatedGroups = group.groups.map(g =>
                  g.id === subGroup.id ? { ...g, ...updates } : g
                );
                onUpdateGroup({ groups: updatedGroups });
              }}
              onAddCondition={() => {
                // Add condition to subgroup logic would go here
              }}
              onUpdateCondition={onUpdateCondition}
              onRemoveCondition={onRemoveCondition}
              onAddGroup={() => {
                // Add nested group logic would go here
              }}
              fieldSuggestions={fieldSuggestions}
              validationErrors={validationErrors}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Filter Condition Component
interface FilterConditionComponentProps {
  condition: FilterCondition;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
  fieldSuggestions: Array<{ value: string; label: string; type: string; frequency: number }>;
  validationError?: string;
}

const FilterConditionComponent: React.FC<FilterConditionComponentProps> = ({
  condition,
  onUpdate,
  onRemove,
  fieldSuggestions,
  validationError,
}) => {
  const operatorOptions = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'not contains' },
    { value: 'regex', label: 'regex' },
    { value: 'not_regex', label: 'not regex' },
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'not exists' },
    { value: 'greater_than', label: '>' },
    { value: 'less_than', label: '<' },
    { value: 'between', label: 'between' },
    { value: 'in', label: 'in' },
    { value: 'not_in', label: 'not in' },
  ];

  const needsValue = !['exists', 'not_exists'].includes(condition.operator);
  const needsSecondaryValue = condition.operator === 'between';

  return (
    <div className={cn(
      'grid grid-cols-12 gap-2 p-2 border border-green-400/20',
      !condition.enabled && 'opacity-50',
      validationError && 'border-red-400/50'
    )}>
      {/* Enable/Disable Toggle */}
      <div className="col-span-1 flex items-center">
        <input
          type="checkbox"
          checked={condition.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          className="w-3 h-3"
        />
      </div>

      {/* Field Path */}
      <div className="col-span-3">
        <input
          type="text"
          value={condition.fieldPath}
          onChange={(e) => onUpdate({ fieldPath: e.target.value })}
          list={`fields-${condition.id}`}
          className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
          placeholder="Field path"
        />
        <datalist id={`fields-${condition.id}`}>
          {fieldSuggestions.map((field) => (
            <option key={field.value} value={field.value}>
              {field.label} ({field.type})
            </option>
          ))}
        </datalist>
      </div>

      {/* Operator */}
      <div className="col-span-2">
        <select
          value={condition.operator}
          onChange={(e) => onUpdate({ operator: e.target.value as any })}
          className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
        >
          {operatorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Primary Value */}
      <div className="col-span-3">
        {needsValue && (
          <input
            type="text"
            value={String(condition.value || '')}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
            placeholder="Value"
          />
        )}
      </div>

      {/* Secondary Value (for between operator) */}
      <div className="col-span-2">
        {needsSecondaryValue && (
          <input
            type="text"
            value={String(condition.secondaryValue || '')}
            onChange={(e) => onUpdate({ secondaryValue: e.target.value })}
            className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
            placeholder="To"
          />
        )}
      </div>

      {/* Remove Button */}
      <div className="col-span-1 flex items-center justify-end">
        <button
          onClick={onRemove}
          className="text-red-400/60 hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="col-span-12 flex items-center gap-1 text-red-400 text-xs font-mono">
          <AlertCircle className="w-3 h-3" />
          {validationError}
        </div>
      )}
    </div>
  );
};