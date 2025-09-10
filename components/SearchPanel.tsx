import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, Filter, Download, Eye, EyeOff } from 'lucide-react';

interface SearchPanelProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];
  isSearching: boolean;
  searchFilters: any;
  setSearchFilters: (filters: any) => void;
  showAdvancedSearch: boolean;
  setShowAdvancedSearch: (show: boolean) => void;
  exportSearchResults: (format: string) => void;
  addError: (error: any, context: string) => void;
  conversations: any[];
  projects: any[];
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  searchFilters,
  setSearchFilters,
  showAdvancedSearch,
  setShowAdvancedSearch,
  exportSearchResults,
  addError,
  conversations,
  projects
}) => {
  // Memoized search data to prevent unnecessary recalculations
  const searchableData = useMemo(() => {
    return [...conversations, ...projects].map(item => ({
      ...item,
      searchableText: [
        item.title,
        item.description,
        item.content,
        ...(item.tags || [])
      ].filter(Boolean).join(' ').toLowerCase()
    }));
  }, [conversations, projects]);

  // Memoized date range calculations
  const dateRangeFilters = useMemo(() => {
    const now = Date.now();
    return {
      week: now - 7 * 24 * 60 * 60 * 1000,
      month: now - 30 * 24 * 60 * 60 * 1000,
      quarter: now - 90 * 24 * 60 * 60 * 1000
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Search className="w-5 h-5" />
          Enhanced Search & Discovery
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            {showAdvancedSearch ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAdvancedSearch ? 'Hide' : 'Show'} Filters
          </button>
          <button
            onClick={() => exportSearchResults('json')}
            disabled={searchResults.length === 0}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 rounded transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Results
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search conversations, projects, insights..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Advanced Search Filters */}
      {showAdvancedSearch && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={searchFilters.dateRange}
              onChange={(e) => setSearchFilters({...searchFilters, dateRange: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="quarter">Past Quarter</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
            <select
              value={searchFilters.contentType}
              onChange={(e) => setSearchFilters({...searchFilters, contentType: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="conversations">Conversations</option>
              <option value="projects">Projects</option>
              <option value="insights">Insights</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={searchFilters.source}
              onChange={(e) => setSearchFilters({...searchFilters, source: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              <option value="claude">Claude</option>
              <option value="gpt">GPT</option>
              <option value="gemini">Gemini</option>
              <option value="local">Local</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={searchFilters.sortBy}
              onChange={(e) => setSearchFilters({...searchFilters, sortBy: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Date (Newest)</option>
              <option value="date-asc">Date (Oldest)</option>
              <option value="fragments">Fragment Count</option>
              <option value="priority">Priority</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-3">
        {searchResults.length > 0 && (
          <div className="text-sm text-gray-600 mb-3">
            Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </div>
        )}
        
        {searchResults.map((result, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">{result.title}</h4>
                <p className="text-sm text-gray-600 mb-2">{result.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Type: {result.messages ? 'Conversation' : result.fragments ? 'Project' : 'Insight'}</span>
                  <span>Date: {new Date(result.date || result.createdAt).toLocaleDateString()}</span>
                  {result.fragments && <span>Fragments: {result.fragments}</span>}
                  {result.priority && <span>Priority: {result.priority}</span>}
                </div>
                {result.tags && result.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {searchQuery && searchResults.length === 0 && !isSearching && (
          <div className="text-center py-8 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No results found for "{searchQuery}"</p>
            <p className="text-sm mt-1">Try adjusting your search terms or filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel;