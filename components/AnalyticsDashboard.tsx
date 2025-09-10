import React from 'react';
import { TrendingUp, Users, MessageSquare, Brain, Target, Zap } from 'lucide-react';

interface AnalyticsDashboardProps {
  realTimeAnalytics: {
    activeUsers: number;
    conversationsToday: number;
    avgResponseTime: string;
    knowledgeGrowth: string;
    topTopics: string[];
    engagementScore: number;
    systemLoad: number;
    apiCalls: number;
  };
  knowledgeGraph: {
    nodes: number;
    connections: number;
    clusters: number;
    depth: number;
  };
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  realTimeAnalytics,
  knowledgeGraph
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        Real-time Analytics Dashboard
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Active Users</p>
              <p className="text-2xl font-bold text-blue-900">{realTimeAnalytics.activeUsers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Conversations Today</p>
              <p className="text-2xl font-bold text-green-900">{realTimeAnalytics.conversationsToday}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Avg Response Time</p>
              <p className="text-2xl font-bold text-purple-900">{realTimeAnalytics.avgResponseTime}</p>
            </div>
            <Zap className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">Knowledge Growth</p>
              <p className="text-2xl font-bold text-orange-900">{realTimeAnalytics.knowledgeGrowth}</p>
            </div>
            <Brain className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>
      
      {/* Knowledge Graph Analytics */}
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Knowledge Graph Analytics
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{knowledgeGraph.nodes}</div>
            <div className="text-sm text-gray-600">Nodes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{knowledgeGraph.connections}</div>
            <div className="text-sm text-gray-600">Connections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{knowledgeGraph.clusters}</div>
            <div className="text-sm text-gray-600">Clusters</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{knowledgeGraph.depth}</div>
            <div className="text-sm text-gray-600">Max Depth</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            3D View
          </button>
          <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
            Export Graph
          </button>
        </div>
      </div>
      
      {/* Top Topics */}
      <div className="mb-4">
        <h4 className="font-medium mb-2">Top Topics Today</h4>
        <div className="flex flex-wrap gap-2">
          {realTimeAnalytics.topTopics.map((topic, index) => (
            <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {topic}
            </span>
          ))}
        </div>
      </div>
      
      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-3 rounded">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Engagement Score</span>
            <span className="text-sm font-medium">{realTimeAnalytics.engagementScore}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{width: `${realTimeAnalytics.engagementScore}%`}}
            ></div>
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">System Load</span>
            <span className="text-sm font-medium">{realTimeAnalytics.systemLoad}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                realTimeAnalytics.systemLoad > 80 ? 'bg-red-500' : 
                realTimeAnalytics.systemLoad > 60 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{width: `${realTimeAnalytics.systemLoad}%`}}
            ></div>
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">API Calls Today</span>
            <span className="text-lg font-bold">{realTimeAnalytics.apiCalls.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;