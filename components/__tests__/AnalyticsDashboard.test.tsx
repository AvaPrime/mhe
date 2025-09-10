import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsDashboard from '../AnalyticsDashboard';

const mockRealTimeAnalytics = {
  totalTokens: 1250000,
  projectsGenerated: 45,
  agentsDeployed: 12,
  activeConnections: 8,
  processingSpeed: 2.3,
  memoryUsage: 68,
  uptime: '99.8%',
  lastUpdate: '2025-01-25T10:30:00Z'
};

const mockKnowledgeGraphData = {
  nodes: [
    { id: '1', label: 'AI Development', type: 'topic', connections: 15, weight: 0.8 },
    { id: '2', label: 'Machine Learning', type: 'topic', connections: 12, weight: 0.7 },
    { id: '3', label: 'React Components', type: 'topic', connections: 8, weight: 0.6 }
  ],
  edges: [
    { source: '1', target: '2', weight: 0.9 },
    { source: '2', target: '3', weight: 0.7 }
  ],
  metrics: {
    totalNodes: 150,
    totalEdges: 320,
    avgConnections: 4.2,
    density: 0.15
  }
};

const mockProps = {
  realTimeAnalytics: mockRealTimeAnalytics,
  knowledgeGraphData: mockKnowledgeGraphData
};

describe('AnalyticsDashboard', () => {
  it('renders dashboard title correctly', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('Real-time Analytics Dashboard')).toBeInTheDocument();
  });

  it('displays all analytics metrics', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('1.25M')).toBeInTheDocument(); // Total tokens
    expect(screen.getByText('45')).toBeInTheDocument(); // Projects generated
    expect(screen.getByText('12')).toBeInTheDocument(); // Agents deployed
    expect(screen.getByText('8')).toBeInTheDocument(); // Active connections
  });

  it('shows processing speed and memory usage', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('2.3 req/s')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument();
  });

  it('displays uptime information', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('99.8%')).toBeInTheDocument();
  });

  it('renders knowledge graph section', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('Knowledge Graph Analytics')).toBeInTheDocument();
  });

  it('displays knowledge graph metrics', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('150')).toBeInTheDocument(); // Total nodes
    expect(screen.getByText('320')).toBeInTheDocument(); // Total edges
    expect(screen.getByText('4.2')).toBeInTheDocument(); // Avg connections
    expect(screen.getByText('15%')).toBeInTheDocument(); // Density
  });

  it('shows top topics from knowledge graph', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('AI Development')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning')).toBeInTheDocument();
    expect(screen.getByText('React Components')).toBeInTheDocument();
  });

  it('displays topic connection counts', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('15 connections')).toBeInTheDocument();
    expect(screen.getByText('12 connections')).toBeInTheDocument();
    expect(screen.getByText('8 connections')).toBeInTheDocument();
  });

  it('renders system metrics section', () => {
    render(<AnalyticsDashboard {...mockProps} />);
    
    expect(screen.getByText('System Metrics')).toBeInTheDocument();
  });

  it('handles missing analytics data gracefully', () => {
    const propsWithMissingData = {
      realTimeAnalytics: {
        ...mockRealTimeAnalytics,
        totalTokens: 0,
        projectsGenerated: 0
      },
      knowledgeGraphData: mockKnowledgeGraphData
    };
    
    render(<AnalyticsDashboard {...propsWithMissingData} />);
    
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('handles empty knowledge graph data', () => {
    const propsWithEmptyGraph = {
      realTimeAnalytics: mockRealTimeAnalytics,
      knowledgeGraphData: {
        nodes: [],
        edges: [],
        metrics: {
          totalNodes: 0,
          totalEdges: 0,
          avgConnections: 0,
          density: 0
        }
      }
    };
    
    render(<AnalyticsDashboard {...propsWithEmptyGraph} />);
    
    expect(screen.getByText('Knowledge Graph Analytics')).toBeInTheDocument();
  });
});