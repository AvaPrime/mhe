import React from 'react';
import { MessageSquare, FileText, Edit3, Trash2, Plus, Tag, Clock, CheckCircle, Users, Sparkles } from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  date: string;
  messages: number;
  tokens: number;
  model: string;
  tags: string[];
  priority?: string;
  status?: string;
  isShared?: boolean;
  isCollaborative?: boolean;
}

interface Project {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  fragments: number;
  completion: number;
  tags: string[];
  priority?: string;
  status?: string;
  isShared?: boolean;
  isCollaborative?: boolean;
}

interface ContentManagementPanelProps {
  conversations: Conversation[];
  projects: Project[];
  selectedProject: string | null;
  setSelectedProject: (id: string | null) => void;
  conversationFilters: {
    model: string;
    dateRange: string;
    minTokens: number;
  };
  setConversationFilters: (filters: any) => void;
  onEditItem: (type: 'conversation' | 'project', id: string) => void;
  onDeleteItem: (type: 'conversation' | 'project', id: string) => void;
  onAddNew: (type: 'conversation' | 'project') => void;
}

export const ContentManagementPanel: React.FC<ContentManagementPanelProps> = ({
  conversations,
  projects,
  selectedProject,
  setSelectedProject,
  conversationFilters,
  setConversationFilters,
  onEditItem,
  onDeleteItem,
  onAddNew
}) => {
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status?: string, completion?: number) => {
    if (completion === 100 || status === 'completed') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (status === 'active' || (completion && completion > 0)) {
      return <Clock className="w-4 h-4 text-blue-500" />;
    }
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Conversations Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Conversations ({conversations.length})
          </h3>
          <button
            onClick={() => onAddNew('conversation')}
            className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        {/* Conversation Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <select
              value={conversationFilters.model}
              onChange={(e) => setConversationFilters({...conversationFilters, model: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Models</option>
              <option value="claude">Claude</option>
              <option value="gpt">GPT</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={conversationFilters.dateRange}
              onChange={(e) => setConversationFilters({...conversationFilters, dateRange: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Tokens</label>
            <input
              type="number"
              value={conversationFilters.minTokens}
              onChange={(e) => setConversationFilters({...conversationFilters, minTokens: parseInt(e.target.value) || 0})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {conversations.map((conversation) => (
            <div key={conversation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">{conversation.title}</h4>
                    {getStatusIcon(conversation.status)}
                    {conversation.isShared && <Users className="w-4 h-4 text-blue-500" title="Shared" />}
                    {conversation.isCollaborative && <Sparkles className="w-4 h-4 text-purple-500" title="Collaborative" />}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span>Messages: {conversation.messages}</span>
                    <span>Tokens: {conversation.tokens.toLocaleString()}</span>
                    <span>Model: {conversation.model}</span>
                    <span>Date: {new Date(conversation.date).toLocaleDateString()}</span>
                  </div>
                  {conversation.tags && conversation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {conversation.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {conversation.priority && (
                    <span className={`inline-block px-2 py-1 text-xs rounded ${getPriorityColor(conversation.priority)}`}>
                      {conversation.priority} priority
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => onEditItem('conversation', conversation.id)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit conversation"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteItem('conversation', conversation.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects Panel */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Projects ({projects.length})
          </h3>
          <button
            onClick={() => onAddNew('project')}
            className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Projects List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {projects.map((project) => (
            <div 
              key={project.id} 
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                selectedProject === project.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
              onClick={() => setSelectedProject(selectedProject === project.id ? null : project.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">{project.title}</h4>
                    {getStatusIcon(project.status, project.completion)}
                    {project.isShared && <Users className="w-4 h-4 text-blue-500" title="Shared" />}
                    {project.isCollaborative && <Sparkles className="w-4 h-4 text-purple-500" title="Collaborative" />}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{project.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span>Fragments: {project.fragments}</span>
                    <span>Completion: {project.completion}%</span>
                    <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                      style={{width: `${project.completion}%`}}
                    ></div>
                  </div>
                  
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {project.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {project.priority && (
                    <span className={`inline-block px-2 py-1 text-xs rounded ${getPriorityColor(project.priority)}`}>
                      {project.priority} priority
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditItem('project', project.id);
                    }}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit project"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem('project', project.id);
                    }}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContentManagementPanel;