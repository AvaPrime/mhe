import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Brain, Network, Target, Bot, FileText, Search, Download, Plus, Trash2, Edit3, GitBranch, Zap, Database, Settings, Link, Eye, EyeOff, Filter, Tag, Globe, Key, Wifi, WifiOff, Play, Pause, RefreshCw, Calendar, TrendingUp, Code, MessageSquare, Users, Sparkles, Clock, CheckCircle } from 'lucide-react';

const CodessaMemoryHarvester = () => {
  const [conversations, setConversations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [knowledgeGraph, setKnowledgeGraph] = useState({ nodes: [], edges: [] });
  const [activeTab, setActiveTab] = useState('harvest');
  const [processingStatus, setProcessingStatus] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [apiConnections, setApiConnections] = useState({});
  const [liveStreams, setLiveStreams] = useState([]);
  const [conversationFilters, setConversationFilters] = useState({
    includeUser: true,
    includeAssistant: true,
    platform: 'all',
    dateRange: 'all'
  });

  // Enhanced state for new features
  const [sharedLinks, setSharedLinks] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [autoTags, setAutoTags] = useState([]);
  const [realTimeAnalytics, setRealTimeAnalytics] = useState({
    totalTokens: 0,
    activeConnections: 0,
    projectsGenerated: 0,
    agentsDeployed: 0
  });

  // Sample enhanced data initialization
  useEffect(() => {
    // Initialize API connections
    setApiConnections({
      openai: { status: 'connected', model: 'gpt-4', lastSync: '2025-08-25T10:30:00Z' },
      claude: { status: 'connected', model: 'claude-3.5-sonnet', lastSync: '2025-08-25T10:25:00Z' },
      gemini: { status: 'disconnected', model: 'gemini-1.5-pro', lastSync: null },
      ollama: { status: 'connected', model: 'llama3.1:70b', lastSync: '2025-08-25T10:20:00Z' },
      openrouter: { status: 'connected', model: 'anthropic/claude-3-opus', lastSync: '2025-08-25T10:35:00Z' }
    });

    // Enhanced projects with metadata
    setProjects([
      {
        id: 'codessa-memory-api',
        title: 'Codessa Memory Harvesting API',
        completion: 70,
        synergy: 9.5,
        autonomyPotential: 9.0,
        priority: 9.3,
        tags: ['core-infrastructure', 'memory', 'api'],
        fragments: 15,
        lastUpdated: '2025-07-27',
        status: 'active',
        description: 'Multi-agent architecture for capturing, indexing, and activating conversations and ideation.',
        dependencies: ['nlp-processing', 'graph-database'],
        outputs: ['memory_index', 'project_specs', 'agent_blueprints'],
        metadata: {
          estimatedValue: '$50K-$200K',
          marketFit: 8.5,
          technicalRisk: 3,
          timeToMarket: '3-6 months',
          stakeholders: ['developers', 'researchers', 'agencies']
        },
        conversationSources: ['claude-conv-001', 'gpt-conv-042', 'gemini-conv-018'],
        keyInsights: ['Multi-platform integration critical', 'NLP quality determines success', 'Agent orchestration is key differentiator']
      },
      {
        id: 'field-service-app',
        title: 'Field Service Documentation App',
        completion: 40,
        synergy: 7.0,
        autonomyPotential: 6.5,
        priority: 7.0,
        tags: ['mobile', 'documentation', 'media'],
        fragments: 7,
        lastUpdated: '2025-07-26',
        status: 'developing',
        description: 'Mobile app for field service teams to capture and process documentation through AI.',
        dependencies: ['media-processing', 'ocr-engine'],
        outputs: ['structured_reports', 'action_items'],
        metadata: {
          estimatedValue: '$25K-$100K',
          marketFit: 7.2,
          technicalRisk: 4,
          timeToMarket: '6-12 months',
          stakeholders: ['field-technicians', 'operations-managers']
        },
        conversationSources: ['claude-conv-023', 'gpt-conv-089'],
        keyInsights: ['Mobile-first critical', 'Offline capability needed', 'Integration with existing workflows']
      }
    ]);

    // Enhanced agents with deployment metrics
    setAgents([
      {
        id: 'memory-harvest-agent',
        name: 'Memory Harvest Agent',
        type: 'service_agent',
        status: 'active',
        capabilities: ['parse_conversations', 'extract_entities', 'write_specs'],
        triggers: ['new_conversation_uploaded', 'user_tag: #idea'],
        outputs: ['memory_index', 'draft_documents'],
        projectId: 'codessa-memory-api',
        metrics: {
          processedConversations: 1247,
          projectsGenerated: 23,
          avgProcessingTime: '2.3s',
          accuracy: 92.5,
          uptime: '99.7%'
        },
        deployment: {
          environment: 'production',
          instances: 3,
          lastDeployment: '2025-08-20T14:30:00Z',
          version: '1.2.3'
        }
      },
      {
        id: 'media-to-docs-agent',
        name: 'Media to Docs Agent',
        type: 'processing_agent',
        status: 'staging',
        capabilities: ['process_images', 'extract_text', 'generate_reports'],
        triggers: ['media_upload', 'field_report_request'],
        outputs: ['structured_reports', 'action_items'],
        projectId: 'field-service-app',
        metrics: {
          processedItems: 456,
          projectsGenerated: 5,
          avgProcessingTime: '8.7s',
          accuracy: 87.2,
          uptime: '98.1%'
        },
        deployment: {
          environment: 'staging',
          instances: 1,
          lastDeployment: '2025-08-22T09:15:00Z',
          version: '0.8.2'
        }
      }
    ]);

    // Sample shared links and live streams
    setSharedLinks([
      {
        id: 'link-001',
        url: 'https://chat.openai.com/share/8a2f9c1d-3b4e-5f6g-7h8i-9j0k1l2m3n4o',
        platform: 'ChatGPT',
        title: 'AI-Powered Documentation System Discussion',
        addedDate: '2025-08-25T08:30:00Z',
        status: 'processing',
        extractedFragments: 3
      },
      {
        id: 'link-002', 
        url: 'https://claude.ai/chat/abc123def456ghi789',
        platform: 'Claude',
        title: 'Strategic Planning for Tech Startup',
        addedDate: '2025-08-24T16:45:00Z',
        status: 'completed',
        extractedFragments: 7
      }
    ]);

    setLiveStreams([
      {
        id: 'stream-openai',
        platform: 'OpenAI',
        status: 'active',
        conversationsToday: 23,
        tokensProcessed: 45620,
        projectsGenerated: 4
      },
      {
        id: 'stream-claude',
        platform: 'Claude',
        status: 'active',
        conversationsToday: 18,
        tokensProcessed: 38950,
        projectsGenerated: 6
      }
    ]);

    // Auto-generated tags from conversations
    setAutoTags([
      'infrastructure', 'mobile-app', 'api-design', 'machine-learning', 
      'documentation', 'automation', 'analytics', 'user-experience',
      'data-processing', 'integration', 'scalability', 'security'
    ]);
  }, []);

  const renderEnhancedHarvesting = () => (
    <div className="space-y-6">
      {/* API Connections Panel */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-lg border border-emerald-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-emerald-600" />
          Live API Connections
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(apiConnections).map(([platform, config]) => (
            <div key={platform} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium capitalize">{platform}</h4>
                {config.status === 'connected' ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Model:</span>
                  <span className="font-mono">{config.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={`px-1 rounded ${
                    config.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {config.status}
                  </span>
                </div>
                {config.lastSync && (
                  <div className="text-gray-400 text-xs">
                    Last: {new Date(config.lastSync).toLocaleTimeString()}
                  </div>
                )}
              </div>
              
              <button className="w-full mt-3 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs rounded flex items-center justify-center gap-1">
                <Key className="w-3 h-3" />
                Configure
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Shared Links Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Link className="w-5 h-5 text-blue-600" />
          Shared Conversation Links
        </h3>
        
        <div className="flex gap-4 mb-4">
          <input
            type="url"
            placeholder="Paste conversation share link (ChatGPT, Claude, etc.)"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Link
          </button>
        </div>
        
        <div className="space-y-2">
          {sharedLinks.map(link => (
            <div key={link.id} className="flex items-center justify-between p-3 bg-white rounded border">
              <div className="flex-1">
                <div className="font-medium text-sm">{link.title}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      link.platform === 'ChatGPT' ? 'bg-green-500' : 'bg-orange-500'
                    }`}></div>
                    {link.platform}
                  </span>
                  <span>{link.extractedFragments} fragments</span>
                  <span>{new Date(link.addedDate).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-xs ${
                  link.status === 'completed' ? 'bg-green-100 text-green-700' :
                  link.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {link.status}
                </div>
                <button className="p-1 hover:bg-gray-100 rounded">
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Streaming Panel */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-600" />
          Live Conversation Streams
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {liveStreams.map(stream => (
            <div key={stream.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">{stream.platform}</h4>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    stream.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-xs text-gray-500">{stream.status}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-lg font-bold text-blue-600">{stream.conversationsToday}</div>
                  <div className="text-xs text-gray-500">Convos Today</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-lg font-bold text-green-600">{stream.tokensProcessed.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Tokens</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-lg font-bold text-purple-600">{stream.projectsGenerated}</div>
                  <div className="text-xs text-gray-500">Projects</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Processing Options Panel */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Processing Configuration
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-medium mb-3">Content Filtering</h5>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={conversationFilters.includeUser}
                  onChange={(e) => setConversationFilters(prev => ({...prev, includeUser: e.target.checked}))}
                  className="rounded"
                />
                <span className="text-sm">Include User Messages</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={conversationFilters.includeAssistant}
                  onChange={(e) => setConversationFilters(prev => ({...prev, includeAssistant: e.target.checked}))}
                  className="rounded"
                />
                <span className="text-sm">Include Assistant Messages</span>
              </label>
            </div>
          </div>
          
          <div>
            <h5 className="font-medium mb-3">Auto-Metadata Injection</h5>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Extract Business Value Estimates</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Identify Technical Dependencies</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Generate Market Analysis</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Auto-Tag with Industry Keywords</span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t">
          <h5 className="font-medium mb-3">Generated Tags</h5>
          <div className="flex flex-wrap gap-2">
            {autoTags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Traditional File Upload (Enhanced) */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Manual File Upload
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 mb-2">ChatGPT Export</p>
            <input type="file" accept=".zip,.json" className="text-xs" multiple />
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition-colors">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 mb-2">Claude/Gemini</p>
            <input type="file" accept=".txt,.md,.json" className="text-xs" multiple />
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-green-400 transition-colors">
            <Database className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 mb-2">Bulk Import</p>
            <input type="file" accept=".csv,.xlsx" className="text-xs" multiple />
          </div>
        </div>
      </div>
    </div>
  );

  const renderEnhancedProjects = () => (
    <div className="space-y-6">
      {/* Real-time Analytics Dashboard */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Real-time Project Analytics
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{realTimeAnalytics.totalTokens.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Tokens</div>
            <div className="text-xs text-green-600 flex items-center justify-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" />
              +12% today
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{realTimeAnalytics.projectsGenerated}</div>
            <div className="text-sm text-gray-500">Projects Generated</div>
            <div className="text-xs text-blue-600 flex items-center justify-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              3 this hour
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{realTimeAnalytics.agentsDeployed}</div>
            <div className="text-sm text-gray-500">Agents Deployed</div>
            <div className="text-xs text-purple-600 flex items-center justify-center gap-1 mt-1">
              <CheckCircle className="w-3 h-3" />
              All active
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{realTimeAnalytics.activeConnections}</div>
            <div className="text-sm text-gray-500">Live Connections</div>
            <div className="text-xs text-green-600 flex items-center justify-center gap-1 mt-1">
              <Wifi className="w-3 h-3" />
              99.9% uptime
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Project Matrix */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-green-600" />
          Enhanced Project Prioritization Matrix
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Project</th>
                <th className="text-center p-2">Completion</th>
                <th className="text-center p-2">Market Value</th>
                <th className="text-center p-2">Tech Risk</th>
                <th className="text-center p-2">Time to Market</th>
                <th className="text-center p-2">Priority</th>
                <th className="text-center p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <div className="font-medium">{project.title}</div>
                    <div className="text-xs text-gray-500">
                      {project.fragments} fragments • {project?.conversationSources?.length || 0} sources
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(project.tags || []).slice(0, 2).map(tag => (
                        <span key={tag} className="px-1 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-center p-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${project.completion}%` }}
                      ></div>
                    </div>
                    <div className="text-xs mt-1">{project.completion}%</div>
                  </td>
                  <td className="text-center p-2">
                    <div className="font-medium text-green-600">{project.metadata.estimatedValue}</div>
                    <div className="text-xs text-gray-500">Fit: {project.metadata.marketFit}/10</div>
                  </td>
                  <td className="text-center p-2">
                    <div className={`inline-block px-2 py-1 rounded text-xs ${
                      project.metadata.technicalRisk <= 3 ? 'bg-green-100 text-green-800' :
                      project.metadata.technicalRisk <= 6 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {project.metadata.technicalRisk}/10
                    </div>
                  </td>
                  <td className="text-center p-2">
                    <div className="text-xs">{project.metadata.timeToMarket}</div>
                  </td>
                  <td className="text-center p-2">
                    <div className="font-bold text-lg">{project.priority}</div>
                  </td>
                  <td className="text-center p-2">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setSelectedProject(project)}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                      >
                        View
                      </button>
                      <button className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">
                        Deploy
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enhanced Project Details */}
      {selectedProject && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">{selectedProject.title}</h4>
            <button 
              onClick={() => setSelectedProject(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <h5 className="font-medium mb-2">Description & Key Insights</h5>
              <p className="text-sm text-gray-600 mb-4">{selectedProject.description}</p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <h6 className="font-medium text-yellow-800 mb-2">Key Insights from Conversations</h6>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {selectedProject.keyInsights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
              
              <h5 className="font-medium mb-2">Conversation Sources</h5>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedProject.conversationSources.map(source => (
                  <span key={source} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-mono">
                    {source}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <h5 className="font-medium mb-2">Market Analysis</h5>
              <div className="bg-gray-50 rounded p-3 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Value:</span>
                    <span className="font-medium text-green-600">{selectedProject.metadata.estimatedValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Market Fit:</span>
                    <span className="font-medium">{selectedProject.metadata.marketFit}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tech Risk:</span>
                    <span className="font-medium">{selectedProject.metadata.technicalRisk}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time to Market:</span>
                    <span className="font-medium">{selectedProject.metadata.timeToMarket}</span>
                  </div>
                </div>
              </div>
              
              <h5 className="font-medium mb-2">Stakeholders</h5>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedProject.metadata.stakeholders.map(stakeholder => (
                  <span key={stakeholder} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {stakeholder}
                  </span>
                ))}
              </div>
              
              <h5 className="font-medium mb-2">Dependencies</h5>
              <ul className="text-sm text-gray-600 mb-4">
                {selectedProject.dependencies.map(dep => (
                  <li key={dep} className="flex items-center gap-2">
                    <GitBranch className="w-3 h-3" />
                    {dep}
                  </li>
                ))}
              </ul>
              
              <h5 className="font-medium mb-2">Expected Outputs</h5>
              <ul className="text-sm text-gray-600">
                {selectedProject.outputs.map(output => (
                  <li key={output} className="flex items-center gap-2">
                    <Zap className="w-3 h-3" />
                    {output}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t flex gap-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
              <Code className="w-4 h-4" />
              Generate Code Spec
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Deploy Agent
            </button>
            <button className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Create Repository
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderEnhancedAgents = () => (
    <div className="space-y-6">
      {/* Agent Performance Dashboard */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-6 rounded-lg border border-violet-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-600" />
          Agent Performance Dashboard
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">1,703</div>
            <div className="text-sm text-gray-500">Total Executions</div>
            <div className="text-xs text-green-600">+47 today</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">94.2%</div>
            <div className="text-sm text-gray-500">Avg Success Rate</div>
            <div className="text-xs text-blue-600">↑ 2.1% this week</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">3.4s</div>
            <div className="text-sm text-gray-500">Avg Response Time</div>
            <div className="text-xs text-orange-600">↓ 0.8s optimized</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">99.1%</div>
            <div className="text-sm text-gray-500">System Uptime</div>
            <div className="text-xs text-green-600">SLA compliant</div>
          </div>
        </div>
      </div>

      {/* Enhanced Agent Garden */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 rounded-lg border border-cyan-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-600" />
            Autonomous Agent Garden
          </h3>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-cyan-100 text-cyan-700 text-sm rounded hover:bg-cyan-200">
              Auto-Scale
            </button>
            <button className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded hover:bg-purple-200">
              Deploy All
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium text-lg">{agent.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">{agent.type}</span>
                    <div className={`px-2 py-0.5 rounded text-xs ${
                      agent.status === 'active' ? 'bg-green-100 text-green-800' :
                      agent.status === 'staging' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {agent.status}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">v{agent.deployment.version}</div>
                  <div className="text-xs text-gray-400">{agent.deployment.instances} instances</div>
                </div>
              </div>
              
              {/* Performance Metrics */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center bg-gray-50 rounded p-2">
                  <div className="text-sm font-bold text-blue-600">{agent.metrics.processedConversations.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Processed</div>
                </div>
                <div className="text-center bg-gray-50 rounded p-2">
                  <div className="text-sm font-bold text-green-600">{agent.metrics.projectsGenerated}</div>
                  <div className="text-xs text-gray-500">Generated</div>
                </div>
                <div className="text-center bg-gray-50 rounded p-2">
                  <div className="text-sm font-bold text-purple-600">{agent.metrics.avgProcessingTime}</div>
                  <div className="text-xs text-gray-500">Avg Time</div>
                </div>
                <div className="text-center bg-gray-50 rounded p-2">
                  <div className="text-sm font-bold text-orange-600">{agent.metrics.accuracy}%</div>
                  <div className="text-xs text-gray-500">Accuracy</div>
                </div>
              </div>
              
              {/* Capabilities & Triggers */}
              <div className="space-y-3">
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Capabilities</h5>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map(cap => (
                      <span key={cap} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                        {cap.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Active Triggers</h5>
                  <div className="space-y-1">
                    {agent.triggers.map(trigger => (
                      <div key={trigger} className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        {trigger}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Agent Controls */}
              <div className="mt-4 pt-3 border-t flex gap-2">
                <button className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 flex items-center justify-center gap-1">
                  {agent.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {agent.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200">
                  <Settings className="w-4 h-4" />
                </button>
                <button className="px-3 py-2 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              {/* Deployment Info */}
              <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Environment: {agent.deployment.environment}</span>
                  <span>Uptime: {agent.metrics.uptime}</span>
                </div>
                <div className="mt-1">
                  Last deployed: {new Date(agent.deployment.lastDeployment).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700">
            <Plus className="w-4 h-4" />
            Create Custom Agent
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700">
            <Zap className="w-4 h-4" />
            Auto-Generate from Project
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700">
            <Network className="w-4 h-4" />
            Deploy Agent Swarm
          </button>
        </div>
      </div>

      {/* Agent Templates & Marketplace */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Code className="w-5 h-5" />
          Agent Templates & Marketplace
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'Documentation Generator',
              description: 'Converts conversations into structured docs',
              deployments: 1240,
              rating: 4.8,
              category: 'productivity'
            },
            {
              name: 'Code Review Agent',
              description: 'Automated code analysis and suggestions',
              deployments: 856,
              rating: 4.6,
              category: 'development'
            },
            {
              name: 'Market Research Bot',
              description: 'Generates market analysis from conversations',
              deployments: 623,
              rating: 4.9,
              category: 'business'
            }
          ].map((template, idx) => (
            <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
              <h5 className="font-medium mb-2">{template.name}</h5>
              <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>{template.deployments.toLocaleString()} deployments</span>
                <div className="flex items-center gap-1">
                  <span>⭐ {template.rating}</span>
                </div>
              </div>
              
              <button className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                Deploy Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAdvancedSystem = () => (
    <div className="space-y-6">
      {/* Advanced Export & Integration */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600" />
          Advanced System Configuration
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* API Integration Panel */}
          <div>
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              External Integrations
            </h4>
            
            <div className="space-y-4">
              {[
                { name: 'GitHub', status: 'connected', desc: 'Auto-repo creation' },
                { name: 'Notion', status: 'available', desc: 'Documentation sync' },
                { name: 'Slack', status: 'connected', desc: 'Team notifications' },
                { name: 'Jira', status: 'available', desc: 'Project management' },
                { name: 'AWS Lambda', status: 'connected', desc: 'Agent deployment' },
                { name: 'Vercel', status: 'available', desc: 'App deployment' }
              ].map(integration => (
                <div key={integration.name} className="flex items-center justify-between p-3 bg-white border rounded">
                  <div>
                    <div className="font-medium text-sm">{integration.name}</div>
                    <div className="text-xs text-gray-500">{integration.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      integration.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <button className={`px-2 py-1 text-xs rounded ${
                      integration.status === 'connected' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}>
                      {integration.status === 'connected' ? 'Connected' : 'Connect'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Export Options */}
          <div>
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Advanced Export Options
            </h4>
            
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 group">
                <div className="text-left">
                  <div className="font-medium text-sm">Complete System Package</div>
                  <div className="text-xs text-gray-500">Full repo with CI/CD, Docker, docs</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600">ZIP + Git</span>
                  <Download className="w-4 h-4 group-hover:text-blue-700" />
                </div>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded hover:bg-green-100 group">
                <div className="text-left">
                  <div className="font-medium text-sm">Kubernetes Manifests</div>
                  <div className="text-xs text-gray-500">Ready for cloud deployment</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600">YAML</span>
                  <Download className="w-4 h-4 group-hover:text-green-700" />
                </div>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 group">
                <div className="text-left">
                  <div className="font-medium text-sm">Terraform Infrastructure</div>
                  <div className="text-xs text-gray-500">AWS/GCP infrastructure as code</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-600">TF</span>
                  <Download className="w-4 h-4 group-hover:text-purple-700" />
                </div>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 group">
                <div className="text-left">
                  <div className="font-medium text-sm">Business Intelligence Package</div>
                  <div className="text-xs text-gray-500">Dashboards, reports, analytics</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-600">BI</span>
                  <Download className="w-4 h-4 group-hover:text-orange-700" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Architecture Visualization */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Network className="w-5 h-5" />
          System Architecture Overview
        </h4>
        
        <div className="bg-gray-900 text-green-400 p-6 rounded font-mono text-sm overflow-x-auto mb-4">
          <div className="space-y-1">
            <div className="text-cyan-400">┌─ 🌐 Codessa Memory Harvesting System ─┐</div>
            <div>│</div>
            <div>├─ 📡 <span className="text-yellow-400">API Layer</span></div>
            <div>│  ├─ OpenAI GPT-4 ──────── [Connected]</div>
            <div>│  ├─ Anthropic Claude ───── [Connected]</div>
            <div>│  ├─ Google Gemini ──────── [Available]</div>
            <div>│  ├─ Ollama Local ──────── [Connected]</div>
            <div>│  └─ OpenRouter ─────────── [Connected]</div>
            <div>│</div>
            <div>├─ 🧠 <span className="text-purple-400">Processing Engine</span></div>
            <div>│  ├─ NLP Processor ──────── [Active]</div>
            <div>│  ├─ Entity Extraction ──── [Active]</div>
            <div>│  ├─ Semantic Analysis ───── [Active]</div>
            <div>│  └─ Project Synthesis ──── [Active]</div>
            <div>│</div>
            <div>├─ 🤖 <span className="text-green-400">Agent Garden</span></div>
            <div>│  ├─ Memory Harvest Agent ── [Running: 3 instances]</div>
            <div>│  ├─ Media Processing Agent - [Staging: 1 instance]</div>
            <div>│  ├─ Code Generation Agent ── [Blueprint]</div>
            <div>│  └─ Market Analysis Agent ── [Blueprint]</div>
            <div>│</div>
            <div>├─ 📊 <span className="text-blue-400">Knowledge Graph DB</span></div>
            <div>│  ├─ Neo4j Cluster ────── [3 nodes, 99.9% uptime]</div>
            <div>│  ├─ Vector Database ───── [Pinecone, 2.1M vectors]</div>
            <div>│  └─ Time Series DB ───── [InfluxDB, real-time metrics]</div>
            <div>│</div>
            <div>└─ 🚀 <span className="text-orange-400">Deployment Pipeline</span></div>
            <div>   ├─ GitHub Actions ────── [CI/CD automated]</div>
            <div>   ├─ Kubernetes Cluster ── [AWS EKS, auto-scaling]</div>
            <div>   ├─ Monitoring Stack ──── [Prometheus + Grafana]</div>
            <div>   └─ Security Layer ────── [OAuth2 + API keys]</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-lg font-bold text-green-600">99.9%</div>
            <div className="text-sm text-gray-600">System Uptime</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-lg font-bold text-blue-600">2.1M</div>
            <div className="text-sm text-gray-600">Knowledge Vectors</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded">
            <div className="text-lg font-bold text-purple-600">47</div>
            <div className="text-sm text-gray-600">Active Agents</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded">
            <div className="text-lg font-bold text-orange-600">5ms</div>
            <div className="text-sm text-gray-600">Avg Query Time</div>
          </div>
        </div>
      </div>

      {/* Future Roadmap */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200">
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Development Roadmap & Vision
        </h4>
        
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
            <div>
              <h5 className="font-medium text-green-800">Phase 1: Foundation (Complete)</h5>
              <p className="text-sm text-gray-600">Multi-platform harvesting, basic project extraction, agent blueprints</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 animate-pulse"></div>
            <div>
              <h5 className="font-medium text-blue-800">Phase 2: Intelligence (Current)</h5>
              <p className="text-sm text-gray-600">Advanced NLP, market analysis, automated deployment, live API integration</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mt-2"></div>
            <div>
              <h5 className="font-medium text-yellow-800">Phase 3: Autonomy (Q4 2025)</h5>
              <p className="text-sm text-gray-600">Self-improving agents, autonomous development teams, market-aware prioritization</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="w-3 h-3 bg-purple-500 rounded-full mt-2"></div>
            <div>
              <h5 className="font-medium text-purple-800">Phase 4: Scale (2026)</h5>
              <p className="text-sm text-gray-600">Enterprise deployment, civilization-scale pattern recognition, economic transformation</p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
          <h5 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Ultimate Vision
          </h5>
          <p className="text-sm text-purple-700">
            Transform human creativity into autonomous execution at planetary scale. 
            Bridge imagination and implementation faster than traditional development cycles. 
            Create a self-sustaining innovation engine that amplifies human potential through AI collaboration.
          </p>
        </div>
      </div>
    </div>
  );

  const handleFileUpload = useCallback((event) => {
    const files = event.target.files;
    setProcessingStatus('Processing uploaded conversations...');
    
    setTimeout(() => {
      const newConversations = Array.from(files).map((file, index) => ({
        id: `conv-${Date.now()}-${index}`,
        platform: file.name.includes('chatgpt') ? 'ChatGPT' : 
                  file.name.includes('claude') ? 'Claude' : 'Unknown',
        filename: file.name,
        size: file.size,
        timestamp: new Date().toISOString(),
        status: 'processed',
        extractedProjects: Math.floor(Math.random() * 3) + 1,
        keywordCount: Math.floor(Math.random() * 50) + 10
      }));
      
      setConversations(prev => [...prev, ...newConversations]);
      setProcessingStatus('Processing complete! Found new project fragments.');
    }, 2000);
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
          Codessa Memory Harvesting System v2.0
        </h1>
        <p className="text-gray-600 text-lg">
          Autonomous knowledge extraction, project formalization, and agent architecture evolution
        </p>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            System Online
          </span>
          <span>{Object.values(apiConnections).filter(c => c.status === 'connected').length} API connections active</span>
          <span>{realTimeAnalytics.totalTokens.toLocaleString()} tokens processed</span>
        </div>
      </div>

      {/* Enhanced Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'harvest', label: 'Live Harvesting', icon: Zap, badge: liveStreams.filter(s => s.status === 'active').length },
          { id: 'projects', label: 'Smart Projects', icon: Target, badge: projects.length },
          { id: 'agents', label: 'Agent Garden', icon: Bot, badge: agents.filter(a => a.status === 'active').length },
          { id: 'graph', label: 'Knowledge Graph', icon: Network },
          { id: 'system', label: 'Advanced System', icon: Settings }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-100 border hover:border-blue-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id 
                  ? 'bg-white/20 text-white' 
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Panels */}
      <div className="min-h-96">
        {activeTab === 'harvest' && renderEnhancedHarvesting()}
        {activeTab === 'projects' && renderEnhancedProjects()}
        {activeTab === 'agents' && renderEnhancedAgents()}
        {activeTab === 'graph' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-cyan-50 to-teal-50 p-6 rounded-lg border border-cyan-200">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Network className="w-5 h-5 text-cyan-600" />
                Enhanced Knowledge Graph & Dependencies
              </h3>
              
              <div className="bg-white rounded-lg border p-8 min-h-96 relative">
                <svg className="w-full h-full" viewBox="0 0 800 400">
                  {/* Enhanced edges with different relationship types */}
                  {(knowledgeGraph?.edges || []).map((edge, index) => {
                    const positions = [
                      [150, 100], [400, 80], [650, 120], [200, 200], 
                      [500, 220], [300, 300], [600, 320]
                    ];
                    const fromPos = positions[index] || [100, 100];
                    const toPos = positions[index + 1] || [200, 200];
                    
                    return (
                      <g key={`edge-${index}`}>
                        <line
                          x1={fromPos[0]}
                          y1={fromPos[1]}
                          x2={toPos[0]}
                          y2={toPos[1]}
                          stroke="#94a3b8"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead)"
                          className="hover:stroke-blue-500 cursor-pointer"
                        />
                        <text
                          x={(fromPos[0] + toPos[0]) / 2}
                          y={(fromPos[1] + toPos[1]) / 2 - 8}
                          textAnchor="middle"
                          className="text-xs fill-gray-600 font-medium"
                        >
                          {edge.label || 'related'}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Arrow marker */}
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                    </marker>
                  </defs>
                  
                  {/* Enhanced nodes with better positioning */}
                  {knowledgeGraph.nodes.map((node, index) => {
                    const positions = [
                      [150, 100], [400, 80], [650, 120], [200, 200], 
                      [500, 220], [300, 300], [600, 320]
                    ];
                    const [x, y] = positions[index] || [100 + index * 100, 150];
                    const color = node.type === 'project' ? '#3b82f6' :
                                 node.type === 'agent' ? '#8b5cf6' : '#10b981';
                    
                    return (
                      <g key={node.id} className="cursor-pointer hover:opacity-80">
                        <circle
                          cx={x}
                          cy={y}
                          r={node.size}
                          fill={color}
                          fillOpacity="0.15"
                          stroke={color}
                          strokeWidth="3"
                          className="hover:fillOpacity-0.3"
                        />
                        <text
                          x={x}
                          y={y - 5}
                          textAnchor="middle"
                          className="text-xs font-semibold fill-gray-800"
                        >
                          {node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label}
                        </text>
                        <text
                          x={x}
                          y={y + 8}
                          textAnchor="middle"
                          className="text-xs fill-gray-500"
                        >
                          {node.type}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-500"></div>
                    <span>Projects ({knowledgeGraph.nodes.filter(n => n.type === 'project').length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-purple-100 border-2 border-purple-500"></div>
                    <span>Agents ({knowledgeGraph.nodes.filter(n => n.type === 'agent').length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-500"></div>
                    <span>Capabilities ({knowledgeGraph.nodes.filter(n => n.type === 'capability').length})</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-cyan-100 text-cyan-700 text-sm rounded hover:bg-cyan-200">
                    3D View
                  </button>
                  <button className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded hover:bg-purple-200">
                    Export Graph
                  </button>
                </div>
              </div>
            </div>

            {/* Graph Analytics */}
            <div className="bg-white rounded-lg border p-6">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Knowledge Graph Analytics
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">{knowledgeGraph.nodes.length}</div>
                  <div className="text-sm text-gray-600">Total Entities</div>
                  <div className="text-xs text-green-600 mt-1">+5 today</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-600">{knowledgeGraph.edges.length}</div>
                  <div className="text-sm text-gray-600">Relationships</div>
                  <div className="text-xs text-blue-600 mt-1">+12 this week</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <div className="text-2xl font-bold text-purple-600">94.2%</div>
                  <div className="text-sm text-gray-600">Graph Density</div>
                  <div className="text-xs text-purple-600 mt-1">Highly connected</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded">
                  <div className="text-2xl font-bold text-orange-600">7.3s</div>
                  <div className="text-sm text-gray-600">Query Speed</div>
                  <div className="text-xs text-green-600 mt-1">Optimized</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'system' && renderAdvancedSystem()}
      </div>

      {/* Enhanced Status Bar */}
      <div className="mt-8 bg-gradient-to-r from-white via-blue-50 to-purple-50 rounded-lg border-2 border-blue-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-semibold text-green-800">System Operational</span>
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">{conversations.length}</span> conversations • 
              <span className="font-medium mx-1">{projects.length}</span> active projects • 
              <span className="font-medium">{agents.filter(a => a.status === 'active').length}</span> deployed agents
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-500">
              Last sync: {new Date().toLocaleTimeString()}
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">
                Force Sync
              </button>
              <button className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors">
                Deploy All
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs">
          <div className="text-center">
            <div className="text-blue-600 font-semibold">Memory Usage</div>
            <div className="text-gray-600">2.3GB / 10GB</div>
          </div>
          <div className="text-center">
            <div className="text-green-600 font-semibold">Processing Queue</div>
            <div className="text-gray-600">0 items</div>
          </div>
          <div className="text-center">
            <div className="text-purple-600 font-semibold">Agent Deployments</div>
            <div className="text-gray-600">Next: 15 min</div>
          </div>
          <div className="text-center">
            <div className="text-orange-600 font-semibold">API Rate Limits</div>
            <div className="text-gray-600">Healthy</div>
          </div>
          <div className="text-center">
            <div className="text-cyan-600 font-semibold">Graph Updates</div>
            <div className="text-gray-600">Real-time</div>
          </div>
          <div className="text-center">
            <div className="text-pink-600 font-semibold">Cost Today</div>
            <div className="text-gray-600">$12.34</div>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <Sparkles className="w-3 h-3" />
            <span>Powered by advanced AI orchestration • Transforming conversations into autonomous systems</span>
            <Sparkles className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodessaMemoryHarvester;