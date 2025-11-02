import { useEffect, useState } from "react";
import { controlDoorLock, controlBuzzer, mqttService } from "../services/api";

export default function DoorLockStatus() {
  const [doorStatus, setDoorStatus] = useState({
    door: 'closed',
    reader: 'connected', 
    pinpad: 'connected'
  });
  const [buzzerState, setBuzzerState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(false);

  useEffect(() => {
    const initializeMQTT = async () => {
      try {
        await mqttService.connect();
        setConnectionStatus(true);
        
        // Subscribe to status topics
        mqttService.subscribe("doorlock/status/door", (message) => {
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            console.log('🚪 Door status:', data);
            setDoorStatus(prev => ({ ...prev, door: data.state || data.status || 'closed' }));
          } catch (error) {
            console.error('Error parsing door status:', error);
          }
        });

        mqttService.subscribe("doorlock/status/reader", (message) => {
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            console.log('📋 Reader status:', data);
            setDoorStatus(prev => ({ ...prev, reader: data.state || data.status || 'disconnected' }));
          } catch (error) {
            console.error('Error parsing reader status:', error);
          }
        });

        mqttService.subscribe("doorlock/status/pinpad", (message) => {
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            console.log('⌨️ Pinpad status:', data);
            setDoorStatus(prev => ({ ...prev, pinpad: data.state || data.status || 'disconnected' }));
          } catch (error) {
            console.error('Error parsing pinpad status:', error);
          }
        });

        mqttService.subscribe("buzzer/status", (message) => {
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            console.log('🔊 Buzzer status:', data);
            setBuzzerState(data.state === 'on' || data.status === 'on');
          } catch (error) {
            console.error('Error parsing buzzer status:', error);
          }
        });

        // Subscribe to all status messages for debugging
        mqttService.subscribe("doorlock/status/#", (message) => {
          console.log('🔍 All status message:', message);
        });

      } catch (error) {
        console.error('Failed to initialize MQTT:', error);
        setConnectionStatus(false);
      }
    };

    initializeMQTT();

    // Cleanup
    return () => {
      mqttService.unsubscribe("doorlock/status/door");
      mqttService.unsubscribe("doorlock/status/reader");
      mqttService.unsubscribe("doorlock/status/pinpad");
      mqttService.unsubscribe("buzzer/status");
      mqttService.unsubscribe("doorlock/status/#");
    };
  }, []);

  const handleOpenDoor = async () => {
    try {
      setLoading(true);
      
      // Send via HTTP API (fallback)
      await controlDoorLock('D01', 'unlock');
      
      // Also send via MQTT for real-time
      const success = mqttService.publish("doorlock/D01/control", JSON.stringify({
        command: 'unlock',
        timestamp: new Date().toISOString()
      }));
      
      alert(success ? '🚪 Door unlock command sent!' : '⚠️ Command sent via HTTP (MQTT failed)');
      
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
      
      // Send via HTTP API (fallback)
      await controlBuzzer('B01', command, newBuzzerState ? 10 : 0);
      
      // Also send via MQTT for real-time
      const success = mqttService.publish("buzzer/B01/control", JSON.stringify({
        command: command,
        duration: newBuzzerState ? 10 : 0,
        timestamp: new Date().toISOString()
      }));
      
      if (success) {
        setBuzzerState(newBuzzerState);
        alert(`🔊 Buzzer ${command} command sent!`);
      } else {
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

  return (
    <div className="container py-4">
      <h2>🚪 Door Lock Status & Control</h2>
      
      {/* Connection Status */}
      <div className="row mb-4">
        <div className="col-12">
          <div className={`alert ${connectionStatus ? 'alert-success' : 'alert-warning'}`}>
            <strong>MQTT Status:</strong> {connectionStatus ? '🟢 CONNECTED' : '🟡 CONNECTING...'}
            {!connectionStatus && (
              <div>
                <small>Make sure Mosquitto MQTT is running on port 9001</small>
              </div>
            )}
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
              <h5 className="mb-0">🔓 Door Control</h5>
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
                  '🚪 OPEN DOOR'
                )}
              </button>
              <small className="text-muted mt-2 d-block">
                Click to unlock and open the door
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">🚨 Buzzer Control</h5>
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
                {buzzerState ? 'Buzzer is currently ON' : 'Buzzer is currently OFF'}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h6>Debug Information</h6>
            </div>
            <div className="card-body">
              <pre className="mb-0">
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
  );
}