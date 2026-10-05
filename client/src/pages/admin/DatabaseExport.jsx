import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../auth/auth';
import { Download, Database, FileSpreadsheet, RefreshCw, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import QuotaLimitModal from '../../components/QuotaLimitModal';

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
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // DISABLED: Allow all users to access database export without restrictions
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
    // DISABLED: Allow all downloads without quota restrictions
    setExportStatus({ type: 'info', message: `Downloading ${tableName} data...` });
    window.open(`${API}/database-export/table/${tableName}/excel?token=${token}&lang=${exportLang}`, '_blank');
    setTimeout(() => {
      setExportStatus({ type: 'success', message: `Downloaded ${tableName} data successfully!` });
    }, 2000);
  };

  const downloadFullDatabase = () => {
    // DISABLED: Allow all downloads without quota restrictions
    setExportStatus({ type: 'info', message: 'Downloading full database...' });
    window.open(`${API}/database-export/database/excel?token=${token}&lang=${exportLang}`, '_blank');
    setTimeout(() => {
      setExportStatus({ type: 'success', message: 'Full database downloaded successfully!' });
    }, 2000);
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
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#ebdcaa] pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">Database Export</h1>
            <p className="text-gray-600 text-sm mt-1">Export SQLite database data to structured Excel format</p>
          </div>
          <button
            onClick={refreshData}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#B99652] hover:bg-[#a38241] text-white rounded-none font-medium text-sm transition-all shadow-sm"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Status Messages */}
        {exportStatus && (
          <div className={`p-4 rounded-none flex items-center gap-3 border ${
            exportStatus.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
            exportStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            'bg-[#fffdf4] text-[#1e1b4b] border-[#ebdcaa]'
          }`}>
            {exportStatus.type === 'error' && <AlertCircle size={20} />}
            {exportStatus.type === 'success' && <CheckCircle size={20} />}
            {exportStatus.type === 'info' && <RefreshCw size={20} className="animate-spin text-[#B99652]" />}
            <span className="font-medium text-sm">{exportStatus.message}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-[#ebdcaa]">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2.5 px-2 border-b-2 font-semibold text-sm transition-all flex items-center ${
                activeTab === 'overview'
                  ? 'border-[#B99652] text-[#B99652]'
                  : 'border-transparent text-gray-500 hover:text-[#1e1b4b] hover:border-gray-300'
              }`}
            >
              <Database className="w-4 h-4 mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tables')}
              className={`py-2.5 px-2 border-b-2 font-semibold text-sm transition-all flex items-center ${
                activeTab === 'tables'
                  ? 'border-[#B99652] text-[#B99652]'
                  : 'border-transparent text-gray-500 hover:text-[#1e1b4b] hover:border-gray-300'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Tables
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Database Stats */}
            {stats && (
              <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] p-6 shadow-sm">
                <h2 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 pb-2 border-b border-[#ebdcaa]">Database Statistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-none border border-[#ebdcaa]">
                    <div className="text-3xl font-bold font-['DM_Serif_Display',serif] text-[#B99652]">{stats.totalTables}</div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#1e1b4b] mt-1">Total Tables</div>
                  </div>
                  {Object.entries(stats.tables).slice(0, 3).map(([table, count]) => (
                    <div key={table} className="bg-white p-4 rounded-none border border-[#ebdcaa]">
                      <div className="text-2xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">{formatNumber(count)}</div>
                      <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{table}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  Last export: {stats.exportDate ? new Date(stats.exportDate).toLocaleString() : 'Never'}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] p-6 shadow-sm">
              <h2 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 pb-2 border-b border-[#ebdcaa]">Export Options</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-white p-4 rounded-none border border-[#ebdcaa]">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1e1b4b]">Language:</label>
                  <select
                    value={exportLang}
                    onChange={(e) => setExportLang(e.target.value)}
                    className="px-3 py-1.5 rounded-none border border-[#ebdcaa] bg-[#fffdf4] text-sm text-[#1e1b4b] focus:border-[#B99652] outline-none"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>

                <button
                  onClick={downloadFullDatabase}
                  className="flex items-center justify-center gap-3 p-6 bg-[#1e1b4b] text-white rounded-none hover:bg-[#2c276b] transition-all shadow-sm"
                >
                  <Database size={24} className="text-[#B99652]" />
                  <div className="text-left">
                    <div className="font-bold text-base font-['DM_Serif_Display',serif]">Export Full Database</div>
                    <div className="text-xs text-gray-300">All tables consolidated in one Excel workbook</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-[#fffdf4] rounded-none p-6 border border-[#ebdcaa]">
              <h3 className="text-base font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-3">How to Export Data</h3>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700">
                <li>Click "Export Full Database" to download all tables in one unified Excel workbook.</li>
                <li>Or go to the "Tables" tab to select and download specific individual tables.</li>
                <li>Downloaded Excel files are compatible with Excel, Google Sheets, and LibreOffice.</li>
                <li>Data includes timestamps, relational references, and formatted headers.</li>
              </ol>
            </div>
          </div>
        )}

        <QuotaLimitModal isOpen={showQuotaModal} onClose={() => { setShowQuotaModal(false); navigate('/admin/dashboard'); }} quotaDetails={quotaDetails} />

        {/* Tables Tab */}
        {activeTab === 'tables' && (
          <div className="space-y-6">
            {/* Table Selection */}
            <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] p-6 shadow-sm">
              <h2 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 pb-2 border-b border-[#ebdcaa]">Select Table</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {tables.map((table) => (
                  <button
                    key={table}
                    onClick={() => handleTableSelect(table)}
                    className={`p-3 rounded-none border transition-all text-xs font-semibold uppercase tracking-wider text-left flex items-center gap-2 ${
                      selectedTable === table
                        ? 'border-[#B99652] bg-[#B99652]/15 text-[#1e1b4b]'
                        : 'border-[#ebdcaa] bg-white hover:bg-[#ebdcaa]/15 text-gray-700'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#B99652] shrink-0" />
                    <span className="truncate">{table}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Table Details */}
            {selectedTable && (
              <>
                {/* Table Actions */}
                <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] p-6 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-[#ebdcaa]">
                    <h2 className="text-xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">Table: {selectedTable}</h2>
                    <button
                      onClick={() => downloadTableExcel(selectedTable)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#B99652] hover:bg-[#a38241] text-white rounded-none text-sm font-semibold transition-all shadow-sm"
                    >
                      <Download size={16} />
                      Export to Excel
                    </button>
                  </div>

                  {/* Table Structure */}
                  {tableStructure.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#1e1b4b] mb-3">Table Structure</h3>
                      <div className="overflow-x-auto border border-[#ebdcaa]">
                        <table className="min-w-full divide-y divide-[#ebdcaa]">
                          <thead className="bg-[#ebdcaa]/30">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold text-[#1e1b4b] uppercase tracking-wider">
                                Column Name
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-[#1e1b4b] uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-[#1e1b4b] uppercase tracking-wider">
                                Nullable
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-[#1e1b4b] uppercase tracking-wider">
                                Default
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-[#ebdcaa]/50">
                            {tableStructure.map((column) => (
                              <tr key={column.cid} className="hover:bg-[#ebdcaa]/10">
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-[#1e1b4b]">
                                  {column.name}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                                  {column.type}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                                  {column.notnull ? 'No' : 'Yes'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">
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
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1e1b4b] mb-3">Data Preview (First 10 records)</h3>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="animate-spin mr-2 text-[#B99652]" />
                        <span className="text-sm font-medium text-[#1e1b4b]">Loading preview...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-[#ebdcaa]">
                        {tableData.length > 0 ? (
                          <table className="min-w-full divide-y divide-[#ebdcaa]">
                            <thead className="bg-[#ebdcaa]/30">
                              <tr>
                                {Object.keys(tableData[0]).map((key) => (
                                  <th
                                    key={key}
                                    className="px-4 py-3 text-left text-xs font-bold text-[#1e1b4b] uppercase tracking-wider whitespace-nowrap"
                                  >
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-[#ebdcaa]/50">
                              {tableData.slice(0, 10).map((row, index) => (
                                <tr key={index} className="hover:bg-[#ebdcaa]/10">
                                  {Object.values(row).map((value, cellIndex) => (
                                    <td
                                      key={cellIndex}
                                      className="px-4 py-3 whitespace-nowrap text-xs text-gray-700"
                                    >
                                      {value === null ? (
                                        <span className="text-gray-400 italic font-mono">NULL</span>
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
                          <div className="text-center py-8 text-gray-500 text-xs bg-white">
                            No records found in this table
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
    </AdminLayout>
  );
};

export default DatabaseExport;
