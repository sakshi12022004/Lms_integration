import { useState, useEffect } from "react";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";
import {
  Package,
  TrendingUp,
  AlertCircle,
  Truck,
  FileText,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const StorekeeperDashboard = () => {
  const { token, API } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockItems: 0,
    totalVendors: 0,
    recentOrders: 0,
    universityName: "",
    universityId: null,
  });

  const [chartData, setChartData] = useState({
    inventoryTrend: [],
    stockByCategory: [],
    vendorDistribution: [],
    orderStatus: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role !== "storekeeper") {
      navigate("/login");
      return;
    }
    loadStorekeeperData();
  }, []);

  const loadStorekeeperData = async () => {
    try {
      setLoading(true);

      // Get storekeeper's university data
      const res = await fetch(`${API}/storekeeper/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load data");

      const data = await res.json();

      // Set stats
      setStats({
        totalItems: data.totalItems || 1250,
        lowStockItems: data.lowStockItems || 15,
        totalVendors: data.totalVendors || 8,
        recentOrders: data.recentOrders || 42,
        universityName: data.universityName || "University",
        universityId: data.universityId,
      });

      // Set chart data
      setChartData({
        inventoryTrend: data.inventoryTrend || [
          { month: "Jan", items: 1000 },
          { month: "Feb", items: 1100 },
          { month: "Mar", items: 1050 },
          { month: "Apr", items: 1200 },
          { month: "May", items: 1250 },
          { month: "Jun", items: 1300 },
        ],
        stockByCategory: data.stockByCategory || [
          { category: "Books", count: 350 },
          { category: "Stationary", count: 400 },
          { category: "Equipment", count: 300 },
          { category: "Furniture", count: 200 },
        ],
        vendorDistribution: data.vendorDistribution || [
          { name: "Vendor A", value: 35, color: "#3b82f6" },
          { name: "Vendor B", value: 25, color: "#8b5cf6" },
          { name: "Vendor C", value: 20, color: "#ec4899" },
          { name: "Others", value: 20, color: "#14b8a6" },
        ],
        orderStatus: data.orderStatus || [
          { name: "Completed", value: 60, color: "#10b981" },
          { name: "Pending", value: 25, color: "#f59e0b" },
          { name: "Cancelled", value: 15, color: "#ef4444" },
        ],
      });
    } catch (err) {
      console.error("Error loading storekeeper data:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-6 shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">📦 {t('storekeeper')} Dashboard</h1>
            <p className="text-purple-200">
              {stats.universityName} • Welcome {user.name}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-bold transition flex items-center gap-2"
          >
            <LogOut size={20} />
            {t('nav_logout')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Items",
              value: stats.totalItems,
              icon: <Package className="text-blue-400" />,
              color: "from-blue-900",
            },
            {
              label: "Low Stock Items",
              value: stats.lowStockItems,
              icon: <AlertCircle className="text-red-400" />,
              color: "from-red-900",
            },
            {
              label: "Total Vendors",
              value: stats.totalVendors,
              icon: <Truck className="text-orange-400" />,
              color: "from-orange-900",
            },
            {
              label: "Recent Orders",
              value: stats.recentOrders,
              icon: <FileText className="text-green-400" />,
              color: "from-green-900",
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className={`bg-gradient-to-br ${stat.color} to-gray-800 p-6 rounded-lg border border-gray-700 hover:border-purple-500 transition`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-400 text-sm font-semibold">
                  {stat.label}
                </h3>
                {stat.icon}
              </div>
              <p className="text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Inventory Trend */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">📈 Inventory Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.inventoryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="items"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: "#8b5cf6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stock by Category */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">📊 Stock by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.stockByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                  }}
                />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Vendor Distribution */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">🏪 Vendor Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.vendorDistribution}
                  cx="50%"
                  cy="50%"
                  label
                  outerRadius={100}
                  dataKey="value"
                >
                  {chartData.vendorDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Order Status */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">📋 Order Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.orderStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.orderStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={loadStorekeeperData}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-bold transition flex items-center gap-2"
          >
            <RefreshCw size={20} />
            Refresh Data
          </button>
          <button
            className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-bold transition flex items-center gap-2"
          >
            <Package size={20} />
            Manage Inventory
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorekeeperDashboard;
