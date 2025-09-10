// TypeScript interfaces for Codessa Memory Harvester

export interface Conversation {
  id: string;
  title: string;
  description: string;
  content: string;
  messages?: Message[];
  date: string;
  createdAt: string;
  tags?: string[];
  source: string;
  fragments?: number;
  priority?: 'high' | 'medium' | 'low';
  status?: string;
  isShared?: boolean;
  isCollaborative?: boolean;
  completion?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  content: string;
  fragments: number;
  conversationSources?: string[];
  tags?: string[];
  completion: number;
  priority?: 'high' | 'medium' | 'low';
  status?: string;
  date?: string;
  createdAt: string;
  insights?: Insight[];
  metadata: ProjectMetadata;
  isShared?: boolean;
  isCollaborative?: boolean;
}

export interface ProjectMetadata {
  estimatedValue: string;
  marketFit: number;
  technicalRisk: 'low' | 'medium' | 'high';
  timeToMarket: string;
  resourceRequirements: string[];
  dependencies: string[];
}

export interface Insight {
  id: string;
  title: string;
  content: string;
  type: 'pattern' | 'trend' | 'anomaly' | 'recommendation';
  confidence: number;
  timestamp: string;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'deployed' | 'training';
  capabilities: string[];
  deploymentMetrics: DeploymentMetrics;
  lastActivity: string;
  performance: AgentPerformance;
}

export interface DeploymentMetrics {
  uptime: string;
  requestsHandled: number;
  averageResponseTime: string;
  errorRate: string;
}

export interface AgentPerformance {
  accuracy: number;
  efficiency: number;
  userSatisfaction: number;
}

export interface APIConnection {
  status: 'connected' | 'disconnected' | 'error';
  model: string;
  lastSync?: string;
  endpoint?: string;
  rateLimits?: RateLimit;
}

export interface RateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
  remaining: number;
}

export interface LiveStream {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error';
  source: string;
  messagesProcessed: number;
  lastMessage: string;
}

export interface SharedLink {
  id: string;
  title: string;
  platform: 'ChatGPT' | 'Claude' | 'Gemini' | 'Other';
  url: string;
  extractedFragments: number;
  addedDate: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface SearchFilters {
  dateRange: 'all' | 'week' | 'month' | 'quarter';
  contentType: 'all' | 'conversations' | 'projects' | 'insights';
  source: 'all' | 'claude' | 'gpt' | 'gemini' | 'local';
  tags: string[];
  minFragments: number;
  priority: 'all' | 'high' | 'medium' | 'low';
  collaboration: 'all' | 'shared' | 'private' | 'collaborative';
  status: 'all' | 'active' | 'completed' | 'pending';
  sortBy: 'date' | 'date-asc' | 'fragments' | 'priority' | 'alphabetical';
}

export interface RealTimeAnalytics {
  activeConversations: number;
  knowledgeFragments: number;
  aiInteractions: number;
  processingQueue: number;
  totalTokens: number;
  projectsGenerated: number;
  agentsDeployed: number;
  activeConnections: number;
}

export interface KnowledgeGraphData {
  nodes: number;
  edges: number;
  clusters: number;
  centrality: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'project' | 'agent' | 'conversation' | 'insight';
  size: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  weight?: number;
  type?: 'dependency' | 'similarity' | 'reference' | 'collaboration';
}

export interface ErrorInfo {
  id: string;
  message: string;
  timestamp: string;
  context?: string;
  stack?: string;
}

// Component Props Interfaces
export interface SearchPanelProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: (Conversation | Project)[];
  searchFilters: SearchFilters;
  setSearchFilters: (filters: SearchFilters) => void;
  showAdvancedSearch: boolean;
  setShowAdvancedSearch: (show: boolean) => void;
  isSearching: boolean;
  performSearch: () => void;
  exportSearchResults: () => void;
  conversations: Conversation[];
  projects: Project[];
}

export interface AnalyticsDashboardProps {
  realTimeAnalytics: RealTimeAnalytics;
  knowledgeGraphData: KnowledgeGraphData;
}

export interface APIConnectionsPanelProps {
  apiConnections: Record<string, APIConnection>;
  liveStreams: LiveStream[];
}

export interface ContentManagementPanelProps {
  conversations: Conversation[];
  projects: Project[];
  sharedLinks: SharedLink[];
}