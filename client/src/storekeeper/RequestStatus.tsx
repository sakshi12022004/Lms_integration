import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/auth';
import { CheckCircle, XCircle, Clock, Package, RefreshCw } from 'lucide-react';

type RequestStatus = {
  id: number;
  title: string;
  status: 'pending' | 'accepted' | 'rejected';
  vendor_name: string;
  created_at: string;
  items_count: number;
};

export default function RequestStatus() {
  const { API, token } = useAuth();
  const [requests, setRequests] = useState<RequestStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    fetchRequestStatus();
    // Poll every 30 seconds for real-time updates
    const interval = setInterval(fetchRequestStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequestStatus = async () => {
    try {
      if (!token) return;
      
      const res = await fetch(`${API}/storekeeper/stock-requests/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRequests(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching request status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return CheckCircle;
      case 'rejected': return XCircle;
      case 'pending': return Clock;
      default: return Package;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-600 bg-green-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!showStatus) {
    return (
      <button
        onClick={() => setShowStatus(true)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
      >
        <Package size={20} />
        <span className="font-medium">Request Status</span>
        {requests.length > 0 && (
          <span className="ml-auto bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
            {requests.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-4 py-2 text-white/70">
        <span className="font-medium">Request Status</span>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRequestStatus}
            className="p-1 hover:bg-white/10 rounded"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowStatus(false)}
            className="p-1 hover:bg-white/10 rounded"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="px-2 pb-2 space-y-1 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="text-center py-4 text-white/50">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto mb-2"></div>
            <span className="text-xs">Loading...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-4 text-white/50">
            <Package size={16} className="mx-auto mb-2 opacity-50" />
            <span className="text-xs">No requests</span>
          </div>
        ) : (
          requests.map((request) => {
            const StatusIcon = getStatusIcon(request.status);
            return (
              <div
                key={request.id}
                className="bg-white/5 hover:bg-white/10 rounded-lg p-2 text-white/80 transition-all"
              >
                <div className="flex items-start gap-2">
                  <StatusIcon size={14} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate">{request.title}</p>
                      <span className={`text-xs px-1 py-0.5 rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 truncate">{request.vendor_name}</p>
                    <p className="text-xs text-white/50">
                      {request.items_count} item{request.items_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
