import { useEffect, useState } from "react";
import { 
  controlDoorLock, 
  controlBuzzer, 
  updateReaderStatus, 
  updatePinpadStatus,
  getDeviceStatus 
} from "../services/api";

export default function DoorLockStatus() {
  const [doorStatus, setDoorStatus] = useState({
    door: 'closed',
    reader: 'disconnected', 
    pinpad: 'disconnected'
  });
  const [buzzerState, setBuzzerState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [_pollingIntervalRef, setPollingInterval] = useState(null);

  // Polling untuk status device
  const interval = setInterval(async () => {
    try {
      const status = await getDeviceStatus();
      setDoorStatus(prev => ({
        ...prev,
        door: status.door || prev.door,
        reader: status.reader || prev.reader, 
        pinpad: status.pinpad || prev.pinpad
      }));
      if (status.buzzer !== undefined) {
        setBuzzerState(status.buzzer);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 800); // ← Ubah jadi 800ms (1 detik)
    
    setPollingInterval(interval);
    return interval;
  };

  useEffect(() => {
    // Load initial status
    const loadInitialStatus = async () => {
      try {
        const status = await getDeviceStatus();
        setDoorStatus({
          door: status.door || 'closed',
          reader: status.reader || 'disconnected',
          pinpad: status.pinpad || 'disconnected'
        });
        setBuzzerState(status.buzzer || false);
      } catch (error) {
        console.error('Failed to load initial status:', error);
      }
    };

    loadInitialStatus();
    const interval = startStatusPolling();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleOpenDoor = async () => {
    try {
      setLoading(true);
      
      // Gunakan MQTT untuk kontrol door
      await controlDoorLock('D01', 'unlock');
      
      // Update local state
      setDoorStatus(prev => ({ ...prev, door: 'open' }));
      
      // Add to message log
      setMessages(prev => [...prev, {
        type: 'sent', 
        message: 'Door D01 unlock command sent via MQTT', 
        timestamp: new Date()
      }]);
      
      alert('🚪 Door unlock command sent to D01 via MQTT!');
      
      // Auto close after 5 seconds
      setTimeout(async () => {
        await controlDoorLock('D01', 'lock');
        setDoorStatus(prev => ({ ...prev, door: 'closed' }));
        setMessages(prev => [...prev, {
          type: 'auto',
          message: 'Door D01 auto-closed via MQTT',
          timestamp: new Date()
        }]);
      }, 5000);
      
    } catch (error) {
      alert(`❌ Failed to open door: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBuzzer = async () => {
    try {
      setLoading(true);
      const newBuzzerState = !buzzerState;
      const command = newBuzzerState ? 'on' : 'off';
      
      // Gunakan MQTT untuk kontrol buzzer
      await controlBuzzer('B01', command, newBuzzerState ? 10 : 0);
      
      // Update local state
      setBuzzerState(newBuzzerState);
      
      // Add to message log
      setMessages(prev => [...prev, {
        type: 'sent', 
        message: `Buzzer ${command} command sent via MQTT`, 
        timestamp: new Date()
      }]);
      
      alert(`🔊 Buzzer ${command} command sent to B01 via MQTT!`);
      
    } catch (error) {
      alert(`❌ Failed to control buzzer: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const simulateDeviceEvents = async () => {
    try {
      // Simulate reader connection (pakai REST API untuk status)
      await updateReaderStatus('R01', 'connected');
      setDoorStatus(prev => ({ ...prev, reader: 'connected' }));
      
      setMessages(prev => [...prev, {
        type: 'simulation',
        message: 'Reader R01 connected (simulated)',
        timestamp: new Date()
      }]);

      // Simulate pinpad connection after 1 second
      setTimeout(async () => {
        await updatePinpadStatus('P01', 'connected');
        setDoorStatus(prev => ({ ...prev, pinpad: 'connected' }));
        
        setMessages(prev => [...prev, {
          type: 'simulation',
          message: 'Pinpad P01 connected (simulated)',
          timestamp: new Date()
        }]);
      }, 800);

      alert('🔧 Device events simulated via REST API!');

    } catch (error) {
      alert(`❌ Failed to simulate events: ${error.message}`);
    }
  };

  const getStatusIcon = (status, type) => {
    if (type === 'door') {
      return status === 'open' ? '🚪 OPEN' : '🔒 CLOSED';
    }
    return status === 'connected' ? '🟢 CONNECTED' : '🔴 DISCONNECTED';
  };

  const getStatusColor = (status, type) => {
    if (type === 'door') {
      return status === 'open' ? 'danger' : 'success';
    }
    return status === 'connected' ? 'success' : 'danger';
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="container py-4">
      <h2>🚪 Door Lock Status & Control (Hybrid)</h2>
      
      {/* Connection Status */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="alert alert-info">
            <strong>Connection Status:</strong> 🟢 HYBRID MODE
            <br />
            <small>REST API for device status • MQTT for device control • 3-second polling</small>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="row mt-4">
        <div className="col-md-3">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Door Status</h5>
              <div className={`display-6 mb-2 text-${getStatusColor(doorStatus.door, 'door')}`}>
                {getStatusIcon(doorStatus.door, 'door')}
              </div>
              <p className="text-muted">Current door state</p>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Reader Status</h5>
              <div className={`display-6 mb-2 text-${getStatusColor(doorStatus.reader, 'reader')}`}>
                {getStatusIcon(doorStatus.reader, 'reader')}
              </div>
              <p className="text-muted">Card reader connection</p>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Pinpad Status</h5>
              <div className={`display-6 mb-2 text-${getStatusColor(doorStatus.pinpad, 'pinpad')}`}>
                {getStatusIcon(doorStatus.pinpad, 'pinpad')}
              </div>
              <p className="text-muted">PIN pad connection</p>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Buzzer Status</h5>
              <div className={`display-6 mb-2 text-${buzzerState ? 'danger' : 'secondary'}`}>
                {buzzerState ? '🔊 ON' : '🔇 OFF'}
              </div>
              <p className="text-muted">Buzzer state</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="row mt-4">
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">🔓 Door Control (D01)</h5>
            </div>
            <div className="card-body text-center">
              <button
                className="btn btn-success btn-lg w-100"
                onClick={handleOpenDoor}
                disabled={loading || doorStatus.door === 'open'}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Opening...
                  </>
                ) : (
                  doorStatus.door === 'open' ? '🚪 DOOR OPEN' : '🚪 OPEN DOOR D01'
                )}
              </button>
              <small className="text-muted mt-2 d-block">
                Using MQTT • Auto-closes in 5 seconds
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">🚨 Buzzer Control (B01)</h5>
            </div>
            <div className="card-body text-center">
              <button
                className={`btn btn-lg w-100 ${buzzerState ? 'btn-danger' : 'btn-secondary'}`}
                onClick={handleToggleBuzzer}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    {buzzerState ? 'Turning Off...' : 'Turning On...'}
                  </>
                ) : (
                  buzzerState ? '🔇 TURN BUZZER OFF' : '🔊 TURN BUZZER ON'
                )}
              </button>
              <small className="text-muted mt-2 d-block">
                Using MQTT • Status: {buzzerState ? 'ON' : 'OFF'}
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">🔧 Device Simulation</h5>
            </div>
            <div className="card-body text-center">
              <button
                className="btn btn-info btn-lg w-100"
                onClick={simulateDeviceEvents}
                disabled={loading}
              >
                🔧 SIMULATE DEVICES
              </button>
              <small className="text-muted mt-2 d-block">
                Simulate reader & pinpad connection
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Message Log */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">📨 System Message Log</h6>
              <div>
                <span className="badge bg-info me-2">Polling: Active</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={clearMessages}>
                  Clear
                </button>
              </div>
            </div>
            <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {messages.length === 0 ? (
                <p className="text-muted mb-0">No messages yet. Polling will start automatically...</p>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className="border-bottom pb-2 mb-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <small className="text-muted">[{formatTime(msg.timestamp)}]</small>
                        <br />
                        <code>
                          {msg.type === 'polling' && '🔄 '}
                          {msg.type === 'sent' && '📤 '}
                          {msg.type === 'simulation' && '🔧 '}
                          {msg.type === 'auto' && '⏰ '}
                          {msg.message}
                        </code>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debug Information */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">🔧 System Information</h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6>Hybrid System:</h6>
                  <ul className="small">
                    <li><strong>REST API Endpoints:</strong></li>
                    <li><code>GET /api/device/status</code> - Get device status</li>
                    <li><code>POST /api/device/status/reader</code> - Update reader status</li>
                    <li><code>POST /api/device/status/pinpad</code> - Update pinpad status</li>
                    <li><strong>MQTT Endpoints:</strong></li>
                    <li><code>POST /api/control/doorlock</code> - Control door lock</li>
                    <li><code>POST /api/control/buzzer</code> - Control buzzer</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>Current State:</h6>
                  <pre className="small">
{JSON.stringify({
  connectionMode: "Hybrid",
  doorStatus,
  buzzerState,
  loading,
  polling: "Active (3s interval)"
}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}