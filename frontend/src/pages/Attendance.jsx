import { useEffect, useState } from "react";
import { apiGet, mqttService } from "../services/api";

export default function Attendance() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [newRecords, setNewRecords] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiGet("/attendance");
      setList(res || []);
      setLastUpdate(new Date());
      setNewRecords(0); // Reset counter setelah load
    } catch (err) {
      console.error("Failed to load attendance:", err);
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
      mqttService.unsubscribe("attendance/#");
      mqttService.unsubscribe("attendance/new");
      mqttService.unsubscribe("system/update");
    };
  }, []);

  const setupMQTTListeners = () => {
    mqttService.connect().then(() => {
      setConnectionStatus(true);
      
      console.log('🔔 Attendance MQTT listeners activated');

      // Listen for new attendance records
      mqttService.subscribe("attendance/new", (message) => {
        console.log("📊 New attendance record via MQTT:", message);
        setNewRecords(prev => prev + 1);
        
        // Auto-refresh data setelah 1 detik
        setTimeout(() => {
          load();
        }, 1000);
      });

      // Listen for all attendance updates
      mqttService.subscribe("attendance/#", (message) => {
        console.log("📈 Attendance update:", message);
        setLastUpdate(new Date());
      });

      // Listen for system-wide updates
      mqttService.subscribe("system/update", (message) => {
        console.log("🔄 System update for attendance:", message);
        load(); // Refresh semua data
      });

      // Listen for specific attendance creation
      mqttService.subscribe("attendance/created", (message) => {
        console.log("✅ Attendance created:", message);
        setNewRecords(prev => prev + 1);
        setTimeout(() => load(), 500);
      });

      // Listen for door access events
      mqttService.subscribe("doorlock/access", (message) => {
        console.log("🚪 Door access event:", message);
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message;
          if (data.access_id && data.status === 'success') {
            setNewRecords(prev => prev + 1);
            setTimeout(() => load(), 1000);
          }
        } catch {
          // Ignore parse errors
        }
      });

    }).catch(err => {
      console.error('Attendance MQTT connection failed:', err);
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

  const getStatusBadge = (status, arrow) => {
    if (status === 'success') {
      return arrow === 'in' ? 
        <span className="badge bg-success">IN</span> : 
        <span className="badge bg-info">OUT</span>;
    }
    return <span className="badge bg-danger">FAILED</span>;
  };

  const clearNewRecords = () => {
    setNewRecords(0);
  };

  return (
    <div className="container py-4">
      {/* Header Section */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <div>
          <h2>📊 Attendance Records</h2>
          <p className="text-muted mb-0">
            Real-time attendance data from door access
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
      {newRecords > 0 && (
        <div className="alert alert-info alert-dismissible fade show" role="alert">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>📡 Real-time Update!</strong> 
              <span className="ms-2">{newRecords} new attendance record(s) detected.</span>
            </div>
            <div>
              <button 
                className="btn btn-sm btn-outline-info me-2"
                onClick={load}
              >
                Load Now
              </button>
              <button 
                type="button" 
                className="btn-close" 
                onClick={clearNewRecords}
              ></button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card text-center border-primary">
            <div className="card-body py-3">
              <h5 className="card-title text-primary mb-1">{list.length}</h5>
              <small className="text-muted">Total Records</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center border-success">
            <div className="card-body py-3">
              <h5 className="card-title text-success mb-1">
                {list.filter(item => item.arrow === 'in').length}
              </h5>
              <small className="text-muted">Check IN</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center border-info">
            <div className="card-body py-3">
              <h5 className="card-title text-info mb-1">
                {list.filter(item => item.arrow === 'out').length}
              </h5>
              <small className="text-muted">Check OUT</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center border-warning">
            <div className="card-body py-3">
              <h5 className="card-title text-warning mb-1">{newRecords}</h5>
              <small className="text-muted">New Records</small>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading attendance data...</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Access ID</th>
                <th>Status</th>
                <th>Direction</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    <div className="py-3">
                      <i className="fas fa-clipboard-list fa-2x mb-3"></i>
                      <p>No attendance records found</p>
                      <small>Attendance records will appear here when users access the doors</small>
                    </div>
                  </td>
                </tr>
              ) : (
                list.map((a, index) => (
                  <tr key={a.id} className={index < newRecords ? 'table-success' : ''}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{a.username}</strong>
                    </td>
                    <td>
                      <code>{a.access_id}</code>
                    </td>
                    <td>
                      {getStatusBadge(a.status, a.arrow)}
                    </td>
                    <td>
                      {a.arrow === 'in' ? (
                        <span className="badge bg-success">
                          <i className="fas fa-sign-in-alt me-1"></i> IN
                        </span>
                      ) : (
                        <span className="badge bg-info">
                          <i className="fas fa-sign-out-alt me-1"></i> OUT
                        </span>
                      )}
                    </td>
                    <td>
                      <small>{formatTime(a.created_at)}</small>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          // View details action
                          console.log('View details:', a);
                          alert(`Attendance Details:\n\nUser: ${a.username}\nAccess ID: ${a.access_id}\nDirection: ${a.arrow}\nTime: ${formatTime(a.created_at)}`);
                        }}
                      >
                        <i className="fas fa-eye me-1"></i> View
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
                  <h6>🔔 Real-time Features</h6>
                  <ul className="small mb-0">
                    <li>Auto-refresh when new attendance records are created</li>
                    <li>Live updates via MQTT subscription</li>
                    <li>Visual indicators for new records</li>
                    <li>Real-time statistics</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>📡 MQTT Topics</h6>
                  <div className="small">
                    <code>attendance/new</code> - New records<br/>
                    <code>attendance/created</code> - Record creation<br/>
                    <code>doorlock/access</code> - Door access events<br/>
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
              <span className="text-success">🟢 LIVE</span> - Listening for real-time updates
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