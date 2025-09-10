import React from 'react';
import { Wifi, WifiOff, Play, Pause, RefreshCw, Settings, Key } from 'lucide-react';

interface APIConnection {
  id: string;
  platform: string;
  status: 'connected' | 'disconnected' | 'error';
  model: string;
  lastSync: string;
  apiCalls: number;
  latency: string;
}

interface LiveStream {
  id: string;
  name: string;
  source: string;
  status: 'active' | 'paused' | 'error';
  dataRate: string;
  lastUpdate: string;
  recordCount: number;
}

interface APIConnectionsPanelProps {
  apiConnections: APIConnection[];
  liveStreams: LiveStream[];
  onToggleConnection: (id: string) => void;
  onToggleStream: (id: string) => void;
  onRefreshConnection: (id: string) => void;
  onConfigureConnection: (id: string) => void;
}

export const APIConnectionsPanel: React.FC<APIConnectionsPanelProps> = ({
  apiConnections,
  liveStreams,
  onToggleConnection,
  onToggleStream,
  onRefreshConnection,
  onConfigureConnection
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'disconnected':
      case 'paused':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active':
        return <Wifi className="w-4 h-4" />;
      case 'disconnected':
      case 'paused':
        return <WifiOff className="w-4 h-4" />;
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Live API Connections */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          Live API Connections
        </h3>
        <div className="space-y-3">
          {apiConnections.map((connection) => (
            <div key={connection.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${getStatusColor(connection.status)}`}>
                  {getStatusIcon(connection.status)}
                </div>
                <div>
                  <div className="font-medium">{connection.platform}</div>
                  <div className="text-sm text-gray-600">
                    Model: {connection.model} | Latency: {connection.latency}
                  </div>
                  <div className="text-xs text-gray-500">
                    Last sync: {connection.lastSync} | API calls: {connection.apiCalls.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRefreshConnection(connection.id)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Refresh connection"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onConfigureConnection(connection.id)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Configure connection"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onToggleConnection(connection.id)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    connection.status === 'connected'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {connection.status === 'connected' ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Data Streams */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Live Data Streams
        </h3>
        <div className="space-y-3">
          {liveStreams.map((stream) => (
            <div key={stream.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${getStatusColor(stream.status)}`}>
                  {stream.status === 'active' ? (
                    <Play className="w-4 h-4" />
                  ) : stream.status === 'paused' ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <WifiOff className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="font-medium">{stream.name}</div>
                  <div className="text-sm text-gray-600">
                    Source: {stream.source} | Rate: {stream.dataRate}
                  </div>
                  <div className="text-xs text-gray-500">
                    Last update: {stream.lastUpdate} | Records: {stream.recordCount.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleStream(stream.id)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    stream.status === 'active'
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {stream.status === 'active' ? 'Pause' : 'Resume'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connection Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h4 className="font-medium mb-3">Connection Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-green-900">
              {apiConnections.filter(c => c.status === 'connected').length}
            </div>
            <div className="text-sm text-green-600">Active Connections</div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-blue-900">
              {liveStreams.filter(s => s.status === 'active').length}
            </div>
            <div className="text-sm text-blue-600">Active Streams</div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-purple-900">
              {apiConnections.reduce((sum, c) => sum + c.apiCalls, 0).toLocaleString()}
            </div>
            <div className="text-sm text-purple-600">Total API Calls</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIConnectionsPanel;