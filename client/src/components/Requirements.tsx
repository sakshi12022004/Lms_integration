import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, XCircle, AlertCircle, Minus } from 'lucide-react';
import { useAuth } from '../auth/auth';

interface RequirementItem {
  id: string | number;
  itemName: string;
  quantity: number;
  status: 'pending' | 'approved' | 'out_of_stock';
}

interface RequirementRequest {
  id: string | number;
  teacherId: number;
  teacherName: string;
  classroomName: string;
  priority: 'low' | 'medium' | 'high';
  requirements?: RequirementItem[];
  items?: RequirementItem[];
  requestedAt: string;
  status: 'pending' | 'partially_approved' | 'approved' | 'rejected';
}

const mockItems = [
  'Chalk', 'Whiteboard Marker', 'Duster', 'Diary', 'Attendance Log', 
  'White Papers', 'Notebooks', 'Pens', 'Pencils', 'Eraser'
];

export default function Requirements({ role }: { role: string }) {
  const { API, token, user } = useAuth();
  
  const [requirements, setRequirements] = useState<RequirementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItemForOrder, setSelectedItemForOrder] = useState<any>(null);
  
  const [form, setForm] = useState({
    classroomName: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    selectedItems: [] as string[],
    quantities: {} as Record<string, number>
  });

  const [orderForm, setOrderForm] = useState({
    unitPrice: '',
    quantity: '',
    deliveryDate: '',
    vendorId: ''
  });

  // Load requirements from API
  useEffect(() => {
    const fetchRequirements = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const endpoint = role === 'storekeeper' || role === 'admin' 
          ? `${API}/requirements`
          : `${API}/requirements/my-requests`;
        
        console.log('Fetching requirements from:', endpoint);
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch requirements: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Fetched requirements:', data);
        setRequirements(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching requirements:', err);
        setError(err instanceof Error ? err.message : 'Failed to load requirements');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchRequirements();
      // Refresh every 5 seconds for real-time updates
      const interval = setInterval(fetchRequirements, 5000);
      return () => clearInterval(interval);
    }
  }, [token, API, role, user?.id]);

  // Filter requirements based on role
  // Note: API already filters for teacher role, so no need to filter again
  const filteredRequirements = role === 'storekeeper' || role === 'admin' || role === 'accountant'
    ? requirements
    : requirements;
    const firstApprovedId = (filteredRequirements || []).find((r: any) => r.status === 'approved')?.id;
    const firstPendingId = (filteredRequirements || []).find((r: any) => r.status === 'pending')?.id;

  const handleItemToggle = (item: string) => {
    setForm(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.includes(item)
        ? prev.selectedItems.filter(i => i !== item)
        : [...prev.selectedItems, item],
      quantities: {
        ...prev.quantities,
        [item]: prev.quantities[item] || 1
      }
    }));
  };

  const handleQuantityChange = (item: string, quantity: number) => {
    setForm(prev => ({
      ...prev,
      quantities: {
        ...prev.quantities,
        [item]: Math.max(1, quantity)
      }
    }));
  };

  const submitRequest = async () => {
    if (!form.classroomName || form.selectedItems.length === 0) {
      alert('Please fill in classroom name and select at least one item');
      return;
    }

    setSubmitting(true);
    try {
      const items = form.selectedItems.map(item => ({
        itemName: item,
        quantity: form.quantities[item] || 1
      }));

      const payload = {
        classroomName: form.classroomName,
        priority: form.priority,
        items: items
      };

      console.log('Submitting requirement:', payload);

      const response = await fetch(`${API}/requirements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit requirement');
      }

      const result = await response.json();
      console.log('Requirement submitted:', result);
      // Observed by GuideBot (ActionGuard) only — fires strictly after the request succeeded.
      window.dispatchEvent(new CustomEvent('guidebot:action-success', { detail: { actionId: 'requirement-created' } }));

      // Reset form
      setShowRequestForm(false);
      setForm({
        classroomName: '',
        priority: 'medium',
        selectedItems: [],
        quantities: {}
      });

      // Refresh requirements
      const refreshResponse = await fetch(`${API}/requirements/my-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setRequirements(Array.isArray(refreshedData) ? refreshedData : []);
      }

      alert('Requirement request submitted successfully!');
    } catch (error) {
      console.error('Error submitting requirement:', error);
      alert(`Error submitting requirement: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequirementAction = async (itemId: number | string, status: 'approved' | 'out_of_stock') => {
    try {
      console.log(`Updating requirement item ${itemId} to ${status}`);

      const response = await fetch(`${API}/requirements/${itemId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update requirement');
      }

      const result = await response.json();
      console.log('Requirement updated:', result);

      // Refresh requirements
      const endpoint = role === 'storekeeper' || role === 'admin' 
        ? `${API}/requirements`
        : `${API}/requirements/my-requests`;
      
      const refreshResponse = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setRequirements(Array.isArray(refreshedData) ? refreshedData : []);
      }

      alert(`Item marked as ${status} successfully!`);
    } catch (error) {
      console.error('Error updating requirement:', error);
      alert(`Error updating requirement: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleOrderItem = (item: any) => {
    setSelectedItemForOrder(item);
    setOrderForm({
      unitPrice: '',
      quantity: item.quantity?.toString() || '',
      deliveryDate: '',
      vendorId: ''
    });
    setShowOrderForm(true);
  };

  const submitOrder = async () => {
    if (!orderForm.unitPrice || !orderForm.quantity || !selectedItemForOrder) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        requirementItemId: selectedItemForOrder.id,
        itemName: selectedItemForOrder.itemName,
        quantity: parseInt(orderForm.quantity),
        unitPrice: parseFloat(orderForm.unitPrice),
        deliveryDate: orderForm.deliveryDate || null,
        vendorId: orderForm.vendorId || null
      };

      console.log('Submitting order:', payload);

      const response = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create order');
      }

      const result = await response.json();
      console.log('Order created:', result);

      // Reset form
      setShowOrderForm(false);
      setSelectedItemForOrder(null);
      setOrderForm({
        unitPrice: '',
        quantity: '',
        deliveryDate: '',
        vendorId: ''
      });

      alert('Order placed successfully!');
    } catch (error) {
      console.error('Error creating order:', error);
      alert(`Error creating order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'out_of_stock': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error loading requirements: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {role === 'storekeeper' ? 'Manage Requirements' : 'My Requirements'}
        </h1>
        {role !== 'storekeeper' && (
          <button
            onClick={() => setShowRequestForm(true)}
            data-tour="requirements-new-button"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Package className="w-5 h-5 mr-2" />
            New Requirement
          </button>
        )}
      </div>

      {/* Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div data-tour="requirements-create-form" className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Requirement Request</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classroom Name
                </label>
                <input
                  type="text"
                  value={form.classroomName}
                  onChange={(e) => setForm(prev => ({ ...prev, classroomName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="e.g., Grade 10 - Section A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Items
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {mockItems.map(item => (
                    <label key={item} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.selectedItems.includes(item)}
                        onChange={() => handleItemToggle(item)}
                        className="rounded"
                      />
                      <span className="text-sm">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.selectedItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantities
                  </label>
                  <div className="space-y-2">
                    {form.selectedItems.map(item => (
                      <div key={item} className="flex items-center space-x-2">
                        <span className="text-sm flex-1">{item}</span>
                        <input
                          type="number"
                          min="1"
                          value={form.quantities[item] || 1}
                          onChange={(e) => handleQuantityChange(item, parseInt(e.target.value) || 1)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowRequestForm(false)}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Form Modal */}
      {showOrderForm && selectedItemForOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Place Order for Out-of-Stock Item</h2>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Item: {selectedItemForOrder.itemName}</p>
                <p className="text-sm text-gray-600">Required Quantity: {selectedItemForOrder.quantity}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter quantity to order"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={orderForm.unitPrice}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, unitPrice: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter unit price"
                />
              </div>

              {orderForm.quantity && orderForm.unitPrice && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">
                    Total Amount: ₹{(parseFloat(orderForm.quantity) * parseFloat(orderForm.unitPrice)).toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={orderForm.deliveryDate}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor ID (Optional)
                </label>
                <input
                  type="text"
                  value={orderForm.vendorId}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, vendorId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter vendor ID if available"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowOrderForm(false);
                  setSelectedItemForOrder(null);
                }}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitOrder}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirements List */}
      <div className="space-y-4">
        {filteredRequirements?.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No requirements found</p>
          </div>
        ) : (
          filteredRequirements?.map((req: any) => (
            <div key={req.id} data-tour={req.id === firstApprovedId ? 'requirement-approved-block' : req.id === firstPendingId ? 'requirement-pending-block' : undefined} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{req.classroomName}</h3>
                  <p className="text-sm text-gray-600">by {req.teacherName}</p>
                  <p className="text-xs text-gray-500">{new Date(req.requestedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(req.priority)}`}>
                    {req.priority}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    req.status === 'approved' ? 'bg-green-100 text-green-800' :
                    req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    req.status === 'partially_approved' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {req.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {(req.items || req.requirements || []).map((item: any, index: number) => (
                  <div key={item.id || index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(item.status)}
                      <div>
                        <span className="font-medium">{item.itemName}</span>
                        <span className="text-sm text-gray-600 ml-2">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    
                    {role === 'storekeeper' && item.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRequirementAction(item.id, 'approved')}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRequirementAction(item.id, 'out_of_stock')}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          Out of Stock
                        </button>
                      </div>
                    )}

                    {role === 'storekeeper' && item.status === 'out_of_stock' && (
                      <button
                        onClick={() => handleOrderItem(item)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Place Order
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
