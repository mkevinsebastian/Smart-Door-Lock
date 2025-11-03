import { useEffect, useState } from "react";
import { apiGet, mqttService } from "../services/api";

export default function Alarms() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [newAlarms, setNewAlarms] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiGet("/alarms");
      setList(res || []);
      setLastUpdate(new Date());
      setNewAlarms(0); // Reset counter setelah load
    } catch (err) {
      console.error("Failed to load alarms:", err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load(); 
    setupMQTTListeners();
    
    return () => {
      // Cleanup MQTT listeners
      mqttService.unsubscribe("alarms/#");
      mqttService.unsubscribe("alarms/new");
      mqttService.unsubscribe("system/update");
    };
  }, []);

  const setupMQTTListeners = () => {
    mqttService.connect().then(() => {
      setConnectionStatus(true);
      
      console.log('🔔 Alarms MQTT listeners activated');

      // Listen for new alarm triggers
      mqttService.subscribe("alarms/new", (message) => {
        console.log("🚨 New alarm via MQTT:", message);
        setNewAlarms(prev => prev + 1);
        
        // Auto-refresh data setelah 1 detik
        setTimeout(() => {
          load();
        }, 1000);
      });

      // Listen for all alarm updates
      mqttService.subscribe("alarms/#", (message) => {
        console.log("⚠️ Alarm update:", message);
        setLastUpdate(new Date());
      });

      // Listen for system-wide updates
      mqttService.subscribe("system/update", (message) => {
        console.log("🔄 System update for alarms:", message);
        load(); // Refresh semua data
      });

      // Listen for specific alarm types
      mqttService.subscribe("alarms/triggered", (message) => {
        console.log("🔴 Alarm triggered:", message);
        setNewAlarms(prev => prev + 1);
        setTimeout(() => load(), 500);
      });

      // Listen for doorlock alarm events
      mqttService.subscribe("doorlock/alarm", (message) => {
        console.log("🚪 Doorlock alarm:", message);
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message;
          if (data.alarm_type) {
            setNewAlarms(prev => prev + 1);
            setTimeout(() => load(), 1000);
          }
        } catch {
          // Ignore parse errors
        }
      });

    }).catch(err => {
      console.error('Alarms MQTT connection failed:', err);
      setConnectionStatus(false);
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatLastUpdate = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getReasonBadge = (reason) => {
    if (reason.includes('gagal')) {
      return <span className="badge bg-danger">Failed Access</span>;
    } else if (reason.includes('terbuka')) {
      return <span className="badge bg-warning">Door Open</span>;
    }
    return <span className="badge bg-secondary">Unknown</span>;
  };

  const clearNewAlarms = () => {
    setNewAlarms(0);
  };

  return (
    <div className="container py-4">
      {/* Header Section */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <div>
          <h2>🚨 Alarm Records</h2>
          <p className="text-muted mb-0">
            Real-time alarm monitoring and notifications
            {lastUpdate && (
              <span className="ms-2">• Last update: {formatLastUpdate(lastUpdate)}</span>
            )}
          </p>
        </div>
        <div className="d-flex align-items-center mt-2 mt-md-0">
          <span className={`badge ${connectionStatus ? 'bg-success' : 'bg-warning'} me-2`}>
            {connectionStatus ? '🟢 Connected' : '🟡 Connecting...'}
          </span>
          <button 
            className="btn btn-sm btn-outline-primary me-2"
            onClick={load}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" />
                Refreshing...
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
      </div>

      {/* Real-time Notification */}
      {newAlarms > 0 && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>🚨 New Alarm Detected!</strong> 
              <span className="ms-2">{newAlarms} new alarm(s) triggered.</span>
            </div>
            <div>
              <button 
                className="btn btn-sm btn-outline-danger me-2"
                onClick={load}
              >
                Load Now
              </button>
              <button 
                type="button" 
                className="btn-close" 
                onClick={clearNewAlarms}
              ></button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card text-center border-dark">
            <div className="card-body py-3">
              <h5 className="card-title text-dark mb-1">{list.length}</h5>
              <small className="text-muted">Total Alarms</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center border-danger">
            <div className="card-body py-3">
              <h5 className="card-title text-danger mb-1">
                {list.filter(item => item.reason.includes('gagal')).length}
              </h5>
              <small className="text-muted">Failed Access</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center border-warning">
            <div className="card-body py-3">
              <h5 className="card-title text-warning mb-1">
                {list.filter(item => item.reason.includes('terbuka')).length}
              </h5>
              <small className="text-muted">Door Open</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center border-info">
            <div className="card-body py-3">
              <h5 className="card-title text-info mb-1">{newAlarms}</h5>
              <small className="text-muted">New Alarms</small>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading alarm data...</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Access ID</th>
                <th>Reason</th>
                <th>Type</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    <div className="py-3">
                      <i className="fas fa-bell-slash fa-2x mb-3"></i>
                      <p>No alarm records found</p>
                      <small>Alarm records will appear here when security events occur</small>
                    </div>
                  </td>
                </tr>
              ) : (
                list.map((a, index) => (
                  <tr key={a.id} className={index < newAlarms ? 'table-danger' : ''}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{a.username}</strong>
                    </td>
                    <td>
                      <code>{a.access_id}</code>
                    </td>
                    <td>{a.reason}</td>
                    <td>
                      {getReasonBadge(a.reason)}
                    </td>
                    <td>
                      <small>{formatTime(a.created_at)}</small>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => {
                          // View details action
                          console.log('View alarm details:', a);
                          alert(`Alarm Details:\n\nUser: ${a.username}\nAccess ID: ${a.access_id}\nReason: ${a.reason}\nTime: ${formatTime(a.created_at)}`);
                        }}
                      >
                        <i className="fas fa-search me-1"></i> Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Information */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card bg-light">
            <div className="card-body py-3">
              <div className="row">
                <div className="col-md-6">
                  <h6>🔔 Real-time Alarm Monitoring</h6>
                  <ul className="small mb-0">
                    <li>Auto-refresh when new alarms are triggered</li>
                    <li>Live updates via MQTT subscription</li>
                    <li>Visual indicators for new alarms</li>
                    <li>Real-time alarm statistics</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>📡 MQTT Topics</h6>
                  <div className="small">
                    <code>alarms/new</code> - New alarm triggers<br/>
                    <code>alarms/triggered</code> - Alarm events<br/>
                    <code>doorlock/alarm</code> - Doorlock alarms<br/>
                    <code>system/update</code> - System updates
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-refresh Status */}
      <div className="text-center mt-3">
        <small className="text-muted">
          {connectionStatus ? (
            <>
              <span className="text-danger">🔴 LIVE</span> - Monitoring for alarm events
            </>
          ) : (
            <>
              <span className="text-warning">🟡 OFFLINE</span> - MQTT connection unavailable
            </>
          )}
        </small>
      </div>
    </div>
  );
}