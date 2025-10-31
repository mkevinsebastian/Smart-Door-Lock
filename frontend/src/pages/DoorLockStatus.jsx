import { useEffect, useState } from "react";
import { controlDoorLock, controlBuzzer, mqttService } from "../services/api";

export default function DoorLockStatus() {
  const [doorStatus, setDoorStatus] = useState({
    door: 'closed', // 'open' or 'closed'
    reader: 'connected', // 'connected' or 'disconnected'
    pinpad: 'connected' // 'connected' or 'disconnected'
  });
  const [buzzerState, setBuzzerState] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize MQTT connection and listeners
    mqttService.connect().then(() => {
      // Listen for door status updates
      mqttService.subscribe("doorlock/status/door", (message) => {
        try {
          const status = JSON.parse(message);
          setDoorStatus(prev => ({
            ...prev,
            door: status.state
          }));
        } catch (error) {
          console.error('Error parsing door status:', error);
        }
      });

      // Listen for reader status updates
      mqttService.subscribe("doorlock/status/reader", (message) => {
        try {
          const status = JSON.parse(message);
          setDoorStatus(prev => ({
            ...prev,
            reader: status.state
          }));
        } catch (error) {
          console.error('Error parsing reader status:', error);
        }
      });

      // Listen for pinpad status updates
      mqttService.subscribe("doorlock/status/pinpad", (message) => {
        try {
          const status = JSON.parse(message);
          setDoorStatus(prev => ({
            ...prev,
            pinpad: status.state
          }));
        } catch (error) {
          console.error('Error parsing pinpad status:', error);
        }
      });

      // Listen for buzzer status updates
      mqttService.subscribe("buzzer/status", (message) => {
        try {
          const status = JSON.parse(message);
          setBuzzerState(status.state === 'on');
        } catch (error) {
          console.error('Error parsing buzzer status:', error);
        }
      });

    }).catch(err => {
      console.error('MQTT connection failed:', err);
    });

    return () => {
      // Cleanup MQTT listeners
      mqttService.unsubscribe("doorlock/status/door");
      mqttService.unsubscribe("doorlock/status/reader");
      mqttService.unsubscribe("doorlock/status/pinpad");
      mqttService.unsubscribe("buzzer/status");
    };
  }, []);

  const handleOpenDoor = async () => {
    try {
      setLoading(true);
      await controlDoorLock('D01', 'unlock');
      
      // Also publish MQTT message for real-time control
      mqttService.publish("doorlock/D01/control", JSON.stringify({
        command: 'unlock',
        timestamp: new Date().toISOString()
      }));
      
      alert('Door unlock command sent!');
    } catch (error) {
      alert(`Failed to open door: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBuzzer = async () => {
    try {
      setLoading(true);
      const newBuzzerState = !buzzerState;
      const command = newBuzzerState ? 'on' : 'off';
      const duration = newBuzzerState ? 10 : 0;
      
      await controlBuzzer('B01', command, duration);
      
      // Also publish MQTT message for real-time control
      mqttService.publish("buzzer/B01/control", JSON.stringify({
        command: command,
        duration: duration,
        timestamp: new Date().toISOString()
      }));
      
      setBuzzerState(newBuzzerState);
      alert(`Buzzer ${command} command sent!`);
    } catch (error) {
      alert(`Failed to control buzzer: ${error.message}`);
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

      {/* Connection Status */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="mb-1">MQTT Connection</h6>
                  <small className="text-muted">Real-time communication status</small>
                </div>
                <span className={`badge ${mqttService.isConnected ? 'bg-success' : 'bg-danger'}`}>
                  {mqttService.isConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}