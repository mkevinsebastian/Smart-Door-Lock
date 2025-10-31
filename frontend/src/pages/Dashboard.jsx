import { useEffect, useState } from "react";
import {
  getSystemUsers,
  getAttendance,
  getAlarms,
  getAttendanceSummary,
  getDoorlockUsersCount,
  getFrequentAccess,
  getLongOpenDoors,
  getDashboardStats,
  mqttService
} from "../services/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [doorlockUsers, setDoorlockUsers] = useState(0);
  const [attendance, setAttendance] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // New state for trend analysis
  const [frequentAccess, setFrequentAccess] = useState([]);
  const [longOpenDoors, setLongOpenDoors] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [activeTab, setActiveTab] = useState('overview');

  // State for attendance charts
  const [attendanceIn, setAttendanceIn] = useState([]);
  const [attendanceOut, setAttendanceOut] = useState([]);

  useEffect(() => {
    loadDashboardData();
    setupMQTTListeners();
    
    return () => {
      // Cleanup MQTT listeners
      mqttService.unsubscribe("attendance/update");
      mqttService.unsubscribe("alarms/update");
      mqttService.unsubscribe("doorlock/status");
    };
  }, []);

  const setupMQTTListeners = () => {
    mqttService.connect().then(() => {
      // Listen for real-time attendance updates
      mqttService.subscribe("attendance/update", (message) => {
        console.log("Real-time attendance update:", message);
        loadDashboardData(); // Auto-refresh data
      });

      // Listen for real-time alarm updates
      mqttService.subscribe("alarms/update", (message) => {
        console.log("Real-time alarm update:", message);
        loadDashboardData(); // Auto-refresh data
      });

      // Listen for doorlock status updates
      mqttService.subscribe("doorlock/status", (message) => {
        console.log("Doorlock status update:", message);
        // You can update specific components here if needed
      });
    }).catch(err => {
      console.error('MQTT connection failed:', err);
    });
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const results = await Promise.allSettled([
        getSystemUsers(),
        getDoorlockUsersCount(),
        getAttendance(),
        getAlarms(),
        getAttendanceSummary(),
        getFrequentAccess(24),
        getLongOpenDoors(60),
        getDashboardStats()
      ]);

      const [
        usersResult, 
        doorlockResult, 
        attendanceResult, 
        alarmsResult, 
        summaryResult,
        frequentAccessResult,
        longOpenDoorsResult,
        dashboardStatsResult
      ] = results;

      if (usersResult.status === 'fulfilled') setUsers(usersResult.value);
      if (doorlockResult.status === 'fulfilled') setDoorlockUsers(doorlockResult.value);
      if (attendanceResult.status === 'fulfilled') {
        setAttendance(attendanceResult.value);
        processAttendanceData(attendanceResult.value);
      }
      if (alarmsResult.status === 'fulfilled') setAlarms(alarmsResult.value);
      if (frequentAccessResult.status === 'fulfilled') setFrequentAccess(frequentAccessResult.frequent_access || []);
      if (longOpenDoorsResult.status === 'fulfilled') setLongOpenDoors(longOpenDoorsResult.long_open_doors || []);
      if (dashboardStatsResult.status === 'fulfilled') setDashboardStats(dashboardStatsResult);

      if (summaryResult.status === 'fulfilled' && summaryResult.value.length > 0) {
        setSummary(summaryResult.value);
      } else {
        const fallback = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          return {
            date: date.toISOString().split('T')[0],
            count: Math.floor(Math.random() * 5) + 1
          };
        });
        setSummary(fallback);
      }
    } catch (err) {
      console.error('Error in dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const processAttendanceData = (attendanceData) => {
    // Process data for IN and OUT charts
    const inData = [];
    const outData = [];
    
    // Group by date and count IN/OUT
    const groupedData = {};
    
    attendanceData.forEach(record => {
      const date = record.created_at.split('T')[0];
      if (!groupedData[date]) {
        groupedData[date] = { date, in: 0, out: 0 };
      }
      
      if (record.arrow === 'in') {
        groupedData[date].in++;
      } else if (record.arrow === 'out') {
        groupedData[date].out++;
      }
    });
    
    // Convert to arrays for charts
    Object.values(groupedData).forEach(data => {
      inData.push({ date: data.date, count: data.in });
      outData.push({ date: data.date, count: data.out });
    });
    
    setAttendanceIn(inData.slice(-7)); // Last 7 days
    setAttendanceOut(outData.slice(-7)); // Last 7 days
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <div className="container py-4 text-center">
        <div className="py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Header Section */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <h2 className="mb-3 mb-md-0">📊 Dashboard</h2>
        <div className="d-flex align-items-center">
          <span className="badge bg-success me-2">
            {mqttService.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-4">
        <ul className="nav nav-tabs">
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📈 Overview
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'trends' ? 'active' : ''}`}
              onClick={() => setActiveTab('trends')}
            >
              🔍 Trend Analysis
            </button>
          </li>
        </ul>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Cards Section */}
          <div className="row mt-3 g-3">
            <div className="col-12 col-sm-6 col-md-3">
              <div className="card text-center shadow-sm border-primary h-100">
                <div className="card-body">
                  <h6 className="card-title text-primary">System Users</h6>
                  <p className="display-6 text-primary mb-0">{dashboardStats.total_users || users.length}</p>
                  <small className="text-muted">Total system accounts</small>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <div className="card text-center shadow-sm border-success h-100">
                <div className="card-body">
                  <h6 className="card-title text-success">Doorlock Users</h6>
                  <p className="display-6 text-success mb-0">{dashboardStats.total_users || doorlockUsers}</p>
                  <small className="text-muted">Registered access cards</small>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <div className="card text-center shadow-sm border-info h-100">
                <div className="card-body">
                  <h6 className="card-title text-info">Today Access</h6>
                  <p className="display-6 text-info mb-0">{dashboardStats.today_attendance || '0'}</p>
                  <small className="text-muted">Access today</small>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <div className="card text-center shadow-sm border-warning h-100">
                <div className="card-body">
                  <h6 className="card-title text-warning">Active Alarms</h6>
                  <p className="display-6 text-warning mb-0">{dashboardStats.active_alarms || alarms.length}</p>
                  <small className="text-muted">Last 24 hours</small>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="row mt-4">
            <div className="col-12 col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header bg-white">
                  <h5 className="mb-0">📈 Visitor In (Last 7 Days)</h5>
                </div>
                <div className="card-body" style={{ minHeight: "250px" }}>
                  {attendanceIn.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={attendanceIn}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#007bff"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          name="Visitor In"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-5">
                      <p className="text-muted">No visitor in data available.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header bg-white">
                  <h5 className="mb-0">📈 Visitor Out (Last 7 Days)</h5>
                </div>
                <div className="card-body" style={{ minHeight: "250px" }}>
                  {attendanceOut.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={attendanceOut}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#28a745"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          name="Visitor Out"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-5">
                      <p className="text-muted">No visitor out data available.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Trend Analysis Tab */}
      {activeTab === 'trends' && (
        <div className="row mt-3 g-4">
          {/* Frequent Access Analysis */}
          <div className="col-12 col-lg-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white">
                <h5 className="mb-0">🚨 Frequent Access Alert</h5>
                <small className="text-muted">Users with excessive door access in last 24 hours</small>
              </div>
              <div className="card-body">
                {frequentAccess.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={frequentAccess}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="username" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="access_count" fill="#ff4d4f" name="Access Count" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3">
                      <h6>Details:</h6>
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>User</th>
                              <th>Access ID</th>
                              <th>Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {frequentAccess.map((item, index) => (
                              <tr key={index}>
                                <td>{item.username}</td>
                                <td>{item.access_id}</td>
                                <td>
                                  <span className="badge bg-danger">{item.access_count}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">No frequent access detected in the last 24 hours.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Long Open Doors Analysis */}
          <div className="col-12 col-lg-6">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white">
                <h5 className="mb-0">⏰ Long Open Doors</h5>
                <small className="text-muted">Doors left open longer than 60 seconds</small>
              </div>
              <div className="card-body">
                {longOpenDoors.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={longOpenDoors}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ username, avg_duration }) => `${username}: ${Math.round(avg_duration)}s`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="avg_duration"
                        >
                          {longOpenDoors.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3">
                      <h6>Details:</h6>
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Door</th>
                              <th>User</th>
                              <th>Avg Duration</th>
                              <th>Occurrences</th>
                            </tr>
                          </thead>
                          <tbody>
                            {longOpenDoors.map((item, index) => (
                              <tr key={index}>
                                <td>{item.door_id}</td>
                                <td>{item.username}</td>
                                <td>
                                  <span className="badge bg-warning">
                                    {Math.round(item.avg_duration)}s
                                  </span>
                                </td>
                                <td>
                                  <span className="badge bg-info">{item.occurrence_count}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">No long open door incidents detected.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}