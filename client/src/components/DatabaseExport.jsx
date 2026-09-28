import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/auth';
import { Download, Database, FileSpreadsheet, RefreshCw, Eye, AlertCircle, CheckCircle } from 'lucide-react';

const DatabaseExport = () => {
  const { token, API } = useAuth();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [tableStructure, setTableStructure] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [exportStatus, setExportStatus] = useState(null);
  const [exportLang, setExportLang] = useState('en');

  useEffect(() => {
    fetchTables();
    fetchStats();
  }, []);

  const fetchTables = async () => {
    try {
      if (!token) {
        console.warn('No token available for database export');
        return;
      }
      
      const response = await fetch(`${API}/database-export/tables`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTables(data.tables || []);
    } catch (error) {
      console.error('Error fetching tables:', error);
      // Don't show toast error for database export to prevent spam
      setExportStatus({ type: 'error', message: 'Failed to fetch tables' });
    }
  };

  const fetchStats = async () => {
    try {
      if (!token) {
        console.warn('No token available for database stats');
        return;
      }
      
      const response = await fetch(`${API}/database-export/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Don't show toast error for database export to prevent spam
    }
  };

  const fetchTableStructure = async (tableName) => {
    try {
      const response = await fetch(`${API}/database-export/table/${tableName}/structure`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setTableStructure(data.columns || []);
    } catch (error) {
      console.error('Error fetching table structure:', error);
    }
  };

  const fetchTableData = async (tableName) => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/database-export/table/${tableName}/data?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setTableData(data.data || []);
    } catch (error) {
      console.error('Error fetching table data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (tableName) => {
    setSelectedTable(tableName);
    fetchTableStructure(tableName);
    fetchTableData(tableName);
  };

  const downloadTableExcel = (tableName) => {
    setExportStatus({ type: 'info', message: `Downloading ${tableName} data...` });
    window.open(`${API}/database-export/table/${tableName}/excel?token=${token}&lang=${exportLang}`, '_blank');
    setTimeout(() => {
      setExportStatus({ type: 'success', message: `${tableName} export completed!` });
    }, 2000);
  };

  const downloadFullDatabase = () => {
    setExportStatus({ type: 'info', message: 'Downloading full database...' });
    window.open(`${API}/database-export/database/excel?token=${token}&lang=${exportLang}`, '_blank');
    setTimeout(() => {
      setExportStatus({ type: 'success', message: 'Full database export completed!' });
    }, 3000);
  };

  const refreshData = () => {
    fetchTables();
    fetchStats();
    if (selectedTable) {
      fetchTableStructure(selectedTable);
      fetchTableData(selectedTable);
    }
    setExportStatus({ type: 'success', message: 'Data refreshed successfully!' });
    setTimeout(() => setExportStatus(null), 2000);
  };

  const formatNumber = (num) => {
    return num ? num.toLocaleString() : '0';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Database Export</h1>
          <p className="text-gray-600 mt-1">Export SQLite database data to Excel format</p>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Status Messages */}
      {exportStatus && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          exportStatus.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          exportStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        } border`}>
          {exportStatus.type === 'error' && <AlertCircle size={20} />}
          {exportStatus.type === 'success' && <CheckCircle size={20} />}
          {exportStatus.type === 'info' && <RefreshCw size={20} className="animate-spin" />}
          <span className="font-medium">{exportStatus.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Database className="inline-block w-4 h-4 mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tables'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileSpreadsheet className="inline-block w-4 h-4 mr-2" />
            Tables
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Database Stats */}
          {stats && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Database Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalTables}</div>
                  <div className="text-sm text-blue-800">Total Tables</div>
                </div>
                {Object.entries(stats.tables).slice(0, 3).map(([table, count]) => (
                  <div key={table} className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-lg font-semibold text-gray-800">{formatNumber(count)}</div>
                    <div className="text-sm text-gray-600">{table}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Last export: {stats.exportDate ? new Date(stats.exportDate).toLocaleString() : 'Never'}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Export Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm">Language:</label>
                  <select
                    value={exportLang}
                    onChange={(e) => setExportLang(e.target.value)}
                    className="px-2 py-1 rounded border"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>

                <button
                onClick={downloadFullDatabase}
                className="flex items-center justify-center gap-3 p-6 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Database size={24} />
                <div className="text-left">
                  <div className="font-semibold text-lg">Export Full Database</div>
                  <div className="text-sm opacity-90">All tables in one Excel file</div>
                </div>
              </button>
              <div className="p-6 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center text-gray-600">
                  <FileSpreadsheet size={24} className="mx-auto mb-2" />
                  <div className="font-semibold">Export Individual Tables</div>
                  <div className="text-sm">Go to Tables tab</div>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Export Data</h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-800">
              <li>Click "Export Full Database" to download all tables in one Excel file</li>
              <li>Or go to "Tables" tab to export individual tables</li>
              <li>Excel files will open directly in your spreadsheet application</li>
              <li>Data includes all records with proper formatting</li>
            </ol>
          </div>
        </div>
      )}

      {/* Tables Tab */}
      {activeTab === 'tables' && (
        <div className="space-y-6">
          {/* Table Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Select Table</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {tables.map((table) => (
                <button
                  key={table}
                  onClick={() => handleTableSelect(table)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedTable === table
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <FileSpreadsheet className="inline-block w-4 h-4 mr-2" />
                  {table}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Table Details */}
          {selectedTable && (
            <>
              {/* Table Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Table: {selectedTable}</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadTableExcel(selectedTable)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Download size={16} />
                      Export to Excel
                    </button>
                  </div>
                </div>

                {/* Table Structure */}
                {tableStructure.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3">Table Structure</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Column Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Nullable
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Default
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {tableStructure.map((column) => (
                            <tr key={column.cid}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {column.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {column.type}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {column.notnull ? 'No' : 'Yes'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {column.dflt_value || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Table Data Preview */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Data Preview (First 100 records)</h3>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="animate-spin mr-2" />
                      Loading data...
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {tableData.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {Object.keys(tableData[0]).map((key) => (
                                <th
                                  key={key}
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {tableData.slice(0, 10).map((row, index) => (
                              <tr key={index}>
                                {Object.values(row).map((value, cellIndex) => (
                                  <td
                                    key={cellIndex}
                                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                  >
                                    {value === null ? (
                                      <span className="text-gray-400 italic">NULL</span>
                                    ) : (
                                      String(value)
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No data found in this table
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseExport;
