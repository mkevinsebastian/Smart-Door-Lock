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
  getDeviceStatus,
  simulateAttendanceEvent,
  simulateAlarmEvent
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

  // Real-time update states
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [realTimeData, setRealTimeData] = useState({
    newAttendance: 0,
    newAlarms: 0,
    doorStatus: 'closed',
    onlineUsers: 0,
    recentActivities: []
  });

  // Polling interval reference
  const _pollingIntervalRef = useState(null);

  useEffect(() => {
    loadDashboardData();
    setupRESTPolling();
    
    return () => {
      // Cleanup polling
      if (_pollingIntervalRef.current) {
        clearInterval(_pollingIntervalRef.current);
      }
    };
  }, []);

  const setupRESTPolling = () => {
    // Poll untuk status device setiap 5 detik
    const interval = setInterval(async () => {
      try {
        const status = await getDeviceStatus();
        setRealTimeData(prev => ({
          ...prev,
          doorStatus: status.door || 'closed'
        }));
        
        // Add polling activity to log
        setRealTimeData(prev => ({
          ...prev,
          recentActivities: [
            { 
              type: 'polling', 
              message: `Status polled: door=${status.door}`, 
              timestamp: new Date() 
            },
            ...prev.recentActivities.slice(0, 9)
          ]
        }));
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);
    
    _pollingIntervalRef.current = interval;
  };

  const simulateNewAttendance = async () => {
    try {
      const testData = {
        username: "Test User",
        access_id: "TEST001",
        status: "success",
        arrow: Math.random() > 0.5 ? "in" : "out"
      };
      
      await simulateAttendanceEvent(testData);
      
      setRealTimeData(prev => ({
        ...prev,
        newAttendance: prev.newAttendance + 1,
        recentActivities: [
          { 
            type: 'attendance', 
            message: `Simulated: ${testData.access_id} ${testData.arrow.toUpperCase()}`, 
            timestamp: new Date(),
            user: testData.username
          },
          ...prev.recentActivities.slice(0, 9)
        ]
      }));
      
      // Refresh data setelah simulasi
      setTimeout(() => loadAttendanceData(), 1000);
      
    } catch (error) {
      console.error('Failed to simulate attendance:', error);
      alert('Failed to simulate attendance event');
    }
  };

  const simulateNewAlarm = async () => {
    try {
      const testData = {
        username: "Security System",
        access_id: "ALARM001",
        reason: "Test alarm simulation"
      };
      
      await simulateAlarmEvent(testData);
      
      setRealTimeData(prev => ({
        ...prev,
        newAlarms: prev.newAlarms + 1,
        recentActivities: [
          { 
            type: 'alarm', 
            message: `Simulated: ${testData.reason}`, 
            timestamp: new Date(),
            user: testData.username
          },
          ...prev.recentActivities.slice(0, 9)
        ]
      }));
      
      // Refresh data setelah simulasi
      setTimeout(() => loadAlarmsData(), 1000);
      
    } catch (error) {
      console.error('Failed to simulate alarm:', error);
      alert('Failed to simulate alarm event');
    }
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
        getDashboardStats(),
        getDeviceStatus() // Tambahkan status device
      ]);

      const [
        usersResult, 
        doorlockResult, 
        attendanceResult, 
        alarmsResult, 
        summaryResult,
        frequentAccessResult,
        longOpenDoorsResult,
        dashboardStatsResult,
        deviceStatusResult
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
      
      // Update door status dari device status
      if (deviceStatusResult.status === 'fulfilled') {
        setRealTimeData(prev => ({
          ...prev,
          doorStatus: deviceStatusResult.value.door || 'closed'
        }));
      }

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

      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error in dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceData = async () => {
    try {
      const attendanceData = await getAttendance();
      setAttendance(attendanceData);
      processAttendanceData(attendanceData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error refreshing attendance:', err);
    }
  };

  const loadAlarmsData = async () => {
    try {
      const alarmsData = await getAlarms();
      setAlarms(alarmsData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error refreshing alarms:', err);
    }
  };

  const processAttendanceData = (attendanceData) => {
    const inData = [];
    const outData = [];
    
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
    
    Object.values(groupedData).forEach(data => {
      inData.push({ date: data.date, count: data.in });
      outData.push({ date: data.date, count: data.out });
    });
    
    setAttendanceIn(inData.slice(-7));
    setAttendanceOut(outData.slice(-7));
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Format time for display
  const formatLastUpdate = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatActivityTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
        <div>
          <h2 className="mb-1">📊 Dashboard</h2>
          <small className="text-muted">
            Last update: {formatLastUpdate(lastUpdate)}
            {realTimeData.newAttendance > 0 && ` • ${realTimeData.newAttendance} new attendance`}
            {realTimeData.newAlarms > 0 && ` • ${realTimeData.newAlarms} new alarms`}
          </small>
        </div>
        <div className="d-flex align-items-center mt-2 mt-md-0">
          <span className="badge bg-success me-2">
            🟢 REST API
          </span>
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={loadDashboardData}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Real-time Notification Badges */}
      {(realTimeData.newAttendance > 0 || realTimeData.newAlarms > 0) && (
        <div className="row mb-3">
          <div className="col-12">
            <div className="alert alert-info d-flex justify-content-between align-items-center">
              <div>
                <strong>📡 Real-time Updates</strong>
                {realTimeData.newAttendance > 0 && (
                  <span className="badge bg-success ms-2">
                    {realTimeData.newAttendance} new attendance
                  </span>
                )}
                {realTimeData.newAlarms > 0 && (
                  <span className="badge bg-danger ms-2">
                    {realTimeData.newAlarms} new alarms
                  </span>
                )}
              </div>
              <button 
                className="btn btn-sm btn-outline-info"
                onClick={() => {
                  setRealTimeData({
                    ...realTimeData,
                    newAttendance: 0,
                    newAlarms: 0
                  });
                  loadDashboardData();
                }}
              >
                Clear & Refresh
              </button>
            </div>
          </div>
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
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'realtime' ? 'active' : ''}`}
              onClick={() => setActiveTab('realtime')}
            >
              📡 Real-time Monitor
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
                  {realTimeData.onlineUsers > 0 && (
                    <div className="mt-1">
                      <span className="badge bg-success">
                        {realTimeData.onlineUsers} online
                      </span>
                    </div>
                  )}
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
                  {realTimeData.newAttendance > 0 && (
                    <div className="mt-1">
                      <span className="badge bg-warning animate-pulse">
                        +{realTimeData.newAttendance} new
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <div className="card text-center shadow-sm border-warning h-100">
                <div className="card-body">
                  <h6 className="card-title text-warning">Active Alarms</h6>
                  <p className="display-6 text-warning mb-0">{dashboardStats.active_alarms || alarms.length}</p>
                  <small className="text-muted">Last 24 hours</small>
                  {realTimeData.newAlarms > 0 && (
                    <div className="mt-1">
                      <span className="badge bg-danger animate-pulse">
                        +{realTimeData.newAlarms} new
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="row mt-4">
            <div className="col-12 col-lg-6">
              <div className="card shadow-sm">
                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">📈 Visitor In (Last 7 Days)</h5>
                  <span className="badge bg-primary">REST API</span>
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
                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">📈 Visitor Out (Last 7 Days)</h5>
                  <span className="badge bg-success">REST API</span>
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

      {/* Real-time Monitor Tab */}
      {activeTab === 'realtime' && (
        <div className="row mt-3 g-4">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">📡 Real-time Activity Monitor</h5>
                <small className="text-muted">Live updates via REST API with 5-second polling</small>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>🔔 Activity Notifications</h6>
                    <div className="list-group">
                      <div className="list-group-item d-flex justify-content-between align-items-center">
                        New Attendance Records
                        <span className="badge bg-success rounded-pill">
                          {realTimeData.newAttendance}
                        </span>
                      </div>
                      <div className="list-group-item d-flex justify-content-between align-items-center">
                        New Alarm Triggers
                        <span className="badge bg-danger rounded-pill">
                          {realTimeData.newAlarms}
                        </span>
                      </div>
                      <div className="list-group-item d-flex justify-content-between align-items-center">
                        Online Users
                        <span className="badge bg-info rounded-pill">
                          {realTimeData.onlineUsers}
                        </span>
                      </div>
                      <div className="list-group-item d-flex justify-content-between align-items-center">
                        Door Status
                        <span className={`badge ${realTimeData.doorStatus === 'open' ? 'bg-warning' : 'bg-secondary'} rounded-pill`}>
                          {realTimeData.doorStatus.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <h6 className="mt-4">📋 Recent Activities</h6>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {realTimeData.recentActivities.length === 0 ? (
                        <p className="text-muted small">No recent activities</p>
                      ) : (
                        realTimeData.recentActivities.map((activity, index) => (
                          <div key={index} className="border-bottom pb-2 mb-2">
                            <div className="d-flex justify-content-between">
                              <small>
                                {activity.type === 'attendance' && '📊 '}
                                {activity.type === 'alarm' && '🚨 '}
                                {activity.type === 'access' && '🚪 '}
                                {activity.type === 'polling' && '🔄 '}
                                {activity.message}
                                {activity.user && ` (${activity.user})`}
                              </small>
                              <small className="text-muted">
                                {formatActivityTime(activity.timestamp)}
                              </small>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h6>📊 System Status</h6>
                    <div className="card bg-light">
                      <div className="card-body">
                        <p><strong>Connection:</strong> 
                          <span className="badge bg-success ms-2">
                            REST API CONNECTED
                          </span>
                        </p>
                        <p><strong>Last Update:</strong> {formatLastUpdate(lastUpdate)}</p>
                        <p><strong>Polling:</strong> 
                          <span className="badge bg-info ms-2">
                            ACTIVE (5s)
                          </span>
                        </p>
                        <p><strong>Total Data Loaded:</strong></p>
                        <ul>
                          <li>Users: {users.length}</li>
                          <li>Attendance: {attendance.length} records</li>
                          <li>Alarms: {alarms.length} records</li>
                          <li>Doorlock Users: {doorlockUsers}</li>
                        </ul>
                        
                        <h6 className="mt-3">🛠️ Simulation Tools</h6>
                        <div className="d-grid gap-2">
                          <button 
                            className="btn btn-outline-success btn-sm"
                            onClick={simulateNewAttendance}
                          >
                            📊 Simulate Attendance
                          </button>
                          <button 
                            className="btn btn-outline-danger btn-sm"
                            onClick={simulateNewAlarm}
                          >
                            🚨 Simulate Alarm
                          </button>
                        </div>

                        <h6 className="mt-3">🔗 REST API Endpoints</h6>
                        <div className="small">
                          <code>GET /api/device/status</code> - Device status<br/>
                          <code>POST /api/device/events/attendance</code> - Simulate attendance<br/>
                          <code>POST /api/device/events/alarm</code> - Simulate alarm
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h6>🔄 Quick Actions</h6>
                  <div className="d-flex gap-2 flex-wrap">
                    <button 
                      className="btn btn-outline-primary btn-sm"
                      onClick={loadDashboardData}
                    >
                      Refresh All Data
                    </button>
                    <button 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setRealTimeData({
                          ...realTimeData,
                          newAttendance: 0,
                          newAlarms: 0,
                          recentActivities: []
                        });
                      }}
                    >
                      Clear Counters
                    </button>
                    <button 
                      className="btn btn-outline-info btn-sm"
                      onClick={simulateNewAttendance}
                    >
                      Simulate Attendance
                    </button>
                    <button 
                      className="btn btn-outline-warning btn-sm"
                      onClick={simulateNewAlarm}
                    >
                      Simulate Alarm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="text-center">
            <small className="text-muted">
              🔄 REST API polling enabled • 5-second intervals • No MQTT dependency
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}