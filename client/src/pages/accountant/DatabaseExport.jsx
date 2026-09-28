import React, { useState, useEffect } from 'react';
import { useAuth } from "../../auth/auth";
import AccountantLayout from "../../components/AccountantLayout";
import { Database, Download, FileText, Calendar, DollarSign, CheckCircle, Clock, RefreshCw } from "lucide-react";

const AccountantDatabaseExport = () => {
  const { token, API } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Test if component loads
  useEffect(() => {
    console.log('🗄️ Database Export component loaded!');
    alert('Database Export page loaded!');
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/accountant/vendor-invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInvoices(data.data || []);
        } else {
          setError('Failed to fetch invoices');
        }
      } else {
        setError('Failed to fetch invoices');
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const exportToCSV = () => {
    alert('CSV Export clicked!');
    console.log('CSV Export clicked!');
  };

  const exportToJSON = () => {
    alert('JSON Export clicked!');
    console.log('JSON Export clicked!');
  };

  if (loading) {
    return (
      <AccountantLayout>
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">🗄️ Database Export</h2>
            <p className="text-gray-400">Export system data to various formats</p>
          </div>
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </AccountantLayout>
    );
  }

  return (
    <AccountantLayout>
      <div style={{ padding: '20px', backgroundColor: '#1e293b', minHeight: '100vh' }}>
        <h1 style={{ color: 'white', fontSize: '32px', marginBottom: '20px' }}>
          🗄️ Database Export
        </h1>
        
        <div style={{ backgroundColor: '#334155', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
          <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '15px' }}>
            Export Options
          </h2>
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <button
              onClick={exportToCSV}
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 9999,
                position: 'relative'
              }}
            >
              📊 Export to CSV
            </button>
            
            <button
              onClick={exportToJSON}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 9999,
                position: 'relative'
              }}
            >
              🗄️ Export to JSON
            </button>
          </div>
          
          <p style={{ color: '#94a3b8', marginTop: '15px', fontSize: '14px' }}>
            {invoices.length === 0 
              ? "No data available to export" 
              : `${invoices.length} invoices available for export`
            }
          </p>
        </div>
        
        <div style={{ backgroundColor: '#334155', padding: '20px', borderRadius: '10px' }}>
          <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '15px' }}>
            Test Section
          </h2>
          <button
            onClick={() => alert('Test button works!')}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              zIndex: 9999,
              position: 'relative'
            }}
          >
            🔴 TEST BUTTON
          </button>
        </div>
      </div>
    </AccountantLayout>
  );
};

export default AccountantDatabaseExport;
