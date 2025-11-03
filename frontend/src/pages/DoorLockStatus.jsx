import { useEffect, useState } from "react";
import { controlDoorLock, controlBuzzer, mqttService } from "../services/api";

export default function DoorLockStatus() {
  const [doorStatus, setDoorStatus] = useState({
    door: 'closed',
    reader: 'disconnected', 
    pinpad: 'disconnected'
  });
  const [buzzerState, setBuzzerState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const initializeMQTT = async () => {
      try {
        await mqttService.connect();
        setConnectionStatus(true);
        
        // Subscribe ke topic yang SESUAI dengan test client
        mqttService.subscribe("doorlock/status/reader", (message) => {
          console.log('📋 Reader status received:', message);
          setMessages(prev => [...prev, `Reader: ${message}`]);
          
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            setDoorStatus(prev => ({ 
              ...prev, 
              reader: data.status || data.state || 'connected' 
            }));
          } catch {
            // Handle plain string message seperti "status: connected"
            if (typeof message === 'string') {
              if (message.includes('connected')) {
                setDoorStatus(prev => ({ ...prev, reader: 'connected' }));
              } else if (message.includes('disconnected')) {
                setDoorStatus(prev => ({ ...prev, reader: 'disconnected' }));
              }
            }
          }
        });

        // Subscribe ke topic door status jika ada
        mqttService.subscribe("doorlock/status/door", (message) => {
          console.log('🚪 Door status received:', message);
          setMessages(prev => [...prev, `Door: ${message}`]);
          
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            setDoorStatus(prev => ({ 
              ...prev, 
              door: data.status || data.state || 'closed' 
            }));
          } catch {
            if (typeof message === 'string') {
              if (message.includes('open')) {
                setDoorStatus(prev => ({ ...prev, door: 'open' }));
              } else if (message.includes('closed')) {
                setDoorStatus(prev => ({ ...prev, door: 'closed' }));
              }
            }
          }
        });

        // Subscribe ke topic pinpad status jika ada
        mqttService.subscribe("doorlock/status/pinpad", (message) => {
          console.log('⌨️ Pinpad status received:', message);
          setMessages(prev => [...prev, `Pinpad: ${message}`]);
          
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            setDoorStatus(prev => ({ 
              ...prev, 
              pinpad: data.status || data.state || 'disconnected' 
            }));
          } catch {
            if (typeof message === 'string') {
              if (message.includes('connected')) {
                setDoorStatus(prev => ({ ...prev, pinpad: 'connected' }));
              } else if (message.includes('disconnected')) {
                setDoorStatus(prev => ({ ...prev, pinpad: 'disconnected' }));
              }
            }
          }
        });

        // Subscribe ke buzzer status
        mqttService.subscribe("buzzer/status", (message) => {
          console.log('🔊 Buzzer status received:', message);
          setMessages(prev => [...prev, `Buzzer: ${message}`]);
          
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            setBuzzerState(data.status === 'on' || data.state === 'on');
          } catch {
            if (typeof message === 'string') {
              setBuzzerState(message.includes('on'));
            }
          }
        });

        // Subscribe ke SEMUA topic untuk debugging
        mqttService.subscribe("#", (message) => {
          console.log('🔍 ALL MQTT Messages:', message);
        });

      } catch {
        console.error('Failed to initialize MQTT');
        setConnectionStatus(false);
      }
    };

    initializeMQTT();

    // Cleanup
    return () => {
      mqttService.unsubscribe("doorlock/status/reader");
      mqttService.unsubscribe("doorlock/status/door");
      mqttService.unsubscribe("doorlock/status/pinpad");
      mqttService.unsubscribe("buzzer/status");
      mqttService.unsubscribe("#");
    };
  }, []);

  const handleOpenDoor = async () => {
    try {
      setLoading(true);
      
      // Gunakan topic yang SESUAI: doorlock/D01/control (bukan doorlock/D1/control)
      const success = mqttService.publish("doorlock/D01/control", JSON.stringify({
        command: 'unlock',
        door_id: 'D01',
        timestamp: new Date().toISOString()
      }));
      
      if (success) {
        alert('🚪 Door unlock command sent to D01!');
        setMessages(prev => [...prev, 'Sent: doorlock/D01/control unlock']);
      } else {
        // Fallback ke HTTP API
        await controlDoorLock('D01', 'unlock');
        alert('⚠️ Door command sent via HTTP (MQTT failed)');
      }
      
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
      
      // Gunakan topic yang SESUAI: buzzer/B01/control
      const success = mqttService.publish("buzzer/B01/control", JSON.stringify({
        command: command,
        buzzer_id: 'B01',
        duration: newBuzzerState ? 10 : 0,
        timestamp: new Date().toISOString()
      }));
      
      if (success) {
        setBuzzerState(newBuzzerState);
        alert(`🔊 Buzzer ${command} command sent to B01!`);
        setMessages(prev => [...prev, `Sent: buzzer/B01/control ${command}`]);
      } else {
        // Fallback ke HTTP API
        await controlBuzzer('B01', command, newBuzzerState ? 10 : 0);
        alert(`⚠️ Buzzer command sent via HTTP (MQTT failed)`);
      }
      
    } catch (error) {
      alert(`❌ Failed to control buzzer: ${error.message}`);
    } finally {
      setLoading(false);
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

  return (
    <div className="container py-4">
      <h2>🚪 Door Lock Status & Control</h2>
      
      {/* Connection Status */}
      <div className="row mb-4">
        <div className="col-12">
          <div className={`alert ${connectionStatus ? 'alert-success' : 'alert-warning'}`}>
            <strong>MQTT Status:</strong> {connectionStatus ? '🟢 CONNECTED' : '🟡 CONNECTING...'}
            <br />
            <small>Subscribed to: doorlock/status/reader, doorlock/D01/control, buzzer/B01/control</small>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="row mt-4">
        <div className="col-md-4">
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
        
        <div className="col-md-4">
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
        
        <div className="col-md-4">
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
      </div>

      {/* Control Buttons */}
      <div className="row mt-4">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">🔓 Door Control (D01)</h5>
            </div>
            <div className="card-body text-center">
              <button
                className="btn btn-success btn-lg w-100"
                onClick={handleOpenDoor}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Opening...
                  </>
                ) : (
                  '🚪 OPEN DOOR D01'
                )}
              </button>
              <small className="text-muted mt-2 d-block">
                Topic: doorlock/D01/control
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-6">
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
                Topic: buzzer/B01/control | Status: {buzzerState ? 'ON' : 'OFF'}
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
              <h6 className="mb-0">📨 MQTT Message Log</h6>
              <button className="btn btn-sm btn-outline-secondary" onClick={clearMessages}>
                Clear
              </button>
            </div>
            <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {messages.length === 0 ? (
                <p className="text-muted mb-0">No messages received yet...</p>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className="border-bottom pb-2 mb-2">
                    <small className="text-muted">[{new Date().toLocaleTimeString()}]</small>
                    <br />
                    <code>{msg}</code>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current State Debug */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">🔧 Current State</h6>
            </div>
            <div className="card-body">
              <pre className="mb-0">
                {JSON.stringify({
                  connectionStatus,
                  doorStatus,
                  buzzerState,
                  loading,
                  subscribedTopics: [
                    'doorlock/status/reader',
                    'doorlock/status/door', 
                    'doorlock/status/pinpad',
                    'buzzer/status',
                    '#' // all topics for debug
                  ]
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}