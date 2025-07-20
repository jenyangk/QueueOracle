import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilterBuilder, type FilterGroup, type SavedFilterProfile } from '../FilterBuilder';

// Mock the services
jest.mock('../../services/FilterProfileService', () => ({
  getFilterProfileService: () => ({
    saveProfile: jest.fn().mockResolvedValue({ id: 'test-id', name: 'Test Profile' }),
    markProfileAsUsed: jest.fn().mockResolvedValue(undefined),
    deleteProfile: jest.fn().mockResolvedValue(true),
  }),
}));

describe('FilterBuilder', () => {
  const mockFilter: FilterGroup = {
    id: 'root',
    name: 'Root Filter',
    operator: 'AND',
    conditions: [],
    groups: [],
    enabled: true,
  };

  const mockAvailableFields = [
    { path: 'user.id', type: 'string', sampleValues: ['123', '456'], frequency: 0.8 },
    { path: 'timestamp', type: 'date', sampleValues: ['2023-01-01'], frequency: 1.0 },
    { path: 'amount', type: 'number', sampleValues: [100, 200], frequency: 0.6 },
  ];

  const mockSavedProfiles: SavedFilterProfile[] = [
    {
      id: 'profile-1',
      name: 'Test Profile 1',
      description: 'A test profile',
      filter: mockFilter,
      createdAt: new Date('2023-01-01'),
      lastUsed: new Date('2023-01-02'),
      usageCount: 5,
      tags: ['test', 'demo'],
    },
  ];

  const defaultProps = {
    filter: mockFilter,
    onFilterChange: jest.fn(),
    availableFields: mockAvailableFields,
    savedProfiles: mockSavedProfiles,
    onSaveProfile: jest.fn(),
    onLoadProfile: jest.fn(),
    onDeleteProfile: jest.fn(),
    onExportFilter: jest.fn(),
    onImportFilter: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders filter builder with collapsed state', () => {
    render(<FilterBuilder {...defaultProps} />);
    
    expect(screen.getByText('ADVANCED FILTERS')).toBeInTheDocument();
    expect(screen.queryByText('Add Condition')).not.toBeInTheDocument();
  });

  it('expands filter builder when clicked', () => {
    render(<FilterBuilder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('ADVANCED FILTERS'));
    
    expect(screen.getByRole('button', { name: /add condition/i })).toBeInTheDocument();
  });

  it('shows active condition count in header', () => {
    const filterWithConditions: FilterGroup = {
      ...mockFilter,
      conditions: [
        {
          id: 'cond-1',
          fieldPath: 'user.id',
          operator: 'equals',
          value: '123',
          dataType: 'string',
          enabled: true,
        },
        {
          id: 'cond-2',
          fieldPath: 'amount',
          operator: 'greater_than',
          value: 100,
          dataType: 'number',
          enabled: true,
        },
      ],
    };

    render(<FilterBuilder {...defaultProps} filter={filterWithConditions} />);
    
    expect(screen.getByText('ADVANCED FILTERS (2)')).toBeInTheDocument();
  });

  it('adds new condition when add button is clicked', () => {
    const onFilterChange = jest.fn();
    render(<FilterBuilder {...defaultProps} onFilterChange={onFilterChange} />);
    
    // Expand the filter builder
    fireEvent.click(screen.getByText('ADVANCED FILTERS'));
    
    // Click add condition button
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
    
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: expect.arrayContaining([
          expect.objectContaining({
            fieldPath: '',
            operator: 'equals',
            value: '',
            dataType: 'string',
            enabled: true,
          }),
        ]),
      })
    );
  });

  it('opens save profile dialog', async () => {
    render(<FilterBuilder {...defaultProps} />);
    
    // Click save button
    fireEvent.click(screen.getByTitle('Save Filter Profile'));
    
    await waitFor(() => {
      expect(screen.getByText('SAVE FILTER PROFILE')).toBeInTheDocument();
    });
    
    expect(screen.getByPlaceholderText('Enter profile name')).toBeInTheDocument();
  });

  it('saves filter profile with valid data', async () => {
    const onSaveProfile = jest.fn();
    render(<FilterBuilder {...defaultProps} onSaveProfile={onSaveProfile} />);
    
    // Open save dialog
    fireEvent.click(screen.getByTitle('Save Filter Profile'));
    
    await waitFor(() => {
      expect(screen.getByText('SAVE FILTER PROFILE')).toBeInTheDocument();
    });
    
    // Fill in profile data
    fireEvent.change(screen.getByPlaceholderText('Enter profile name'), {
      target: { value: 'My Test Profile' },
    });
    fireEvent.change(screen.getByPlaceholderText('Optional description'), {
      target: { value: 'A test description' },
    });
    fireEvent.change(screen.getByPlaceholderText('tag1, tag2, tag3'), {
      target: { value: 'test, filter' },
    });
    
    // Save profile
    fireEvent.click(screen.getByText('SAVE'));
    
    expect(onSaveProfile).toHaveBeenCalledWith({
      name: 'My Test Profile',
      description: 'A test description',
      filter: mockFilter,
      tags: ['test', 'filter'],
    });
  });

  it('opens load profile dialog', async () => {
    render(<FilterBuilder {...defaultProps} />);
    
    // Click load button
    fireEvent.click(screen.getByTitle('Load Filter Profile'));
    
    await waitFor(() => {
      expect(screen.getByText('LOAD FILTER PROFILE')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Test Profile 1')).toBeInTheDocument();
    expect(screen.getByText('A test profile')).toBeInTheDocument();
  });

  it('loads selected profile', async () => {
    const onLoadProfile = jest.fn();
    render(<FilterBuilder {...defaultProps} onLoadProfile={onLoadProfile} />);
    
    // Open load dialog
    fireEvent.click(screen.getByTitle('Load Filter Profile'));
    
    await waitFor(() => {
      expect(screen.getByText('LOAD FILTER PROFILE')).toBeInTheDocument();
    });
    
    // Load profile
    fireEvent.click(screen.getByText('LOAD'));
    
    expect(onLoadProfile).toHaveBeenCalledWith(mockSavedProfiles[0]);
  });

  it('deletes profile when delete button is clicked', async () => {
    const onDeleteProfile = jest.fn();
    render(<FilterBuilder {...defaultProps} onDeleteProfile={onDeleteProfile} />);
    
    // Open load dialog
    fireEvent.click(screen.getByTitle('Load Filter Profile'));
    
    await waitFor(() => {
      expect(screen.getByText('LOAD FILTER PROFILE')).toBeInTheDocument();
    });
    
    // Delete profile
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => btn.textContent === '×');
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }
    
    expect(onDeleteProfile).toHaveBeenCalledWith('profile-1');
  });

  it('exports filter when export button is clicked', () => {
    const onExportFilter = jest.fn();
    render(<FilterBuilder {...defaultProps} onExportFilter={onExportFilter} />);
    
    fireEvent.click(screen.getByTitle('Export Filter'));
    
    expect(onExportFilter).toHaveBeenCalledWith(mockFilter);
  });

  it('opens import dialog', async () => {
    render(<FilterBuilder {...defaultProps} />);
    
    fireEvent.click(screen.getByTitle('Import Filter'));
    
    await waitFor(() => {
      expect(screen.getByText('IMPORT FILTER')).toBeInTheDocument();
    });
    
    expect(screen.getByPlaceholderText('Paste filter JSON here...')).toBeInTheDocument();
  });

  it('imports valid filter JSON', async () => {
    const onImportFilter = jest.fn();
    render(<FilterBuilder {...defaultProps} onImportFilter={onImportFilter} />);
    
    // Open import dialog
    fireEvent.click(screen.getByTitle('Import Filter'));
    
    await waitFor(() => {
      expect(screen.getByText('IMPORT FILTER')).toBeInTheDocument();
    });
    
    const validFilterJson = JSON.stringify(mockFilter);
    
    // Paste JSON
    fireEvent.change(screen.getByPlaceholderText('Paste filter JSON here...'), {
      target: { value: validFilterJson },
    });
    
    // Import
    fireEvent.click(screen.getByText('IMPORT'));
    
    expect(onImportFilter).toHaveBeenCalledWith(validFilterJson);
  });

  it('validates condition fields', () => {
    const filterWithInvalidCondition: FilterGroup = {
      ...mockFilter,
      conditions: [
        {
          id: 'cond-1',
          fieldPath: '', // Invalid: empty field path
          operator: 'equals',
          value: '123',
          dataType: 'string',
          enabled: true,
        },
      ],
    };

    render(<FilterBuilder {...defaultProps} filter={filterWithInvalidCondition} />);
    
    // Expand the filter builder
    fireEvent.click(screen.getByText('ADVANCED FILTERS (1)'));
    
    // Should show validation error
    expect(screen.getByText('Field path is required')).toBeInTheDocument();
  });

  it('handles regex validation', () => {
    const filterWithRegexCondition: FilterGroup = {
      ...mockFilter,
      conditions: [
        {
          id: 'cond-1',
          fieldPath: 'user.name',
          operator: 'regex',
          value: '[invalid regex', // Invalid regex
          dataType: 'string',
          enabled: true,
        },
      ],
    };

    render(<FilterBuilder {...defaultProps} filter={filterWithRegexCondition} />);
    
    // Expand the filter builder
    fireEvent.click(screen.getByText('ADVANCED FILTERS (1)'));
    
    // Should show regex validation error
    expect(screen.getByText('Invalid regular expression')).toBeInTheDocument();
  });

  it('disables value input for exists operator', () => {
    const filterWithExistsCondition: FilterGroup = {
      ...mockFilter,
      conditions: [
        {
          id: 'cond-1',
          fieldPath: 'user.id',
          operator: 'exists',
          value: true,
          dataType: 'string',
          enabled: true,
        },
      ],
    };

    render(<FilterBuilder {...defaultProps} filter={filterWithExistsCondition} />);
    
    // Expand the filter builder
    fireEvent.click(screen.getByText('ADVANCED FILTERS (1)'));
    
    // Value input should not be present for exists operator
    const valueInputs = screen.queryAllByPlaceholderText('Value');
    expect(valueInputs).toHaveLength(0);
  });

  it('shows secondary value input for between operator', () => {
    const filterWithBetweenCondition: FilterGroup = {
      ...mockFilter,
      conditions: [
        {
          id: 'cond-1',
          fieldPath: 'amount',
          operator: 'between',
          value: 100,
          secondaryValue: 200,
          dataType: 'number',
          enabled: true,
        },
      ],
    };

    render(<FilterBuilder {...defaultProps} filter={filterWithBetweenCondition} />);
    
    // Expand the filter builder
    fireEvent.click(screen.getByText('ADVANCED FILTERS (1)'));
    
    // Should show both value inputs
    expect(screen.getByPlaceholderText('Value')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('To')).toBeInTheDocument();
  });
});