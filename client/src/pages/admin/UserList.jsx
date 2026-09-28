import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/auth';
import AdminLayout from '../../components/AdminLayout';
import { useTranslation } from '../../context/TranslationContext';
import { toast } from 'react-toastify';
import {
  Search,
  Filter,
  RefreshCw,
  User,
  Users,
  UserCheck,
  MoreVertical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const UserList = () => {
  const { token, API } = useAuth();
  const { t } = useTranslation();
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    if (token) {
      console.log('🔄 Token available, fetching users...');
      getUsers();
    } else {
      console.warn('⚠️ No token available yet');
    }
  }, [token]);

  // Log state changes
  useEffect(() => {
    console.log('📊 UserList state updated:', {
      count: userList.length,
      users: userList,
      loading
    });
  }, [userList, loading]);

  const getUsers = async () => {
    if (!token) {
      console.warn('⚠️ getUsers: No token available');
      return;
    }

    try {
      setLoading(true);
      console.log('📡 Fetching users from:', `${API}/admin/users`);
      console.log('🔐 Token:', token.substring(0, 20) + '...');
      
      const response = await fetch(`${API}/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📨 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error response:', errorText, 'Status:', response.status);
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 Raw API response:', data);
      console.log('📦 Response type:', typeof data);
      console.log('📦 Is array?:', Array.isArray(data));
      console.log('📦 Response keys:', data ? Object.keys(data) : 'null');
      
      // Handle both array and object with 'value' property
      let users = [];
      
      // Try multiple extraction strategies
      if (Array.isArray(data)) {
        console.log('✅ Strategy 1: Response is array');
        users = data;
      } else if (data && data.value && Array.isArray(data.value)) {
        console.log('✅ Strategy 2: Has data.value property');
        users = data.value;
      } else if (data && typeof data === 'object') {
        // Check for 'value' property at any level
        const keys = Object.keys(data);
        console.log('📋 Object keys:', keys);
        
        // Last resort: extract any arrays from the object
        for (const key of keys) {
          if (Array.isArray(data[key])) {
            console.log('✅ Strategy 3: Found array in key:', key);
            users = data[key];
            break;
          }
        }
        
        // If still empty, try filtering for objects with 'id'
        if (users.length === 0) {
          const filtered = Object.values(data).filter(item => typeof item === 'object' && item !== null && item.id);
          if (filtered.length > 0) {
            console.log('✅ Strategy 4: Extracted objects with id property');
            users = filtered;
          }
        }
      }
      
      console.log('👥 Extracted users array:', users);
      console.log('👥 Users count:', users.length);
      
      if (users.length > 0) {
        console.log('✅ First user:', users[0]);
        console.log('✅ Setting userList with', users.length, 'users');
      } else {
        console.warn('⚠️ No users extracted from API response');
        console.warn('⚠️ Full data object:', JSON.stringify(data, null, 2));
      }
      
      setUserList(users);
      console.log('✅ setUserList called with:', users.length, 'users');

    } catch (error) {
      console.error('❌ Error loading users:', error);
      setUserList([]);
      toast.error(t('failed_to_load_users') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeUser = async (userId, userName) => {
    if (!confirm(t('confirm_delete_user', { name: userName }))) {
      return;
    }

    try {
      const response = await fetch(`${API}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(t('delete_failed'));
      }

      setUserList(userList.filter(user => user.id !== userId));
      toast.success(t('user_deleted_successfully'));

    } catch (error) {
      toast.error(t('could_not_delete_user'));
      console.error(error);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter users
  const filteredUsers = userList.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
                         user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = role === 'all' || user.role === role;
    return matchesSearch && matchesRole;
  });

  // Sort users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    
    if (sortOrder === 'asc') {
      return aVal.toString().localeCompare(bVal.toString());
    } else {
      return bVal.toString().localeCompare(aVal.toString());
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedUsers.length / perPage);
  const startIndex = (page - 1) * perPage;
  const usersToShow = sortedUsers.slice(startIndex, startIndex + perPage);

  const roleStats = {
    student: userList.filter(u => u.role === 'student').length,
    mentor: userList.filter(u => u.role === 'mentor').length,
    admin: userList.filter(u => u.role === 'admin').length
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-center h-96">
              <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-text">{t('loading_users')}</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-text">{t('user_management')}</h1>
                <p className="text-gray-600 mt-1">{t('manage_all_user_accounts')}</p>
              </div>
            </div>

            {/* Stats */}
            <div data-tour="user-list-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">{t('students')}</p>
                    <p className="text-2xl font-bold text-text">{roleStats.student}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50">
                    <User className="text-primary" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">{t('mentors')}</p>
                    <p className="text-2xl font-bold text-text">{roleStats.mentor}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50">
                    <UserCheck className="text-secondary" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">{t('admins')}</p>
                    <p className="text-2xl font-bold text-text">{roleStats.admin}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50">
                    <Users className="text-success" size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div data-tour="user-list-filters" className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('search')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder={t('search_name_or_email')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-2">{t('role')}</label>
                  <div className="relative">
                    <Filter className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 appearance-none"
                    >
                      <option value="all">{t('all_roles')}</option>
                      <option value="student">{t('student')}</option>
                      <option value="mentor">{t('mentor')}</option>
                      <option value="admin">{t('admin')}</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-gray-400" size={18} />
                  </div>
                </div>

                <div className="flex items-end">
                    <button
                      onClick={() => {
                        setSearch('');
                        setRole('all');
                        setPage(1);
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 text-text rounded-lg hover:bg-gray-50"
                    >
                      {t('clear_filters')}
                    </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                        <th className="text-left p-4">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center space-x-1 font-medium text-sm text-gray-700 hover:text-text"
                      >
                        <span>{t('name')}</span>
                        {sortField === 'name' && (
                          sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                        )}
                      </button>
                    </th>
                        <th className="text-left p-4">
                      <button
                        onClick={() => handleSort('email')}
                        className="flex items-center space-x-1 font-medium text-sm text-gray-700 hover:text-text"
                      >
                        <span>{t('email_address')}</span>
                        {sortField === 'email' && (
                          sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                        )}
                      </button>
                    </th>
                        <th className="text-left p-4">
                      <button
                        onClick={() => handleSort('role')}
                        className="flex items-center space-x-1 font-medium text-sm text-gray-700 hover:text-text"
                      >
                        <span>{t('role')}</span>
                        {sortField === 'role' && (
                          sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                        )}
                      </button>
                    </th>
                      <th className="text-left p-4 font-medium text-sm text-gray-700">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersToShow.map((user, index) => (
                    <tr key={user.id} data-tour={index === 0 ? 'user-list-first-record' : undefined} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="font-semibold text-primary">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-text">{user.name}</p>
                            <p className="text-xs text-gray-500">
                              {t('id_colon')} {user.id ? user.id.toString().substring(0, 8) : t('n_a')}
                              {user.role === 'student' && user.studentId && (
                                <span className="ml-2">• {t('roll_no_colon')} {user.studentId}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-text">{user.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-700'
                            : user.role === 'mentor'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                          <button
                          onClick={() => removeUser(user.id, user.name)}
                          className="px-3 py-1.5 bg-danger text-white rounded-lg hover:bg-danger/90 text-sm"
                        >
                          {t('delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {usersToShow.length === 0 && (
              <div className="text-center py-12">
                <User className="mx-auto text-gray-400" size={48} />
                <p className="mt-4 text-text font-medium">No users found</p>
                <p className="text-gray-600">Try different search terms</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Showing {startIndex + 1}-{Math.min(startIndex + perPage, sortedUsers.length)} of {sortedUsers.length}
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {[1, 2, 3].map(num => (
                      <button
                        key={num}
                        onClick={() => setPage(num)}
                        className={`px-3 py-1.5 rounded-lg ${
                          page === num
                            ? 'bg-primary text-white'
                            : 'border border-gray-300'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default UserList;
