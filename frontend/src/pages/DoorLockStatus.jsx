import { useEffect, useState } from "react";
import { controlDoorLock, controlBuzzer, mqttService, MQTT_TOPICS } from "../services/api";

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
        
        console.log('🚪 DoorLockStatus MQTT listeners activated');

        // Subscribe to reader status
        mqttService.subscribe(MQTT_TOPICS.READER_STATUS, (message) => {
          console.log('📋 Reader status received:', message);
          setMessages(prev => [...prev, {type: 'reader', message, timestamp: new Date()}]);
          
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            const status = data.status || data.state || message;
            setDoorStatus(prev => ({ ...prev, reader: status }));
          } catch {
            // Handle plain string
            if (typeof message === 'string') {
              setDoorStatus(prev => ({ ...prev, reader: message }));
            }
          }
        });

        // Subscribe to door status
        mqttService.subscribe(MQTT_TOPICS.DOOR_STATUS, (message) => {
          console.log('🚪 Door status received:', message);
          setMessages(prev => [...prev, {type: 'door', message, timestamp: new Date()}]);
          
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            const status = data.state || data.status || message;
            setDoorStatus(prev => ({ ...prev, door: status }));
          } catch {
            if (typeof message === 'string') {
              setDoorStatus(prev => ({ ...prev, door: message }));
            }
          }
        });

        // Subscribe to pinpad status
        mqttService.subscribe(MQTT_TOPICS.PINPAD_STATUS, (message) => {
          console.log('⌨️ Pinpad status received:', message);
          setMessages(prev => [...prev, {type: 'pinpad', message, timestamp: new Date()}]);
          
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            const status = data.status || data.state || message;
            setDoorStatus(prev => ({ ...prev, pinpad: status }));
          } catch {
            if (typeof message === 'string') {
              setDoorStatus(prev => ({ ...prev, pinpad: message }));
            }
          }
        });

        // Subscribe to buzzer status
        mqttService.subscribe(MQTT_TOPICS.BUZZER_STATUS, (message) => {
          console.log('🔊 Buzzer status received:', message);
          setMessages(prev => [...prev, {type: 'buzzer', message, timestamp: new Date()}]);
          
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            const status = data.state || data.status || message;
            setBuzzerState(status === 'on' || status === true);
          } catch {
            if (typeof message === 'string') {
              setBuzzerState(message === 'on');
            }
          }
        });

        // Subscribe to all status topics for debugging
        mqttService.subscribe("doorlock/status/#", (message) => {
          console.log('🔍 All doorlock status:', message);
        });

      } catch (error) {
        console.error('Failed to initialize MQTT:', error);
        setConnectionStatus(false);
      }
    };

    initializeMQTT();

    // Cleanup
    return () => {
      mqttService.unsubscribe(MQTT_TOPICS.READER_STATUS);
      mqttService.unsubscribe(MQTT_TOPICS.DOOR_STATUS);
      mqttService.unsubscribe(MQTT_TOPICS.PINPAD_STATUS);
      mqttService.unsubscribe(MQTT_TOPICS.BUZZER_STATUS);
      mqttService.unsubscribe("doorlock/status/#");
    };
  }, []);

  const handleOpenDoor = async () => {
    try {
      setLoading(true);
      
      const message = {
        command: 'unlock',
        door_id: 'D01',
        timestamp: new Date().toISOString()
      };
      
      const success = mqttService.publish(MQTT_TOPICS.DOOR_CONTROL, message);
      
      if (success) {
        alert('🚪 Door unlock command sent to D01!');
        setMessages(prev => [...prev, {type: 'sent', message: 'doorlock/D01/control unlock', timestamp: new Date()}]);
      } else {
        // Fallback to HTTP API
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
      
      const message = {
        command: command,
        buzzer_id: 'B01',
        duration: newBuzzerState ? 10 : 0,
        timestamp: new Date().toISOString()
      };
      
      const success = mqttService.publish(MQTT_TOPICS.BUZZER_CONTROL, message);
      
      if (success) {
        setBuzzerState(newBuzzerState);
        alert(`🔊 Buzzer ${command} command sent to B01!`);
        setMessages(prev => [...prev, {type: 'sent', message: `buzzer/B01/control ${command}`, timestamp: new Date()}]);
      } else {
        // Fallback to HTTP API
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

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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
            <small>Using Paho MQTT Library • Subscribed to all status topics</small>
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
                Topic: {MQTT_TOPICS.DOOR_CONTROL}
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
                Topic: {MQTT_TOPICS.BUZZER_CONTROL} | Status: {buzzerState ? 'ON' : 'OFF'}
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
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <small className="text-muted">[{formatTime(msg.timestamp)}]</small>
                        <br />
                        <code>
                          {msg.type === 'reader' && '📋 '}
                          {msg.type === 'door' && '🚪 '}
                          {msg.type === 'pinpad' && '⌨️ '}
                          {msg.type === 'buzzer' && '🔊 '}
                          {msg.type === 'sent' && '📤 '}
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
              <h6 className="mb-0">🔧 Debug Information</h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6>Subscribed Topics:</h6>
                  <ul className="small">
                    <li><code>{MQTT_TOPICS.READER_STATUS}</code></li>
                    <li><code>{MQTT_TOPICS.DOOR_STATUS}</code></li>
                    <li><code>{MQTT_TOPICS.PINPAD_STATUS}</code></li>
                    <li><code>{MQTT_TOPICS.BUZZER_STATUS}</code></li>
                    <li><code>doorlock/status/#</code></li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>Current State:</h6>
                  <pre className="small">
{JSON.stringify({
  connectionStatus,
  doorStatus,
  buzzerState,
  loading
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