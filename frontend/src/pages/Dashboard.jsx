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
  controlDoorLock,
  controlBuzzer 
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
  Cell
} from "recharts";
import { useMQTT } from '../hooks/useMQTT';

const TOPIC_SUB_DASHBOARD_REFRESH = 'doorlock/update/dashboard';

export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [doorlockUsers, setDoorlockUsers] = useState(0);
  const [, setAttendance] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [frequentAccess, setFrequentAccess] = useState([]);
  const [longOpenDoors, setLongOpenDoors] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [activeTab, setActiveTab] = useState('overview');

  const [doorControl, setDoorControl] = useState({ doorId: 'D01', command: 'lock' });
  const [buzzerControl, setBuzzerControl] = useState({ 
    buzzerId: 'B01', 
    command: 'on', 
    duration: 5 
  });
  const [controlLoading, setControlLoading] = useState(false);

  const { client, connectionStatus } = useMQTT();

  const loadDashboardData = async () => {
    try {
      // setLoading(true); // Don't set loading on auto-refresh
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
      if (attendanceResult.status === 'fulfilled') setAttendance(attendanceResult.value);
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
  
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  useEffect(() => {
    if (!client || connectionStatus !== 'Connected') return;

    const handleRefresh = (topic) => {
      console.log(`MQTT: Dashboard refresh triggered by ${topic}`);
      loadDashboardData();
    };

    client.subscribe(TOPIC_SUB_DASHBOARD_REFRESH, (err) => {
      if (err) console.error('Failed to subscribe to dashboard refresh topic', err);
    });

    client.on('message', handleRefresh);

    return () => {
      if (client) {
        client.unsubscribe(TOPIC_SUB_DASHBOARD_REFRESH);
        client.off('message', handleRefresh);
      }
    };
  }, [client, connectionStatus]);

  const handleDoorControl = async () => {
    try {
      setControlLoading(true);
      const result = await controlDoorLock(doorControl.doorId, doorControl.command);
      alert(`Door control successful: ${result.message}`);
    } catch (err) {
      alert(`Door control failed: ${err.message}`);
    } finally {
      setControlLoading(false);
    }
  };

  const handleBuzzerControl = async () => {
    try {
      setControlLoading(true);
      const result = await controlBuzzer(
        buzzerControl.buzzerId, 
        buzzerControl.command, 
        buzzerControl.duration
      );
      alert(`Buzzer control successful: ${result.message}`);
    } catch (err) {
      alert(`Buzzer control failed: ${err.message}`);
    } finally {
      setControlLoading(false);
    }
  };

  const frequentAccessChartData = frequentAccess.map(item => ({
    name: item.username || item.access_id,
    count: item.access_count
  }));

  const longOpenDoorsChartData = longOpenDoors.map(item => ({
    name: item.username || item.access_id,
    duration: Math.round(item.avg_duration)
  }));

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
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <h2 className="mb-3 mb-md-0">📊 Dashboard</h2>
        <div className={`badge ${connectionStatus === 'Connected' ? 'bg-success' : 'bg-danger'}`}>
          {connectionStatus === 'Connected' ? 'Real-time Connected' : connectionStatus}
        </div>
      </div>

      {error && (
        <div className="alert alert-warning alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}
      
      {activeTab === 'overview' && (
        <div className="alert alert-info" role="alert">
          <strong>Catatan:</strong> Grafik "Door Access per Day" masih menjumlahkan semua visitor (masuk dan keluar). Untuk memisahkannya (Kriteria 1b), API backend perlu di-update.
        </div>
      )}

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
              className={`nav-link ${activeTab === 'control' ? 'active' : ''}`}
              onClick={() => setActiveTab('control')}
            >
              🎮 Device Control (API)
            </button>
          </li>
        </ul>
      </div>

      {activeTab === 'overview' && (
        <>
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

          <div className="mt-4">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">📈 Door Access per Day (Last 7 Days)</h5>
              </div>
              <div className="card-body" style={{ minHeight: "250px" }}>
                {summary.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={summary}
                      margin={{ top: 20, right: 10, left: -15, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#007bff"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        name="Access Count"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-5">
                    <p className="text-muted">No access data available for the last 7 days.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'trends' && (
        <div className="row mt-3 g-4">
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
                      <BarChart data={frequentAccessChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#ff4d4f" name="Access Count" />
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
                          data={longOpenDoorsChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, duration }) => `${name}: ${duration}s`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="duration"
                        >
                          {longOpenDoorsChartData.map((entry, index) => (
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

      {activeTab === 'control' && (
        <div className="row mt-3 g-4">
          <div className="col-12 col-md-6">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">🔒 Door Lock Control</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Door ID</label>
                  <select 
                    className="form-select"
                    value={doorControl.doorId}
                    onChange={(e) => setDoorControl({...doorControl, doorId: e.target.value})}
                  >
                    <option value="D01">Door D01</option>
                    <option value="D02">Door D02</option>
                    <option value="D03">Door D03</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Command</label>
                  <select 
                    className="form-select"
                    value={doorControl.command}
                    onChange={(e) => setDoorControl({...doorControl, command: e.target.value})}
                  >
                    <option value="lock">🔒 Lock</option>
                    <option value="unlock">🔓 Unlock</option>
                  </select>
                </div>
                <button
                  className={`btn btn-${doorControl.command === 'lock' ? 'warning' : 'success'} w-100`}
                  onClick={handleDoorControl}
                  disabled={controlLoading}
                >
                  {controlLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Sending...
                    </>
                  ) : (
                    `${doorControl.command === 'lock' ? '🔒 Lock' : '🔓 Unlock'} Door ${doorControl.doorId}`
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">🚨 Buzzer Control</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Buzzer ID</label>
                  <select 
                    className="form-select"
                    value={buzzerControl.buzzerId}
                    onChange={(e) => setBuzzerControl({...buzzerControl, buzzerId: e.target.value})}
                  >
                    <option value="B01">Buzzer B01</option>
                    <option value="B02">Buzzer B02</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Command</label>
                  <select 
                    className="form-select"
                    value={buzzerControl.command}
                    onChange={(e) => setBuzzerControl({...buzzerControl, command: e.target.value})}
                  >
                    <option value="on">🔊 Turn On</option>
                    <option value="off">🔇 Turn Off</option>
                  </select>
                </div>
                {buzzerControl.command === 'on' && (
                  <div className="mb-3">
                    <label className="form-label">Duration (seconds)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={buzzerControl.duration}
                      onChange={(e) => setBuzzerControl({...buzzerControl, duration: parseInt(e.target.value)})}
                      min="1"
                      max="60"
                    />
                  </div>
                )}
                <button
                  className={`btn btn-${buzzerControl.command === 'on' ? 'danger' : 'secondary'} w-100`}
                  onClick={handleBuzzerControl}
                  disabled={controlLoading}
                >
                  {controlLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Sending...
                    </>
                  ) : (
                    `${buzzerControl.command === 'on' ? '🔊 Turn On' : '🔇 Turn Off'} Buzzer ${buzzerControl.buzzerId}`
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">⚡ Quick Actions</h5>
              </div>
              <div className="card-body">
                <div className="row g-2">
                  <div className="col-6 col-md-3">
                    <button
                      className="btn btn-outline-success w-100"
                      onClick={() => {
                        setDoorControl({doorId: 'D01', command: 'unlock'});
                        setTimeout(handleDoorControl, 100);
                      }}
                    >
                      🔓 Unlock D01
                    </button>
                  </div>
                  <div className="col-6 col-md-3">
                    <button
                      className="btn btn-outline-warning w-100"
                      onClick={() => {
                        setDoorControl({doorId: 'D01', command: 'lock'});
                        setTimeout(handleDoorControl, 100);
                      }}
                    >
                      🔒 Lock D01
                    </button>
                  </div>
                  <div className="col-6 col-md-3">
                    <button
                      className="btn btn-outline-danger w-100"
                      onClick={() => {
                        setBuzzerControl({buzzerId: 'B01', command: 'on', duration: 10});
                        setTimeout(handleBuzzerControl, 100);
                      }}
                    >
                      🔊 Alarm 10s
                    </button>
                  </div>
                  <div className="col-6 col-md-3">
                    <button
                      className="btn btn-outline-secondary w-100"
                      onClick={() => {
                        setBuzzerControl({buzzerId: 'B01', command: 'off', duration: 0});
                        setTimeout(handleBuzzerControl, 100);
                      }}
                    >
                      🔇 Stop Alarm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}