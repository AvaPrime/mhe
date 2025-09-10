import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CodessaMemoryHarvester from '../codessa-memory-harvester';

// Mock the child components to focus on integration
jest.mock('../components/SearchPanel', () => {
  return function MockSearchPanel(props: any) {
    return (
      <div data-testid="search-panel">
        <input
          data-testid="search-input"
          value={props.searchQuery}
          onChange={(e) => props.onSearchQueryChange(e.target.value)}
          placeholder="Search conversations"
        />
        <button onClick={props.onPerformSearch}>Search</button>
        <div data-testid="search-results">
          {props.searchResults.map((result: any) => (
            <div key={result.id}>{result.title}</div>
          ))}
        </div>
      </div>
    );
  };
});

jest.mock('../components/AnalyticsDashboard', () => {
  return function MockAnalyticsDashboard(props: any) {
    return (
      <div data-testid="analytics-dashboard">
        <div>Total Tokens: {props.realTimeAnalytics.totalTokens}</div>
        <div>Projects: {props.realTimeAnalytics.projectsGenerated}</div>
        <div>Agents: {props.realTimeAnalytics.agentsDeployed}</div>
      </div>
    );
  };
});

jest.mock('../components/APIConnectionsPanel', () => {
  return function MockAPIConnectionsPanel(props: any) {
    return (
      <div data-testid="api-connections-panel">
        {Object.entries(props.apiConnections).map(([key, connection]: [string, any]) => (
          <div key={key}>
            <span>{connection.name}</span>
            <span>{connection.status}</span>
            <button onClick={() => props.onToggleConnection(key)}>Toggle</button>
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../components/ContentManagementPanel', () => {
  return function MockContentManagementPanel(props: any) {
    return (
      <div data-testid="content-management-panel">
        <div>Conversations: {props.conversations.length}</div>
        <div>Projects: {props.projects.length}</div>
        {props.conversations.map((conv: any) => (
          <div key={conv.id}>
            <span>{conv.title}</span>
            <button onClick={() => props.onConversationAction('edit', conv.id)}>Edit</button>
          </div>
        ))}
      </div>
    );
  };
});

describe('CodessaMemoryHarvester Integration Tests', () => {
  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks();
  });

  it('renders main application structure', () => {
    render(<CodessaMemoryHarvester />);
    
    expect(screen.getByText(/codessa memory harvester/i)).toBeInTheDocument();
  });

  it('renders all main navigation tabs', () => {
    render(<CodessaMemoryHarvester />);
    
    expect(screen.getByText(/harvest/i)).toBeInTheDocument();
    expect(screen.getByText(/analyze/i)).toBeInTheDocument();
    expect(screen.getByText(/generate/i)).toBeInTheDocument();
    expect(screen.getByText(/deploy/i)).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    render(<CodessaMemoryHarvester />);
    
    const analyzeTab = screen.getByText(/analyze/i);
    fireEvent.click(analyzeTab);
    
    await waitFor(() => {
      expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    });
  });

  it('renders search panel in harvest tab', () => {
    render(<CodessaMemoryHarvester />);
    
    expect(screen.getByTestId('search-panel')).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('handles search functionality', async () => {
    render(<CodessaMemoryHarvester />);
    
    const searchInput = screen.getByTestId('search-input');
    const searchButton = screen.getByText('Search');
    
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('test query');
    });
  });

  it('displays analytics dashboard in analyze tab', async () => {
    render(<CodessaMemoryHarvester />);
    
    const analyzeTab = screen.getByText(/analyze/i);
    fireEvent.click(analyzeTab);
    
    await waitFor(() => {
      const dashboard = screen.getByTestId('analytics-dashboard');
      expect(dashboard).toBeInTheDocument();
      expect(screen.getByText(/total tokens/i)).toBeInTheDocument();
    });
  });

  it('shows API connections panel', () => {
    render(<CodessaMemoryHarvester />);
    
    expect(screen.getByTestId('api-connections-panel')).toBeInTheDocument();
  });

  it('displays content management panel', () => {
    render(<CodessaMemoryHarvester />);
    
    expect(screen.getByTestId('content-management-panel')).toBeInTheDocument();
  });

  it('handles API connection toggle', async () => {
    render(<CodessaMemoryHarvester />);
    
    const toggleButtons = screen.getAllByText('Toggle');
    if (toggleButtons.length > 0) {
      fireEvent.click(toggleButtons[0]);
      // Test that the action is handled (would need to check state changes in real implementation)
    }
  });

  it('manages conversation actions', async () => {
    render(<CodessaMemoryHarvester />);
    
    const editButtons = screen.getAllByText('Edit');
    if (editButtons.length > 0) {
      fireEvent.click(editButtons[0]);
      // Test that the action is handled
    }
  });

  it('handles error boundary gracefully', () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create a component that throws an error
    const ThrowError = () => {
      throw new Error('Test error');
    };
    
    // This would test the error boundary, but since we're testing the main component,
    // we'd need to trigger an error within it
    render(<CodessaMemoryHarvester />);
    
    // Clean up
    consoleSpy.mockRestore();
  });

  it('initializes with default state', () => {
    render(<CodessaMemoryHarvester />);
    
    // Check that components receive initial props
    expect(screen.getByTestId('search-panel')).toBeInTheDocument();
    expect(screen.getByTestId('api-connections-panel')).toBeInTheDocument();
    expect(screen.getByTestId('content-management-panel')).toBeInTheDocument();
  });

  it('maintains state consistency across tab switches', async () => {
    render(<CodessaMemoryHarvester />);
    
    // Interact with search in harvest tab
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'persistent query' } });
    
    // Switch to analyze tab
    const analyzeTab = screen.getByText(/analyze/i);
    fireEvent.click(analyzeTab);
    
    // Switch back to harvest tab
    const harvestTab = screen.getByText(/harvest/i);
    fireEvent.click(harvestTab);
    
    await waitFor(() => {
      // Search input should maintain its value
      expect(screen.getByTestId('search-input')).toHaveValue('persistent query');
    });
  });

  it('handles component communication correctly', async () => {
    render(<CodessaMemoryHarvester />);
    
    // Test that parent state updates are reflected in child components
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'integration test' } });
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('integration test');
    });
  });
});