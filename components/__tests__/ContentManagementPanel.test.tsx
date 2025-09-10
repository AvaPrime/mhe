import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContentManagementPanel from '../ContentManagementPanel';
import { Conversation, Project } from '../../types';

const mockConversations: Conversation[] = [
  {
    id: '1',
    title: 'AI Development Discussion',
    messages: [],
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-01-25T10:30:00Z',
    platform: 'openai',
    status: 'active',
    tags: ['ai', 'development'],
    priority: 'high',
    fragmentCount: 15
  },
  {
    id: '2',
    title: 'Testing Strategies',
    messages: [],
    createdAt: '2025-01-22T14:00:00Z',
    updatedAt: '2025-01-24T16:45:00Z',
    platform: 'claude',
    status: 'completed',
    tags: ['testing', 'qa'],
    priority: 'medium',
    fragmentCount: 8
  }
];

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Memory Harvester Engine',
    description: 'AI-powered conversation analysis tool',
    status: 'active',
    priority: 'high',
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-25T10:30:00Z',
    tags: ['ai', 'nlp'],
    progress: 75
  },
  {
    id: '2',
    name: 'Component Testing Suite',
    description: 'Comprehensive testing framework',
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-01-25T09:15:00Z',
    tags: ['testing', 'react'],
    progress: 45
  }
];

const mockFilters = {
  includeUser: true,
  includeAssistant: true,
  platform: 'all',
  dateRange: 'all'
};

const mockProps = {
  conversations: mockConversations,
  projects: mockProjects,
  conversationFilters: mockFilters,
  onFiltersChange: jest.fn(),
  onConversationAction: jest.fn(),
  onProjectAction: jest.fn()
};

describe('ContentManagementPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders panel title correctly', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('Content Management')).toBeInTheDocument();
  });

  it('displays conversations section', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });

  it('shows all conversations', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('AI Development Discussion')).toBeInTheDocument();
    expect(screen.getByText('Testing Strategies')).toBeInTheDocument();
  });

  it('displays conversation metadata', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('15 fragments')).toBeInTheDocument();
    expect(screen.getByText('8 fragments')).toBeInTheDocument();
  });

  it('shows conversation status', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('displays priority indicators', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('shows projects section', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('displays all projects', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('Memory Harvester Engine')).toBeInTheDocument();
    expect(screen.getByText('Component Testing Suite')).toBeInTheDocument();
  });

  it('shows project descriptions', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('AI-powered conversation analysis tool')).toBeInTheDocument();
    expect(screen.getByText('Comprehensive testing framework')).toBeInTheDocument();
  });

  it('displays project progress', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('shows filter controls', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText(/include user/i)).toBeInTheDocument();
    expect(screen.getByText(/include assistant/i)).toBeInTheDocument();
  });

  it('calls onFiltersChange when filter is modified', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    const platformSelect = screen.getByDisplayValue('all');
    fireEvent.change(platformSelect, { target: { value: 'openai' } });
    
    expect(mockProps.onFiltersChange).toHaveBeenCalled();
  });

  it('calls onConversationAction when conversation action is triggered', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    const actionButtons = screen.getAllByRole('button', { name: /edit|delete|view/i });
    if (actionButtons.length > 0) {
      fireEvent.click(actionButtons[0]);
      expect(mockProps.onConversationAction).toHaveBeenCalled();
    }
  });

  it('calls onProjectAction when project action is triggered', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    const projectActionButtons = screen.getAllByRole('button', { name: /manage|edit|delete/i });
    if (projectActionButtons.length > 0) {
      fireEvent.click(projectActionButtons[0]);
      expect(mockProps.onProjectAction).toHaveBeenCalled();
    }
  });

  it('displays conversation tags', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('ai')).toBeInTheDocument();
    expect(screen.getByText('development')).toBeInTheDocument();
    expect(screen.getByText('testing')).toBeInTheDocument();
    expect(screen.getByText('qa')).toBeInTheDocument();
  });

  it('shows project tags', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('nlp')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
  });

  it('handles empty conversations list', () => {
    const emptyProps = {
      ...mockProps,
      conversations: [],
      projects: mockProjects
    };
    
    render(<ContentManagementPanel {...emptyProps} />);
    
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });

  it('handles empty projects list', () => {
    const emptyProps = {
      ...mockProps,
      conversations: mockConversations,
      projects: []
    };
    
    render(<ContentManagementPanel {...emptyProps} />);
    
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('displays platform information', () => {
    render(<ContentManagementPanel {...mockProps} />);
    
    expect(screen.getByText('openai')).toBeInTheDocument();
    expect(screen.getByText('claude')).toBeInTheDocument();
  });
});