import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import APIConnectionsPanel from '../APIConnectionsPanel';
import { APIConnection } from '../../types';

const mockApiConnections: Record<string, APIConnection> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    status: 'connected',
    model: 'gpt-4',
    lastSync: '2025-01-25T10:30:00Z',
    platform: 'openai'
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    status: 'connected',
    model: 'claude-3.5-sonnet',
    lastSync: '2025-01-25T10:25:00Z',
    platform: 'claude'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    status: 'disconnected',
    model: 'gemini-1.5-pro',
    lastSync: null,
    platform: 'gemini'
  }
};

const mockLiveStreams = [
  {
    id: '1',
    name: 'Development Stream',
    status: 'active',
    platform: 'openai',
    lastActivity: '2025-01-25T10:30:00Z'
  },
  {
    id: '2',
    name: 'Testing Stream',
    status: 'paused',
    platform: 'claude',
    lastActivity: '2025-01-25T09:15:00Z'
  }
];

const mockProps = {
  apiConnections: mockApiConnections,
  liveStreams: mockLiveStreams,
  onRefreshConnections: jest.fn(),
  onConfigureConnection: jest.fn(),
  onToggleConnection: jest.fn()
};

describe('APIConnectionsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders panel title correctly', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    expect(screen.getByText('API Connections & Live Streams')).toBeInTheDocument();
  });

  it('displays all API connections', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
  });

  it('shows connection status correctly', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    const connectedElements = screen.getAllByText('Connected');
    expect(connectedElements).toHaveLength(2); // OpenAI and Claude
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument(); // Gemini
  });

  it('displays model information', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
    expect(screen.getByText('claude-3.5-sonnet')).toBeInTheDocument();
    expect(screen.getByText('gemini-1.5-pro')).toBeInTheDocument();
  });

  it('shows last sync times for connected services', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    expect(screen.getByText(/10:30/)).toBeInTheDocument();
    expect(screen.getByText(/10:25/)).toBeInTheDocument();
  });

  it('calls onRefreshConnections when refresh button is clicked', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    
    expect(mockProps.onRefreshConnections).toHaveBeenCalled();
  });

  it('calls onConfigureConnection when configure button is clicked', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    const configureButtons = screen.getAllByRole('button', { name: /configure/i });
    fireEvent.click(configureButtons[0]);
    
    expect(mockProps.onConfigureConnection).toHaveBeenCalledWith('openai');
  });

  it('calls onToggleConnection when toggle button is clicked', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    const toggleButtons = screen.getAllByRole('button', { name: /toggle/i });
    fireEvent.click(toggleButtons[0]);
    
    expect(mockProps.onToggleConnection).toHaveBeenCalledWith('openai');
  });

  it('displays live streams section', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    expect(screen.getByText('Live API Connections')).toBeInTheDocument();
  });

  it('shows live stream information', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    expect(screen.getByText('Development Stream')).toBeInTheDocument();
    expect(screen.getByText('Testing Stream')).toBeInTheDocument();
  });

  it('displays stream status correctly', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('shows connection summary', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    expect(screen.getByText(/2.*connected/i)).toBeInTheDocument();
    expect(screen.getByText(/1.*disconnected/i)).toBeInTheDocument();
  });

  it('handles empty connections gracefully', () => {
    const emptyProps = {
      ...mockProps,
      apiConnections: {},
      liveStreams: []
    };
    
    render(<APIConnectionsPanel {...emptyProps} />);
    
    expect(screen.getByText('API Connections & Live Streams')).toBeInTheDocument();
  });

  it('displays correct status indicators', () => {
    render(<APIConnectionsPanel {...mockProps} />);
    
    // Check for status indicator elements (assuming they use specific classes or data attributes)
    const statusElements = screen.getAllByText(/connected|disconnected/i);
    expect(statusElements.length).toBeGreaterThan(0);
  });
});