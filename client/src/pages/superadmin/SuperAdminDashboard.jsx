import { useState, useEffect } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import { toast } from "react-toastify";

import { useAuth } from "../../auth/auth";

import jsPDF from "jspdf";

import { 

  Building2, 

  Users, 

  GraduationCap, 

  TrendingUp, 

  MapPin, 

  Calendar,

  DollarSign,

  Award,

  BookOpen,

  Target,

  Activity,

  Plus,

  Search,

  Filter,

  MoreVertical,

  Eye,

  Edit,

  Trash2,

  Mail,

  Phone,

  Clock,

  Star,

  ChevronRight,

  BarChart3,

  PieChart,

  UserPlus,

  Building,

  Settings,

  Bell,

  LogOut

} from "lucide-react";

import CreateUniversityForm from "./CreateUniversityForm";

import CreateUserForm from "./CreateUserForm";

import SuperAdminLayout from "../../components/SuperAdminLayout";


const SuperAdminDashboard = () => {

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const { API, token } = useAuth();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

  const [universities, setUniversities] = useState([]);

  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);

  const [generatedCredentials, setGeneratedCredentials] = useState(null);

  const [selectedUni, setSelectedUni] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");



  // Mock statistics for overview

  const [stats, setStats] = useState({

    totalUniversities: 0,

    totalStudents: 0,

    totalFaculty: 0,

    totalRevenue: 0,

    growthRate: 0,

    activeUsers: 0

  });



  useEffect(() => {

    // Check if user is superadmin

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (user.role !== "superadmin") {

      navigate("/superadmin/login");

      return;

    }

    

    // Set active tab from URL parameters

    const tabParam = searchParams.get('tab');

    setActiveTab(tabParam || 'overview');

    

    loadUniversities();

    loadUsers();

    loadStats();

  }, [searchParams]);



  const handleTabChange = (tab) => {

    setActiveTab(tab);

    navigate(`/superadmin/dashboard?tab=${tab}`);

  };



  const loadUniversities = async () => {

    try {

      setLoading(true);

      console.log('=== Loading Universities ===');
      console.log('Token available:', !!token);
      console.log('Token length:', token?.length || 0);
      console.log('API URL:', API);
      console.log('User from auth:', user);

      const res = await fetch(`${API}/superadmin/universities`, {

        headers: {

          Authorization: `Bearer ${token}`,

        },

      });

      const data = await res.json();

      if (res.ok) {

        const universitiesData = Array.isArray(data.data) ? data.data : (data.data?.universities || []);
        
        setUniversities(universitiesData);

        setStats(prev => ({ ...prev, totalUniversities: universitiesData.length || 0 }));

      }

    } catch (err) {

      console.error("Error loading universities:", err);

    } finally {

      setLoading(false);

    }

  };



  const loadUsers = async () => {

    try {

      setLoading(true);

      console.log('=== Loading Users ===');
      console.log('Token available:', !!token);
      console.log('Token length:', token?.length || 0);
      console.log('API URL:', API);
      console.log('User from auth:', user);

      const res = await fetch(`${API}/superadmin/users`, {

        headers: {

          Authorization: `Bearer ${token}`,

        },

      });

      const data = await res.json();

      if (res.ok) {

        setUsers(data.data || []);

        // Update stats with actual user data

        setStats(prev => ({

          ...prev,

          totalStudents: data.data?.filter(u => u.role === 'student').length || 0,

          totalFaculty: data.data?.filter(u => u.role === 'faculty').length || 0,

          activeUsers: data.data?.filter(u => u.isApproved).length || 0

        }));

      }

    } catch (err) {

      console.error("Error loading users:", err);

    } finally {

      setLoading(false);

    }

  };



  const loadStats = async () => {

    // Calculate actual stats from real data

    setStats({

      totalUniversities: universities.length,

      totalStudents: users.filter(u => u.role === 'student').length,

      totalFaculty: users.filter(u => u.role === 'faculty').length,

      totalRevenue: Math.floor(Math.random() * 1000000) + 100000, // Keep mock for revenue

      growthRate: Math.floor(Math.random() * 30) + 10, // Keep mock for growth

      activeUsers: users.filter(u => u.isApproved).length

    });

  };



  const handleDeleteUniversity = async (universityId) => {
    if (!confirm('Are you sure you want to delete this university? This action cannot be undone and will also delete all users associated with this university.')) {
      return;
    }
    
    try {
      const res = await fetch(`${API}/superadmin/universities/${universityId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        // Remove university from local state
        setUniversities(prev => prev.filter(uni => uni.id !== universityId));
        setStats(prev => ({
          ...prev,
          totalUniversities: prev.totalUniversities - 1
        }));
        setSelectedUni(null);
        toast.success('🗑️ University deleted successfully!');
      } else {
        // Handle error response properly
        const errorText = await res.text();
        let errorMessage = 'Failed to delete university';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use the text directly
          errorMessage = errorText;
        }
        
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error('Delete university error:', err);
      toast.error('Failed to delete university');
    }
  };

  const handleUniversityCreated = () => {

    loadUniversities();

    loadStats();

    handleTabChange("universities");

    toast.success("🎓 Institute successfully added to your empire!");

  };



  const handleUserCreated = (credentials) => {

    setGeneratedCredentials(credentials);

    loadUsers();

    loadStats();

    toast.success("👤 New team member created successfully!");

  };



  const downloadCredentialsPDF = () => {

    if (!generatedCredentials) return;



    const doc = new jsPDF();

    doc.setFontSize(16);

    doc.text("🔐 Institute Portal Credentials", 20, 20);



    doc.setFontSize(11);

    let yPosition = 40;



    doc.text("Name:", 20, yPosition);

    doc.text(generatedCredentials.name, 60, yPosition);

    yPosition += 10;



    doc.text("Email:", 20, yPosition);

    doc.text(generatedCredentials.email, 60, yPosition);

    yPosition += 10;



    doc.text("Password:", 20, yPosition);

    doc.text(generatedCredentials.password, 60, yPosition);

    yPosition += 10;



    doc.text("Role:", 20, yPosition);

    doc.text(generatedCredentials.role, 60, yPosition);

    yPosition += 15;



    doc.setFontSize(9);

    doc.text("Generated on: " + new Date().toLocaleString(), 20, yPosition);



    doc.save(`${generatedCredentials.email}_credentials.pdf`);

    toast.success("📄 Credentials downloaded!");

  };



  const handleLogout = () => {

    localStorage.removeItem("token");

    localStorage.removeItem("user");

    toast.success("👋 Logged out successfully!");

    navigate("/superadmin/login");

  };



  const filteredUniversities = (universities || []).filter(uni => 

    uni.name.toLowerCase().includes(searchTerm.toLowerCase()) ||

    (uni.area && uni.area.toLowerCase().includes(searchTerm.toLowerCase()))

  );



  const user = JSON.parse(localStorage.getItem("user") || "{}");



  return (

    <SuperAdminLayout>

      {/* Always-rendered regardless of active tab — lets GuideBot know
          up front whether at least one institute exists, since the
          Institutes tab's own card markup only renders once that tab is
          actually active. */}
      <div data-tour-universities-count={universities.length} className="max-w-7xl mx-auto">

        {/* Header Section */}

        <div className="mb-8">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">

            <div>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">

                🏛️ Institute Dashboard

              </h1>

              <p className="text-gray-600">

                Manage and expand your educational empire across multiple cities

              </p>

            </div>

          </div>

        </div>



        {/* Success Message */}

        {generatedCredentials && (

          <div data-tour="credentials-banner" className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6 shadow-lg">

            <div className="flex justify-between items-start flex-wrap">

              <div>

                <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">

                  <Award className="text-green-600" size={20} />

                  Team Member Created Successfully!

                </h3>

                <div className="space-y-2 text-sm">

                  <p><span className="font-semibold text-gray-700">Name:</span> <span className="text-gray-900">{generatedCredentials.name}</span></p>

                  <p><span className="font-semibold text-gray-700">Email:</span> <span className="text-gray-900">{generatedCredentials.email}</span></p>

                  <p><span className="font-semibold text-gray-700">Password:</span> <code className="bg-gray-100 px-2 py-1 rounded font-mono text-green-700">{generatedCredentials.password}</code></p>

                  <p><span className="font-semibold text-gray-700">Role:</span> <span className="uppercase text-blue-600 font-semibold">{generatedCredentials.role}</span></p>

                </div>

              </div>

              <button

                onClick={downloadCredentialsPDF}

                data-tour="btn-download-credentials-pdf"

                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors shadow-md"

              >

                📄 Download PDF

              </button>

            </div>

          </div>

        )}



        {/* Tab Content */}

        {activeTab === "overview" && (

          <div>

            <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Overview</h2>

            

            {/* Stats Grid */}

            <div data-tour="overview-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 mb-8">

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">

                <div className="flex items-center justify-between mb-2">

                  <Building2 size={24} />

                  <span className="text-xs bg-white/20 px-2 py-1 rounded">Total</span>

                </div>

                <div className="text-2xl font-bold">{stats.totalUniversities}</div>

                <div className="text-xs opacity-90">Universities</div>

              </div>

              

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">

                <div className="flex items-center justify-between mb-2">

                  <GraduationCap size={24} />

                  <span className="text-xs bg-white/20 px-2 py-1 rounded">Active</span>

                </div>

                <div className="text-2xl font-bold">{stats.totalStudents.toLocaleString()}</div>

                <div className="text-xs opacity-90">Students</div>

              </div>

              

              <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white">

                <div className="flex items-center justify-between mb-2">

                  <Activity size={24} />

                  <span className="text-xs bg-white/20 px-2 py-1 rounded">Online</span>

                </div>

                <div className="text-2xl font-bold">{stats.activeUsers}</div>

                <div className="text-xs opacity-90">Active Users</div>

              </div>

            </div>



            {/* Recent Activity */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              <div data-tour="recent-activity" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">

                  <Clock size={20} className="text-gray-600" />

                  Recent Activity

                </h3>

                <div className="space-y-3">

                  {universities.slice(0, 3).map((uni, index) => (

                    <div key={uni.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">

                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>

                      <div className="flex-1">

                        <p className="font-medium text-gray-900">{uni.name}</p>

                        <p className="text-sm text-gray-600">New institute added</p>

                      </div>

                    </div>

                  ))}

                </div>

              </div>



              <div data-tour="quick-actions" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">

                  <Target size={20} className="text-gray-600" />

                  Quick Actions

                </h3>

                <div className="grid grid-cols-2 gap-3">

                  <button 

                    onClick={() => handleTabChange("createUniversity")}

                    className="p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition-colors"

                  >

                    <Building2 className="text-blue-600 mx-auto mb-1" size={20} />

                    <span className="text-sm font-medium text-blue-900">Add Institute</span>

                  </button>

                  <button 

                    onClick={() => handleTabChange("createUser")}

                    className="p-3 bg-green-50 hover:bg-green-100 rounded-lg text-center transition-colors"

                  >

                    <UserPlus className="text-green-600 mx-auto mb-1" size={20} />

                    <span className="text-sm font-medium text-green-900">Add Staff</span>

                  </button>

                  <button 

                    onClick={() => handleTabChange("universities")}

                    className="p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-center transition-colors"

                  >

                    <Building2 className="text-purple-600 mx-auto mb-1" size={20} />

                    <span className="text-sm font-medium text-purple-900">View Institutes</span>

                  </button>

                  <button 

                    onClick={() => handleTabChange("users")}

                    className="p-3 bg-orange-50 hover:bg-orange-100 rounded-lg text-center transition-colors"

                  >

                    <Users className="text-orange-600 mx-auto mb-1" size={20} />

                    <span className="text-sm font-medium text-orange-900">View Staff</span>

                  </button>

                </div>

              </div>

            </div>

          </div>

        )}



        {activeTab === "universities" && (

          <div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">

              <h2 className="text-2xl font-bold text-gray-900">🏛️ Your Institute Empire</h2>

              <div className="flex items-center gap-4 mt-4 lg:mt-0">

                <div className="relative">

                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />

                  <input

                    type="text"

                    placeholder="Search universities..."

                    data-tour="search-universities"

                    value={searchTerm}

                    onChange={(e) => setSearchTerm(e.target.value)}

                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  />

                </div>

              </div>

            </div>

            

            {loading ? (

              <div className="flex items-center justify-center py-12">

                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>

              </div>

            ) : filteredUniversities.length === 0 ? (

              <div className="text-center py-12">

                <Building2 className="text-gray-400 mx-auto mb-4" size={48} />

                <p className="text-gray-600 mb-4">No institutes found in your empire.</p>

                <button 

                  onClick={() => handleTabChange("createUniversity")}

                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"

                >

                  🏛️ Build Your First Institute

                </button>

              </div>

            ) : (

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {filteredUniversities.map((uni) => (

                  <div

                    key={uni.id}

                    onClick={() => setSelectedUni(uni)}

                    data-tour="university-card"

                    className="group relative bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 overflow-hidden"

                  >

                    {/* University Badge */}

                    <div className="absolute top-4 right-4">

                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>

                    </div>

                    

                    {/* Content */}

                    <div className="relative z-10">

                      <div className="flex items-center gap-3 mb-4">

                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">

                          <Building2 className="text-white" size={20} />

                        </div>

                        <div>

                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">

                            {uni.name}

                          </h3>

                          <p className="text-sm text-gray-600">ID: UNI-{uni.id.toString().padStart(4, '0')}</p>

                        </div>

                      </div>

                      

                      <div className="space-y-3">

                        <div className="flex items-center gap-2 text-gray-700">

                          <MapPin size={16} className="text-gray-400" />

                          <span className="text-sm">{uni.area}</span>

                        </div>

                        

                        <div className="flex items-center gap-2 text-gray-700">

                          <Users size={16} className="text-gray-400" />

                          <span className="text-sm">Admin: {uni.admin?.name || "Not Assigned"}</span>

                        </div>

                        

                        <div className="flex items-center gap-2 text-gray-700">

                          <Mail size={16} className="text-gray-400" />

                          <span className="text-sm text-truncate">{uni.admin?.email || "No email"}</span>

                        </div>

                      </div>

                      

                      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Active
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1">
                          View <ChevronRight size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUniversity(uni.id);
                          }}
                          className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-1 ml-2"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>

                    </div>

                    

                    {/* Hover Effect */}

                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                  </div>

                ))}

              </div>

            )}

          </div>

        )}



        {activeTab === "createUniversity" && (

          <CreateUniversityForm onSuccess={handleUniversityCreated} />

        )}



        {activeTab === "createUser" && (

          <CreateUserForm onSuccess={handleUserCreated} />

        )}



        {activeTab === "users" && (

          <div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">

              <h2 className="text-2xl font-bold text-gray-900">👥 Empire Staff Directory</h2>

              <div className="flex items-center gap-4 mt-4 lg:mt-0">

                <div className="relative">

                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />

                  <input

                    type="text"

                    placeholder="Search staff..."

                    data-tour="search-staff"

                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"

                  />

                </div>

                <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">

                  <UserPlus size={18} />

                  Add Staff

                </button>

              </div>

            </div>

            

            {loading ? (

              <div className="flex items-center justify-center py-12">

                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>

              </div>

            ) : users.length === 0 ? (

              <div className="text-center py-12">

                <Users className="text-gray-400 mx-auto mb-4" size={48} />

                <p className="text-gray-600 mb-4">No staff members in your empire yet.</p>

                <button 

                  onClick={() => handleTabChange("createUser")}

                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"

                >

                  👥 Hire Your First Staff Member

                </button>

              </div>

            ) : (

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead className="bg-gray-50 border-b border-gray-200">

                      <tr>

                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>

                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>

                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>

                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>

                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-gray-200">

                      {users.map((u) => (

                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">

                          <td className="px-6 py-4">

                            <div className="flex items-center gap-3">

                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">

                                <span className="text-white font-bold">

                                  {u.name.charAt(0).toUpperCase()}

                                </span>

                              </div>

                              <div>

                                <p className="font-medium text-gray-900">{u.name}</p>

                                <p className="text-sm text-gray-600">{u.email}</p>

                              </div>

                            </div>

                          </td>

                          <td className="px-6 py-4">

                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${

                              u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :

                              u.role === 'admin' ? 'bg-blue-100 text-blue-700' :

                              u.role === 'faculty' ? 'bg-green-100 text-green-700' :

                              'bg-gray-100 text-gray-700'

                            }`}>

                              {u.role.toUpperCase()}

                            </span>

                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">

                            {u.university || 'System Admin'}

                          </td>

                          <td className="px-6 py-4">

                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${

                              u.isApproved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"

                            }`}>

                              {u.isApproved ? "✅ Active" : "⏳ Pending"}

                            </span>

                          </td>

                          <td className="px-6 py-4">

                            <div className="flex items-center gap-2">

                              <button className="text-blue-600 hover:text-blue-700 transition-colors">

                                <Eye size={16} />

                              </button>

                              <button className="text-gray-600 hover:text-gray-700 transition-colors">

                                <Edit size={16} />

                              </button>

                              <button className="text-red-600 hover:text-red-700 transition-colors">

                                <Trash2 size={16} />

                              </button>

                            </div>

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>

            )}

          </div>

        )}

      </div>



      {/* University Detail Modal */}

      {selectedUni && (

        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6">

              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">

                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">

                  <Building2 className="text-white" size={24} />

                </div>

                {selectedUni.name}

              </h2>

              <button

                onClick={() => setSelectedUni(null)}

                className="text-gray-400 hover:text-gray-600 transition-colors"

              >

                <Trash2 size={20} />

              </button>

            </div>

            

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              <div className="bg-gray-50 rounded-lg p-4">

                <p className="text-sm text-gray-600 mb-1">Location</p>

                <p className="font-semibold text-gray-900 flex items-center gap-2">

                  <MapPin size={16} className="text-gray-400" />

                  {selectedUni.area}

                </p>

              </div>

              

              <div className="bg-gray-50 rounded-lg p-4">

                <p className="text-sm text-gray-600 mb-1">Institute ID</p>

                <p className="font-semibold text-gray-900">UNI-{selectedUni.id.toString().padStart(4, '0')}</p>

              </div>

              

              <div className="bg-gray-50 rounded-lg p-4">

                <p className="text-sm text-gray-600 mb-1">Administrator</p>

                <p className="font-semibold text-gray-900 flex items-center gap-2">

                  <Users size={16} className="text-gray-400" />

                  {selectedUni.admin?.name || "Not Assigned"}

                </p>

                <p className="text-sm text-blue-600 mt-1">{selectedUni.admin?.email || "No email"}</p>

              </div>



              <div className="bg-gray-50 rounded-lg p-4">

                <p className="text-sm text-gray-600 mb-1">Established</p>

                <p className="font-semibold text-gray-900 flex items-center gap-2">

                  <Calendar size={16} className="text-gray-400" />

                  {new Date(selectedUni.createdAt).toLocaleDateString()}

                </p>

              </div>

            </div>



            <div className="flex gap-3">

              <button

                onClick={() => setSelectedUni(null)}

                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors"

              >

                Close

              </button>

              <button

                onClick={() => {

                  setSelectedUni(null);

                  handleTabChange("createUser");

                  toast.info("Go to Add Staff tab to hire staff for this university");

                }}

                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors"

              >

                👥 Hire Staff

              </button>

            </div>

          </div>

        </div>

      )}

    </SuperAdminLayout>

  );

};



export default SuperAdminDashboard;

