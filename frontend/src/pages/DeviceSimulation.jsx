import React, { useState, useEffect } from 'react';
import { 
  getDeviceStatus,
  simulateAttendanceEvent,
  simulateAlarmEvent,
  updateDoorStatus,
  updateReaderStatus,
  updatePinpadStatus,
  updateBuzzerStatus,
  controlDoorLock,
  controlBuzzer
} from "../services/api";

const DeviceSimulation = () => {
  const [deviceStatus, setDeviceStatus] = useState({
    door: 'closed',
    reader: 'disconnected',
    pinpad: 'disconnected',
    buzzer: false
  });
  const [simulationResult, setSimulationResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [simulationConfig, setSimulationConfig] = useState({
    username: "Test User",
    access_id: "TEST001",
    door_id: "D01",
    buzzer_id: "B01",
    alarm_reason: "Test alarm simulation"
  });

  // Polling untuk status device
  useEffect(() => {
    const loadDeviceStatus = async () => {
      try {
        const status = await getDeviceStatus();
        setDeviceStatus(status);
        
        // Add to activity log
        setActivityLog(prev => [{
          type: 'status_poll',
          message: `Device status updated`,
          timestamp: new Date(),
          data: status
        }, ...prev.slice(0, 19)]); // Keep last 20 activities
      } catch (error) {
        console.error('Failed to load device status:', error);
      }
    };

    loadDeviceStatus();
    const interval = setInterval(loadDeviceStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const addToActivityLog = (type, message, data = null) => {
    setActivityLog(prev => [{
      type,
      message,
      timestamp: new Date(),
      data
    }, ...prev.slice(0, 19)]);
  };

  const simulateAttendance = async (direction = 'in') => {
    setIsSimulating(true);
    try {
      const testData = {
        username: simulationConfig.username,
        access_id: simulationConfig.access_id,
        status: "success",
        arrow: direction
      };
      
      const result = await simulateAttendanceEvent(testData);
      
      setSimulationResult({
        success: true,
        message: `✅ Attendance ${direction.toUpperCase()} simulated successfully for ${testData.username}`
      });
      
      addToActivityLog('attendance', `Simulated ${direction.toUpperCase()} for ${testData.username}`, testData);
      
    } catch (error) {
      setSimulationResult({
        success: false,
        message: `❌ Failed to simulate attendance: ${error.message}`
      });
      addToActivityLog('error', `Attendance simulation failed: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const simulateAlarm = async () => {
    setIsSimulating(true);
    try {
      const testData = {
        username: "Security System",
        access_id: simulationConfig.access_id,
        reason: simulationConfig.alarm_reason
      };
      
      const result = await simulateAlarmEvent(testData);
      
      setSimulationResult({
        success: true,
        message: `✅ Alarm simulated successfully: ${testData.reason}`
      });
      
      addToActivityLog('alarm', `Alarm triggered: ${testData.reason}`, testData);
      
    } catch (error) {
      setSimulationResult({
        success: false,
        message: `❌ Failed to simulate alarm: ${error.message}`
      });
      addToActivityLog('error', `Alarm simulation failed: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const simulateDeviceStatus = async (deviceType, status) => {
    setIsSimulating(true);
    try {
      let result;
      switch (deviceType) {
        case 'door':
          result = await updateDoorStatus(simulationConfig.door_id, status);
          setDeviceStatus(prev => ({ ...prev, door: status }));
          break;
        case 'reader':
          result = await updateReaderStatus('R01', status);
          setDeviceStatus(prev => ({ ...prev, reader: status }));
          break;
        case 'pinpad':
          result = await updatePinpadStatus('P01', status);
          setDeviceStatus(prev => ({ ...prev, pinpad: status }));
          break;
        case 'buzzer':
          const buzzerState = status === 'on';
          result = await updateBuzzerStatus(simulationConfig.buzzer_id, buzzerState);
          setDeviceStatus(prev => ({ ...prev, buzzer: buzzerState }));
          break;
        default:
          throw new Error('Unknown device type');
      }
      
      setSimulationResult({
        success: true,
        message: `✅ ${deviceType.toUpperCase()} status updated to: ${status}`
      });
      
      addToActivityLog('device_status', `${deviceType} set to ${status}`, { deviceType, status });
      
    } catch (error) {
      setSimulationResult({
        success: false,
        message: `❌ Failed to update ${deviceType} status: ${error.message}`
      });
      addToActivityLog('error', `Device status update failed: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const controlDevice = async (deviceType, command) => {
    setIsSimulating(true);
    try {
      let result;
      switch (deviceType) {
        case 'door':
          result = await controlDoorLock(simulationConfig.door_id, command);
          // Auto update status
          setTimeout(() => simulateDeviceStatus('door', command === 'unlock' ? 'open' : 'closed'), 1000);
          break;
        case 'buzzer':
          result = await controlBuzzer(simulationConfig.buzzer_id, command, 10);
          // Auto update status
          setTimeout(() => simulateDeviceStatus('buzzer', command === 'on' ? 'on' : 'off'), 1000);
          break;
        default:
          throw new Error('Unknown device type');
      }
      
      setSimulationResult({
        success: true,
        message: `✅ ${deviceType.toUpperCase()} control command sent: ${command}`
      });
      
      addToActivityLog('device_control', `${deviceType} command: ${command}`, { deviceType, command });
      
    } catch (error) {
      setSimulationResult({
        success: false,
        message: `❌ Failed to control ${deviceType}: ${error.message}`
      });
      addToActivityLog('error', `Device control failed: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const runCompleteScenario = async () => {
    setIsSimulating(true);
    try {
      addToActivityLog('scenario', 'Starting complete simulation scenario');
      
      // Step 1: Connect devices
      await simulateDeviceStatus('reader', 'connected');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await simulateDeviceStatus('pinpad', 'connected');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Simulate attendance IN
      await simulateAttendance('in');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Step 3: Open door
      await controlDevice('door', 'unlock');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Simulate attendance OUT
      await simulateAttendance('out');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Step 5: Trigger alarm
      await simulateAlarm();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 6: Activate buzzer
      await controlDevice('buzzer', 'on');
      
      setSimulationResult({
        success: true,
        message: '✅ Complete simulation scenario executed successfully!'
      });
      
      addToActivityLog('scenario', 'Complete simulation scenario finished');
      
    } catch (error) {
      setSimulationResult({
        success: false,
        message: `❌ Scenario failed: ${error.message}`
      });
      addToActivityLog('error', `Scenario failed: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const clearLogs = () => {
    setActivityLog([]);
    setSimulationResult(null);
  };

  const getStatusBadge = (status, type) => {
    const baseClass = "badge rounded-pill";
    
    if (type === 'door') {
      return status === 'open' ? `${baseClass} bg-warning` : `${baseClass} bg-success`;
    }
    
    if (type === 'buzzer') {
      return status ? `${baseClass} bg-danger` : `${baseClass} bg-secondary`;
    }
    
    return status === 'connected' ? `${baseClass} bg-success` : `${baseClass} bg-danger`;
  };

  const getStatusText = (status, type) => {
    if (type === 'door') {
      return status === 'open' ? '🚪 OPEN' : '🔒 CLOSED';
    }
    
    if (type === 'buzzer') {
      return status ? '🔊 ON' : '🔇 OFF';
    }
    
    return status === 'connected' ? '🟢 CONNECTED' : '🔴 DISCONNECTED';
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
      <div className="row">
        <div className="col-12">
          <h2>🎮 Device Simulation & Testing</h2>
          <p className="text-muted">Test and simulate all device operations via REST API</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="alert alert-success">
            <strong>🔗 Connection Status:</strong> REST API Connected
            <br />
            <small>Real-time device status polling active (5-second intervals)</small>
          </div>
        </div>
      </div>

      {/* Device Status Overview */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📊 Current Device Status</h5>
            </div>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-md-3">
                  <h6>Door Status</h6>
                  <span className={getStatusBadge(deviceStatus.door, 'door')}>
                    {getStatusText(deviceStatus.door, 'door')}
                  </span>
                </div>
                <div className="col-md-3">
                  <h6>Reader Status</h6>
                  <span className={getStatusBadge(deviceStatus.reader, 'reader')}>
                    {getStatusText(deviceStatus.reader, 'reader')}
                  </span>
                </div>
                <div className="col-md-3">
                  <h6>Pinpad Status</h6>
                  <span className={getStatusBadge(deviceStatus.pinpad, 'pinpad')}>
                    {getStatusText(deviceStatus.pinpad, 'pinpad')}
                  </span>
                </div>
                <div className="col-md-3">
                  <h6>Buzzer Status</h6>
                  <span className={getStatusBadge(deviceStatus.buzzer, 'buzzer')}>
                    {getStatusText(deviceStatus.buzzer, 'buzzer')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Left Column - Simulation Controls */}
        <div className="col-md-6">
          {/* Configuration */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">⚙️ Simulation Configuration</h6>
            </div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    value={simulationConfig.username}
                    onChange={(e) => setSimulationConfig(prev => ({...prev, username: e.target.value}))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Access ID</label>
                  <input
                    type="text"
                    className="form-control"
                    value={simulationConfig.access_id}
                    onChange={(e) => setSimulationConfig(prev => ({...prev, access_id: e.target.value}))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Alarm Reason</label>
                  <input
                    type="text"
                    className="form-control"
                    value={simulationConfig.alarm_reason}
                    onChange={(e) => setSimulationConfig(prev => ({...prev, alarm_reason: e.target.value}))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Attendance Simulation */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">📊 Attendance Simulation</h6>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <button
                  className="btn btn-success"
                  onClick={() => simulateAttendance('in')}
                  disabled={isSimulating}
                >
                  {isSimulating ? '⏳ Simulating...' : '✅ Simulate Check IN'}
                </button>
                <button
                  className="btn btn-info"
                  onClick={() => simulateAttendance('out')}
                  disabled={isSimulating}
                >
                  {isSimulating ? '⏳ Simulating...' : '↩️ Simulate Check OUT'}
                </button>
              </div>
            </div>
          </div>

          {/* Alarm Simulation */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">🚨 Alarm Simulation</h6>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <button
                  className="btn btn-danger"
                  onClick={simulateAlarm}
                  disabled={isSimulating}
                >
                  {isSimulating ? '⏳ Triggering...' : '🚨 Trigger Alarm'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Device Controls */}
        <div className="col-md-6">
          {/* Device Status Control */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">🔧 Device Status Control</h6>
            </div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-6">
                  <button
                    className="btn btn-outline-success w-100"
                    onClick={() => simulateDeviceStatus('reader', 'connected')}
                    disabled={isSimulating}
                  >
                    📋 Connect Reader
                  </button>
                </div>
                <div className="col-6">
                  <button
                    className="btn btn-outline-danger w-100"
                    onClick={() => simulateDeviceStatus('reader', 'disconnected')}
                    disabled={isSimulating}
                  >
                    📋 Disconnect Reader
                  </button>
                </div>
                <div className="col-6">
                  <button
                    className="btn btn-outline-success w-100"
                    onClick={() => simulateDeviceStatus('pinpad', 'connected')}
                    disabled={isSimulating}
                  >
                    ⌨️ Connect Pinpad
                  </button>
                </div>
                <div className="col-6">
                  <button
                    className="btn btn-outline-danger w-100"
                    onClick={() => simulateDeviceStatus('pinpad', 'disconnected')}
                    disabled={isSimulating}
                  >
                    ⌨️ Disconnect Pinpad
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Device Control */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">🎛️ Device Control</h6>
            </div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-6">
                  <button
                    className="btn btn-warning w-100"
                    onClick={() => controlDevice('door', 'unlock')}
                    disabled={isSimulating || deviceStatus.door === 'open'}
                  >
                    🔓 Unlock Door
                  </button>
                </div>
                <div className="col-6">
                  <button
                    className="btn btn-secondary w-100"
                    onClick={() => controlDevice('door', 'lock')}
                    disabled={isSimulating || deviceStatus.door === 'closed'}
                  >
                    🔒 Lock Door
                  </button>
                </div>
                <div className="col-6">
                  <button
                    className="btn btn-danger w-100"
                    onClick={() => controlDevice('buzzer', 'on')}
                    disabled={isSimulating || deviceStatus.buzzer}
                  >
                    🔊 Buzzer ON
                  </button>
                </div>
                <div className="col-6">
                  <button
                    className="btn btn-outline-secondary w-100"
                    onClick={() => controlDevice('buzzer', 'off')}
                    disabled={isSimulating || !deviceStatus.buzzer}
                  >
                    🔇 Buzzer OFF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Complete Scenario */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">🎭 Complete Scenario</h6>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary"
                  onClick={runCompleteScenario}
                  disabled={isSimulating}
                >
                  {isSimulating ? '⏳ Running Scenario...' : '🎬 Run Complete Scenario'}
                </button>
                <small className="text-muted text-center">
                  Connects devices → Check IN → Open door → Check OUT → Trigger alarm → Activate buzzer
                </small>
              </div>
            </div>
          </div>

          {/* Simulation Result */}
          {simulationResult && (
            <div className={`alert ${simulationResult.success ? 'alert-success' : 'alert-danger'}`}>
              {simulationResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">📋 Activity Log</h6>
              <button className="btn btn-sm btn-outline-secondary" onClick={clearLogs}>
                🗑️ Clear Log
              </button>
            </div>
            <div className="card-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {activityLog.length === 0 ? (
                <p className="text-muted text-center mb-0">No activities yet. Start simulating to see logs.</p>
              ) : (
                activityLog.map((log, index) => (
                  <div key={index} className="border-bottom pb-2 mb-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <small className="text-muted">[{formatTime(log.timestamp)}]</small>
                        <br />
                        <span>
                          {log.type === 'attendance' && '📊 '}
                          {log.type === 'alarm' && '🚨 '}
                          {log.type === 'device_status' && '🔧 '}
                          {log.type === 'device_control' && '🎛️ '}
                          {log.type === 'status_poll' && '🔄 '}
                          {log.type === 'scenario' && '🎭 '}
                          {log.type === 'error' && '❌ '}
                          {log.message}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Information */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">🔗 REST API Endpoints</h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6>Status Endpoints:</h6>
                  <ul className="small">
                    <li><code>GET /api/device/status</code> - Get all device status</li>
                    <li><code>POST /api/device/status/door</code> - Update door status</li>
                    <li><code>POST /api/device/status/reader</code> - Update reader status</li>
                    <li><code>POST /api/device/status/pinpad</code> - Update pinpad status</li>
                    <li><code>POST /api/device/status/buzzer</code> - Update buzzer status</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>Event Endpoints:</h6>
                  <ul className="small">
                    <li><code>POST /api/device/events/attendance</code> - Simulate attendance</li>
                    <li><code>POST /api/device/events/alarm</code> - Simulate alarm</li>
                    <li><code>POST /api/control/doorlock</code> - Control door lock</li>
                    <li><code>POST /api/control/buzzer</code> - Control buzzer</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceSimulation;