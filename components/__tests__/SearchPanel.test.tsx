import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchPanel from '../SearchPanel';
import { SearchFilters, Conversation } from '../../types';

const mockSearchFilters: SearchFilters = {
  dateRange: 'all',
  contentType: 'all',
  source: 'all',
  tags: [],
  minFragments: 0,
  sortBy: 'relevance',
  priority: 'all',
  collaboration: 'all',
  exportFormat: 'all',
  status: 'all'
};

const mockConversations: Conversation[] = [
  {
    id: '1',
    title: 'Test Conversation 1',
    messages: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    platform: 'openai',
    status: 'active',
    tags: ['test'],
    priority: 'high',
    fragmentCount: 5
  },
  {
    id: '2',
    title: 'Test Conversation 2',
    messages: [],
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
    platform: 'claude',
    status: 'completed',
    tags: ['test', 'demo'],
    priority: 'medium',
    fragmentCount: 3
  }
];

const mockProps = {
  searchQuery: '',
  onSearchQueryChange: jest.fn(),
  searchResults: mockConversations,
  searchFilters: mockSearchFilters,
  onFiltersChange: jest.fn(),
  onPerformSearch: jest.fn(),
  onExportResults: jest.fn(),
  isSearching: false,
  showAdvancedSearch: false,
  onToggleAdvancedSearch: jest.fn()
};

describe('SearchPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input correctly', () => {
    render(<SearchPanel {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search conversations/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('calls onSearchQueryChange when typing in search input', () => {
    render(<SearchPanel {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search conversations/i);
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    expect(mockProps.onSearchQueryChange).toHaveBeenCalledWith('test query');
  });

  it('displays search results correctly', () => {
    render(<SearchPanel {...mockProps} />);
    
    expect(screen.getByText('Test Conversation 1')).toBeInTheDocument();
    expect(screen.getByText('Test Conversation 2')).toBeInTheDocument();
  });

  it('shows advanced search when toggled', () => {
    const propsWithAdvanced = { ...mockProps, showAdvancedSearch: true };
    render(<SearchPanel {...propsWithAdvanced} />);
    
    expect(screen.getByText(/date range/i)).toBeInTheDocument();
    expect(screen.getByText(/content type/i)).toBeInTheDocument();
  });

  it('calls onToggleAdvancedSearch when advanced search button is clicked', () => {
    render(<SearchPanel {...mockProps} />);
    
    const advancedButton = screen.getByRole('button', { name: /advanced/i });
    fireEvent.click(advancedButton);
    
    expect(mockProps.onToggleAdvancedSearch).toHaveBeenCalled();
  });

  it('calls onExportResults when export button is clicked', () => {
    render(<SearchPanel {...mockProps} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);
    
    expect(mockProps.onExportResults).toHaveBeenCalled();
  });

  it('shows loading state when searching', () => {
    const loadingProps = { ...mockProps, isSearching: true };
    render(<SearchPanel {...loadingProps} />);
    
    expect(screen.getByText(/searching/i)).toBeInTheDocument();
  });

  it('displays correct result count', () => {
    render(<SearchPanel {...mockProps} />);
    
    expect(screen.getByText(/2 results/i)).toBeInTheDocument();
  });

  it('handles filter changes correctly', async () => {
    const propsWithAdvanced = { ...mockProps, showAdvancedSearch: true };
    render(<SearchPanel {...propsWithAdvanced} />);
    
    const dateRangeSelect = screen.getByDisplayValue('all');
    fireEvent.change(dateRangeSelect, { target: { value: 'week' } });
    
    await waitFor(() => {
      expect(mockProps.onFiltersChange).toHaveBeenCalled();
    });
  });
});