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
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ebdcaa]">
          <div>
            <h1 className="text-3xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] flex items-center">
              <DollarSign className="mr-2 text-[#B99652]" size={32} />
              {t('fee_structure_management')}
            </h1>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-1">{t('fee_structure_description')}</p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">{t('setup_progress')}</h3>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#B99652]">{savedStructures.length}/2 {t('structures_created')}</span>
          </div>
          <div className="w-full bg-[#ebdcaa]/40 rounded-none h-2">
            <div 
              className="bg-[#B99652] h-2 rounded-none transition-all duration-500" 
              style={{ width: `${(savedStructures.length / 2) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs font-semibold uppercase tracking-wider">
            <span className={savedStructures.some(s => s.category === 'Primary') ? 'text-emerald-700' : 'text-slate-400'}>
              {savedStructures.some(s => s.category === 'Primary') ? '✓' : '○'} {t('primary_structure')}
            </span>
            <span className={savedStructures.some(s => s.category === 'Secondary') ? 'text-emerald-700' : 'text-slate-400'}>
              {savedStructures.some(s => s.category === 'Secondary') ? '✓' : '○'} {t('secondary_structure')}
            </span>
          </div>
        </div>

        {/* Fee Structure Form - Show only if not all created */}
        {showForm && nextCategory === 'Primary' && (
          <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[#ebdcaa]">
              <h2 className="text-2xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">
                {t('create_primary_fee_structure')}
              </h2>
              <span className="text-xs uppercase tracking-wider font-semibold text-[#B99652] bg-white border border-[#ebdcaa] px-2.5 py-1">
                {t('grades_1_4')}
              </span>
            </div>

            {/* Fee Breakdown */}
            <div>
              <h3 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 flex items-center gap-2">
                <DollarSign className="text-[#B99652]" size={20} />
                {t('fee_breakdown')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feeFields.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="bg-white border border-[#ebdcaa] rounded-none p-4 shadow-xs">
                    <div className="flex items-center mb-2 text-slate-700">
                      <Icon className="mr-2 text-[#B99652]" size={18} />
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">{label}</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                      <input
                        type="number"
                        value={feeBreakdown[key as keyof typeof feeBreakdown]}
                        onChange={(e) => setFeeBreakdown({...feeBreakdown, [key]: Number(e.target.value)})}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] text-sm text-[#1e1b4b]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b] mb-2 flex items-center">
                <Calendar className="mr-2 text-[#B99652]" size={16} />
                {t('due_date')}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full md:w-auto px-4 py-2 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] text-sm text-[#1e1b4b]"
              />
            </div>

            {/* Total Fee Display */}
            <div className="p-6 bg-[#1e1b4b] text-white border border-white/10 rounded-none shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-white/60">{t('total_fee_amount')}</div>
                  <div className="text-3xl font-bold font-['DM_Serif_Display',serif] text-white mt-1">₹{totalFee.toLocaleString()}</div>
                </div>
                <DollarSign size={40} className="text-[#B99652] opacity-80" />
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleSave('Primary')}
              disabled={loading}
              className="flex items-center px-6 py-3 bg-[#B99652] hover:bg-[#a38241] text-white rounded-none uppercase tracking-wider text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
            >
              <Save className="mr-2" size={16} />
              {loading ? t('saving') : t('save_primary_structure')}
            </button>
          </div>
        )}

        {/* Secondary Form - Show only if primary exists and secondary doesn't */}
        {showForm && nextCategory === 'Secondary' && (
          <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[#ebdcaa]">
              <h2 className="text-2xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">
                {t('create_secondary_fee_structure')}
              </h2>
              <span className="text-xs uppercase tracking-wider font-semibold text-[#B99652] bg-white border border-[#ebdcaa] px-2.5 py-1">
                {t('grades_5_12')}
              </span>
            </div>

            {/* Fee Breakdown */}
            <div>
              <h3 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 flex items-center gap-2">
                <DollarSign className="text-[#B99652]" size={20} />
                Fee Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feeFields.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="bg-white border border-[#ebdcaa] rounded-none p-4 shadow-xs">
                    <div className="flex items-center mb-2 text-slate-700">
                      <Icon className="mr-2 text-[#B99652]" size={18} />
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">{label}</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                      <input
                        type="number"
                        value={feeBreakdown[key as keyof typeof feeBreakdown]}
                        onChange={(e) => setFeeBreakdown({...feeBreakdown, [key]: Number(e.target.value)})}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] text-sm text-[#1e1b4b]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b] mb-2 flex items-center">
                <Calendar className="mr-2 text-[#B99652]" size={16} />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full md:w-auto px-4 py-2 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] text-sm text-[#1e1b4b]"
              />
            </div>

            {/* Total Fee Display */}
            <div className="p-6 bg-[#1e1b4b] text-white border border-white/10 rounded-none shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-white/60">{t('total_fee_amount')}</div>
                  <div className="text-3xl font-bold font-['DM_Serif_Display',serif] text-white mt-1">₹{totalFee.toLocaleString()}</div>
                </div>
                <DollarSign size={40} className="text-[#B99652] opacity-80" />
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleSave('Secondary')}
              disabled={loading}
              className="flex items-center px-6 py-3 bg-[#B99652] hover:bg-[#a38241] text-white rounded-none uppercase tracking-wider text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
            >
              <Save className="mr-2" size={16} />
              {loading ? t('saving') : t('save_secondary_structure')}
            </button>
          </div>
        )}

        {/* Edit Form */}
        {editingStructure && (
          <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-[#ebdcaa]">
              <h2 className="text-2xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">
                {t('edit_fee_structure')} {editingStructure.category}
              </h2>
              <button
                onClick={handleCancelEdit}
                className="text-slate-400 hover:text-[#1e1b4b]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Fee Breakdown */}
            <div>
              <h3 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 flex items-center gap-2">
                <DollarSign className="text-[#B99652]" size={20} />
                Fee Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feeFields.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="bg-white border border-[#ebdcaa] rounded-none p-4 shadow-xs">
                    <div className="flex items-center mb-2 text-slate-700">
                      <Icon className="mr-2 text-[#B99652]" size={18} />
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">{label}</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                      <input
                        type="number"
                        value={feeBreakdown[key as keyof typeof feeBreakdown]}
                        onChange={(e) => setFeeBreakdown({...feeBreakdown, [key]: Number(e.target.value)})}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] text-sm text-[#1e1b4b]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b] mb-2 flex items-center">
                <Calendar className="mr-2 text-[#B99652]" size={16} />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full md:w-auto px-4 py-2 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] text-sm text-[#1e1b4b]"
              />
            </div>

            {/* Total Fee Display */}
            <div className="p-6 bg-[#1e1b4b] text-white border border-white/10 rounded-none shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-wider font-semibold text-white/60">Total Fee Amount</div>
                  <div className="text-3xl font-bold font-['DM_Serif_Display',serif] text-white mt-1">₹{totalFee.toLocaleString()}</div>
                </div>
                <DollarSign size={40} className="text-[#B99652] opacity-80" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="flex items-center px-6 py-3 bg-[#B99652] hover:bg-[#a38241] text-white rounded-none uppercase tracking-wider text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
              >
                <Save className="mr-2" size={16} />
                {loading ? t('updating') : t('update_structure')}
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center px-5 py-3 border border-[#ebdcaa] bg-white text-[#1e1b4b] rounded-none uppercase tracking-wider text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Saved Structures */}
        {savedStructures.length > 0 && (
          <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] p-6 sm:p-8 shadow-xs">
            <h3 className="text-xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-6 flex items-center pb-3 border-b border-[#ebdcaa]">
              <Save className="mr-2 text-[#B99652]" size={20} />
              Created Fee Structures
            </h3>
            <div className="space-y-4">
              {savedStructures.map((structure, index) => (
                <div key={index} className="bg-white border border-[#ebdcaa] border-l-4 border-l-[#B99652] rounded-none p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] text-lg">
                      {structure.category} Education
                    </div>
                    <div className="text-xs text-slate-500 font-semibold mt-0.5">Grades: {structure.grade} • Due Date: {structure.dueDate}</div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                    <div className="text-2xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">₹{structure.totalFee.toLocaleString()}</div>
                    <button 
                      onClick={() => handleEdit(structure)}
                      className="text-[#B99652] hover:text-[#a38241] flex items-center px-3 py-1 border border-[#ebdcaa] bg-white hover:bg-slate-50 text-xs uppercase tracking-wider font-semibold rounded-none transition-colors"
                    >
                      <Edit size={14} className="mr-1" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Structures Created Message */}
        {savedStructures.length === 2 && !editingStructure && (
          <div className="bg-[#fffdf4] border border-[#ebdcaa] rounded-none p-8 text-center shadow-xs">
            <div className="text-[#B99652] mb-3">
              <Save size={40} className="mx-auto" />
            </div>
            <h3 className="text-xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-1">All Fee Structures Created</h3>
            <p className="text-xs text-slate-600">Both Primary (Grades 1-4) and Secondary (Grades 5-12) fee structures have been configured successfully.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default FeeStructure;
