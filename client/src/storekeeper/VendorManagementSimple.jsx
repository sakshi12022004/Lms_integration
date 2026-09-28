import React, { useState, useEffect } from 'react';
import { Users2, Plus, Edit2, Trash2, Search, Package } from 'lucide-react';
import { useAuth } from '../auth/auth';

const VendorManagementSimple = () => {
  const { token, API } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [vendorStock, setVendorStock] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('vendors');

  // Check if we're on vendor-stock route and set active tab accordingly
  useEffect(() => {
    if (window.location.pathname.includes('vendor-stock')) {
      setActiveTab('stock');
    }
  }, []);

  useEffect(() => {
    loadVendors();
    loadVendorStock();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      setError('');
      
      const res = await fetch(`${API}/storekeeper/vendors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setVendors(data.data || []);
        } else {
          setError(data.message || 'Failed to load vendors');
        }
      } else {
        setError('Failed to load vendors');
      }
    } catch (err) {
      console.error('Error loading vendors:', err);
      setError('Error loading vendors');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorStock = async () => {
    try {
      const res = await fetch(`${API}/storekeeper/vendor-stock`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setVendorStock(data.data || []);
        }
      }
    } catch (err) {
      console.error('Error loading vendor stock:', err);
    }
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVendorStock = vendorStock.filter(stock =>
    stock.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalVendors: vendors.length,
    totalOrders: vendors.reduce((sum, vendor) => sum + (vendor.totalOrders || 0), 0),
    totalValue: vendors.reduce((sum, vendor) => sum + (vendor.totalValue || 0), 0),
    totalStockItems: vendorStock.reduce((sum, stock) => sum + stock.quantity, 0)
  };

  const handleViewVendor = (vendor) => {
    // Navigate to vendor portal with vendor details
    window.open(`/vendor/dashboard?vendor=${vendor.id}`, '_blank');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Vendor Management</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
          <Plus size={16} />
          Add Vendor
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('vendors')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'vendors'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users2 size={16} className="mr-2" />
            Vendors
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stock'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package size={16} className="mr-2" />
            Vendor Stock
          </button>
        </nav>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users2 className="text-blue-600" size={24} />
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Vendors</p>
              <p className="text-2xl font-bold text-blue-900">{stats.totalVendors}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Package className="text-green-600" size={24} />
            <div>
              <p className="text-sm text-green-600 font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-green-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Package className="text-purple-600" size={24} />
            <div>
              <p className="text-sm text-purple-600 font-medium">Total Value</p>
              <p className="text-2xl font-bold text-purple-900">₹{stats.totalValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Package className="text-orange-600" size={24} />
            <div>
              <p className="text-sm text-orange-600 font-medium">Stock Items</p>
              <p className="text-2xl font-bold text-orange-900">{stats.totalStockItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={activeTab === 'vendors' ? 'Search vendors...' : 'Search stock items...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="ml-2 text-gray-600">Loading...</p>
        </div>
      ) : (
        <>
          {activeTab === 'vendors' && (
            <div className="overflow-x-auto overflow-y-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No vendors found
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {vendor.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {vendor.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            {vendor.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={`text-yellow-400 ${i < Math.round(vendor.rating) ? '' : 'text-gray-300'}`}>
                                ★
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleViewVendor(vendor)}
                              className="text-green-600 hover:text-green-800 mr-2"
                              title="View Vendor Portal"
                            >
                              <Package size={16} />
                            </button>
                            <button className="text-blue-600 hover:text-blue-800">
                              <Edit2 size={16} />
                            </button>
                            <button className="text-red-600 hover:text-red-800">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="overflow-x-auto overflow-y-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredVendorStock.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No vendor stock items found
                      </td>
                    </tr>
                  ) : (
                    filteredVendorStock.map((stock) => (
                      <tr key={stock.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {stock.itemName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stock.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${stock.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {vendors.find(v => v.id === stock.vendorId)?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button className="text-blue-600 hover:text-blue-800">
                              <Edit2 size={16} />
                            </button>
                            <button className="text-red-600 hover:text-red-800">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VendorManagementSimple;
