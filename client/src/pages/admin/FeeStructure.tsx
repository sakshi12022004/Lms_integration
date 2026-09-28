import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  GraduationCap, 
  Calendar, 
  Save, 
  Edit, 
  Plus,
  X,
  Car,
  Monitor,
  BookOpen,
  Trophy,
  FileText,
  Coffee
} from 'lucide-react';
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import AdminLayout from "../../components/AdminLayout";
import { toast } from 'react-toastify';

const FeeStructure = () => {
  const { API, token } = useAuth();
  const { t } = useTranslation();
  const [feeBreakdown, setFeeBreakdown] = useState({
    tuitionFee: 5000,
    transportFee: 1000,
    computerLabFee: 800,
    libraryFee: 500,
    sportsFee: 300,
    examinationFee: 700,
    miscellaneousFee: 200,
  });
  const [dueDate, setDueDate] = useState('2026-01-31');
  const [savedStructures, setSavedStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingStructure, setEditingStructure] = useState<any>(null);

  const totalFee = Object.values(feeBreakdown).reduce((a, b) => a + b, 0);

  // Fetch existing fee structures on component mount
  useEffect(() => {
    fetchFeeStructures();
  }, []);

  const fetchFeeStructures = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/classrooms/fee-structures`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSavedStructures(data);
      }
    } catch (error) {
      console.error('Error fetching fee structures:', error);
      toast.error('Failed to fetch fee structures');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (category: 'Primary' | 'Secondary') => {
    try {
      setLoading(true);
      
      const structureData = {
        category,
        grade: category === 'Primary' ? '1-4' : '5-12',
        tuitionFee: feeBreakdown.tuitionFee,
        transportFee: feeBreakdown.transportFee,
        computerLabFee: feeBreakdown.computerLabFee,
        libraryFee: feeBreakdown.libraryFee,
        sportsFee: feeBreakdown.sportsFee,
        examinationFee: feeBreakdown.examinationFee,
        miscellaneousFee: feeBreakdown.miscellaneousFee,
        dueDate,
        totalFee: Object.values(feeBreakdown).reduce((a, b) => a + b, 0)
      };

      const response = await fetch(`${API}/classrooms/fee-structures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(structureData)
      });

      if (response.ok) {
        toast.success(`${category} fee structure saved successfully!`);
        await fetchFeeStructures();
        // Reset form
        setFeeBreakdown({
          tuitionFee: 5000,
          transportFee: 1000,
          computerLabFee: 800,
          libraryFee: 500,
          sportsFee: 300,
          examinationFee: 700,
          miscellaneousFee: 200,
        });
        setDueDate('2026-01-31');
      } else {
        const errorData = await response.json();
        console.error('Fee structure save error:', response.status, errorData);
        toast.error(errorData.message || 'Failed to save fee structure');
      }
    } catch (error) {
      console.error('Error saving fee structure:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save fee structure');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (structure: any) => {
    setEditingStructure(structure);
    setFeeBreakdown({
      tuitionFee: structure.tuitionFee,
      transportFee: structure.transportFee,
      computerLabFee: structure.computerLabFee,
      libraryFee: structure.libraryFee,
      sportsFee: structure.sportsFee,
      examinationFee: structure.examinationFee,
      miscellaneousFee: structure.miscellaneousFee,
    });
    setDueDate(structure.dueDate);
  };

  const handleUpdate = async () => {
    try {
      setLoading(true);
      
      const updateData = {
        tuitionFee: feeBreakdown.tuitionFee,
        transportFee: feeBreakdown.transportFee,
        computerLabFee: feeBreakdown.computerLabFee,
        libraryFee: feeBreakdown.libraryFee,
        sportsFee: feeBreakdown.sportsFee,
        examinationFee: feeBreakdown.examinationFee,
        miscellaneousFee: feeBreakdown.miscellaneousFee,
        dueDate,
        totalFee: Object.values(feeBreakdown).reduce((a, b) => a + b, 0)
      };

      const response = await fetch(`${API}/classrooms/fee-structures/${editingStructure.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success('Fee structure updated successfully!');
        await fetchFeeStructures();
        setEditingStructure(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to update fee structure');
      }
    } catch (error) {
      console.error('Error updating fee structure:', error);
      toast.error('Failed to update fee structure');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingStructure(null);
    setFeeBreakdown({
      tuitionFee: 5000,
      transportFee: 1000,
      computerLabFee: 800,
      libraryFee: 500,
      sportsFee: 300,
      examinationFee: 700,
      miscellaneousFee: 200,
    });
    setDueDate('2026-01-31');
  };

  const feeFields = [
    { key: 'tuitionFee', label: 'Tuition Fee', icon: GraduationCap, color: 'text-blue-600' },
    { key: 'transportFee', label: 'Transport Fee', icon: Car, color: 'text-green-600' },
    { key: 'computerLabFee', label: 'Computer Lab Fee', icon: Monitor, color: 'text-purple-600' },
    { key: 'libraryFee', label: 'Library Fee', icon: BookOpen, color: 'text-orange-600' },
    { key: 'sportsFee', label: 'Sports Fee', icon: Trophy, color: 'text-red-600' },
    { key: 'examinationFee', label: 'Examination Fee', icon: FileText, color: 'text-indigo-600' },
    { key: 'miscellaneousFee', label: 'Miscellaneous Fee', icon: Coffee, color: 'text-gray-600' },
  ];

  const getAvailableCategory = () => {
    const primaryExists = savedStructures.some(s => s.category === 'Primary');
    const secondaryExists = savedStructures.some(s => s.category === 'Secondary');
    
    if (!primaryExists) return 'Primary';
    if (!secondaryExists) return 'Secondary';
    return null; // Both exist
  };

  const primaryExists = savedStructures.some(s => s.category === 'Primary');
  const secondaryExists = savedStructures.some(s => s.category === 'Secondary');
  const allStructuresCreated = primaryExists && secondaryExists;
  const nextCategory = getAvailableCategory();
  const showForm = !editingStructure && !allStructuresCreated && nextCategory;

  return (
    <AdminLayout>
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center">
            <DollarSign className="mr-3 text-blue-600" size={36} />
            {t('fee_structure_management')}
          </h1>
          <p className="text-gray-600">{t('fee_structure_description')}</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 bg-white rounded-xl p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">{t('setup_progress')}</h3>
            <span className="text-sm text-gray-600">{savedStructures.length}/2 {t('structures_created')}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500" 
              style={{ width: `${(savedStructures.length / 2) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span className={savedStructures.some(s => s.category === 'Primary') ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {savedStructures.some(s => s.category === 'Primary') ? '✓' : '○'} {t('primary_structure')}
            </span>
            <span className={savedStructures.some(s => s.category === 'Secondary') ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {savedStructures.some(s => s.category === 'Secondary') ? '✓' : '○'} {t('secondary_structure')}
            </span>
          </div>
        </div>

        {/* Fee Structure Form - Show only if not all created */}
        {showForm && nextCategory === 'Primary' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                {t('create_primary_fee_structure')}
              </h2>
              <div className="text-sm text-gray-600">
                {t('grades_1_4')}
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-700 mb-6 flex items-center">
                <DollarSign className="mr-2" size={24} />
                {t('fee_breakdown')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feeFields.map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-3">
                      <Icon className={`mr-3 ${color}`} size={20} />
                      <label className="font-medium text-gray-700">{label}</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={feeBreakdown[key as keyof typeof feeBreakdown]}
                        onChange={(e) => setFeeBreakdown({...feeBreakdown, [key]: Number(e.target.value)})}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div className="mb-8">
              <label className="block text-lg font-semibold text-gray-700 mb-3 flex items-center">
                <Calendar className="mr-2" size={20} />
                {t('due_date')}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Total Fee Display */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-medium opacity-90">{t('total_fee_amount')}</div>
                  <div className="text-3xl font-bold">₹{totalFee.toLocaleString()}</div>
                </div>
                <DollarSign size={48} className="opacity-50" />
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleSave('Primary')}
              disabled={loading}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              <Save className="mr-2" size={20} />
              {loading ? t('saving') : t('save_primary_structure')}
            </button>
          </div>
        )}

        {/* Secondary Form - Show only if primary exists and secondary doesn't */}
        {showForm && nextCategory === 'Secondary' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                {t('create_secondary_fee_structure')}
              </h2>
              <div className="text-sm text-gray-600">
                {t('grades_5_12')}
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-700 mb-6 flex items-center">
                <DollarSign className="mr-2" size={24} />
                Fee Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feeFields.map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-3">
                      <Icon className={`mr-3 ${color}`} size={20} />
                      <label className="font-medium text-gray-700">{label}</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={feeBreakdown[key as keyof typeof feeBreakdown]}
                        onChange={(e) => setFeeBreakdown({...feeBreakdown, [key]: Number(e.target.value)})}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div className="mb-8">
              <label className="block text-lg font-semibold text-gray-700 mb-3 flex items-center">
                <Calendar className="mr-2" size={20} />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Total Fee Display */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-medium opacity-90">{t('total_fee_amount')}</div>
                  <div className="text-3xl font-bold">₹{totalFee.toLocaleString()}</div>
                </div>
                <DollarSign size={48} className="opacity-50" />
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleSave('Secondary')}
              disabled={loading}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              <Save className="mr-2" size={20} />
              {loading ? t('saving') : t('save_secondary_structure')}
            </button>
          </div>
        )}

        {/* Edit Form */}
        {editingStructure && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                {t('edit_fee_structure')} {editingStructure.category}
              </h2>
              <button
                onClick={handleCancelEdit}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {/* Fee Breakdown */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-700 mb-6 flex items-center">
                <DollarSign className="mr-2" size={24} />
                Fee Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feeFields.map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-3">
                      <Icon className={`mr-3 ${color}`} size={20} />
                      <label className="font-medium text-gray-700">{label}</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={feeBreakdown[key as keyof typeof feeBreakdown]}
                        onChange={(e) => setFeeBreakdown({...feeBreakdown, [key]: Number(e.target.value)})}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div className="mb-8">
              <label className="block text-lg font-semibold text-gray-700 mb-3 flex items-center">
                <Calendar className="mr-2" size={20} />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Total Fee Display */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-medium opacity-90">Total Fee Amount</div>
                  <div className="text-3xl font-bold">₹{totalFee.toLocaleString()}</div>
                </div>
                <DollarSign size={48} className="opacity-50" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                <Save className="mr-2" size={20} />
                {loading ? t('updating') : t('update_structure')}
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Saved Structures */}
        {savedStructures.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-6 flex items-center">
              <Save className="mr-2" size={24} />
              Created Fee Structures
            </h3>
            <div className="space-y-4">
              {savedStructures.map((structure, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-gray-800 text-lg">
                        {structure.category} Education
                      </div>
                      <div className="text-sm text-gray-600">Grades: {structure.grade}</div>
                      <div className="text-sm text-gray-600">Due Date: {structure.dueDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-600">₹{structure.totalFee.toLocaleString()}</div>
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => handleEdit(structure)}
                          className="text-blue-600 hover:text-blue-800 flex items-center px-3 py-1 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                        >
                          <Edit size={16} className="mr-1" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Structures Created Message */}
        {savedStructures.length === 2 && !editingStructure && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <div className="text-green-600 mb-4">
              <Save size={48} className="mx-auto mb-2" />
            </div>
            <h3 className="text-xl font-semibold text-green-800 mb-2">All Fee Structures Created</h3>
            <p className="text-green-700">Both Primary (Grades 1-4) and Secondary (Grades 5-12) fee structures have been configured successfully.</p>
          </div>
        )}
      </div>
    </div>
    </AdminLayout>
  );
};

export default FeeStructure;
