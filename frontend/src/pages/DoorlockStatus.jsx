import React, { useState, useEffect } from 'react';
import { useMQTT } from '../hooks/useMQTT';
import { Wifi, WifiOff, DoorClosed, DoorOpen, ShieldCheck, ShieldAlert, Key } from 'react-bootstrap-icons';

// === KONFIGURASI TOPIK ===
// Topik untuk mem-publish (Web -> Alat)
const TOPIC_PUB_DOOR = 'doorlock/D01/control/door'; // (Ganti D01 jika perlu)
const TOPIC_PUB_BUZZER = 'doorlock/D01/control/buzzer';

// Topik untuk me-listen (Alat -> Web)
const TOPIC_SUB_DOOR = 'doorlock/D01/status/door';
const TOPIC_SUB_READER = 'doorlock/D01/status/reader';
const TOPIC_SUB_PINPAD = 'doorlock/D01/status/pinpad';

// Komponen Indikator
const StatusIndicator = ({ label, status, statusText }) => {
  let Icon = ShieldAlert;
  let color = 'text-danger';

  if (status === 'Connected' || status === 'Closed') {
    Icon = status === 'Closed' ? DoorClosed : ShieldCheck;
    color = 'text-success';
  } else if (status === 'Open') {
    Icon = DoorOpen;
    color = 'text-warning';
  }

  return (
    <div className="d-flex align-items-center mb-2">
      <Icon className={`me-2 ${color}`} size={24} />
      <span className="fs-5">{label}: </span>
      <span className={`fs-5 ms-2 fw-bold ${color}`}>{statusText || status}</span>
    </div>
  );
};

export default function DoorlockStatus() {
  const { client, connectionStatus } = useMQTT();

  // State untuk indikator
  const [doorStatus, setDoorStatus] = useState('Unknown'); // Open, Closed
  const [readerStatus, setReaderStatus] = useState('Unknown'); // Connected, Disconnected
  const [pinpadStatus, setPinpadStatus] = useState('Unknown'); // Connected, Disconnected
  const [isBuzzerOn, setIsBuzzerOn] = useState(false);

  // Efek untuk subscribe ke topik status
  useEffect(() => {
    if (!client || connectionStatus !== 'Connected') return;

    // Fungsi untuk menangani pesan masuk
    const handleMessage = (topic, message) => {
      const payload = message.toString();
      console.log(`MQTT Message: ${topic} -> ${payload}`);
      
      try {
        const data = JSON.parse(payload);
        
        if (topic === TOPIC_SUB_DOOR) {
          setDoorStatus(data.status); // e.g., "Open" or "Closed"
        }
        if (topic === TOPIC_SUB_READER) {
          setReaderStatus(data.status); // e.g., "Connected" or "Disconnected"
        }
        if (topic === TOPIC_SUB_PINPAD) {
          setPinpadStatus(data.status); // e.g., "Connected" or "Disconnected"
        }
      } catch (err) {
        // Handle non-JSON payload
        if (topic === TOPIC_SUB_DOOR) setDoorStatus(payload);
        if (topic === TOPIC_SUB_READER) setReaderStatus(payload);
        if (topic === TOPIC_SUB_PINPAD) setPinpadStatus(payload);
      }
    };
    
    // Subscribe ke semua topik status
    client.subscribe([TOPIC_SUB_DOOR, TOPIC_SUB_READER, TOPIC_SUB_PINPAD], (err) => {
      if (err) console.error('Failed to subscribe to status topics', err);
    });

    client.on('message', handleMessage);

    // Cleanup: Unsubscribe dan hapus listener
    return () => {
      if (client) {
        client.unsubscribe([TOPIC_SUB_DOOR, TOPIC_SUB_READER, TOPIC_SUB_PINPAD]);
        client.off('message', handleMessage);
      }
    };
  }, [client, connectionStatus]);

  // Handler Tombol
  const handleOpenDoor = () => {
    if (client) {
      const payload = JSON.stringify({ command: 'unlock', source: 'webapp' });
      client.publish(TOPIC_PUB_DOOR, payload);
      console.log(`MQTT Publish: ${TOPIC_PUB_DOOR} -> ${payload}`);
    }
  };

  const handleToggleBuzzer = () => {
    if (client) {
      const newBuzzerState = !isBuzzerOn;
      const command = newBuzzerState ? 'on' : 'off';
      const payload = JSON.stringify({ command: command, duration: (newBuzzerState ? 30 : 0), source: 'webapp' }); 
      
      client.publish(TOPIC_PUB_BUZZER, payload);
      console.log(`MQTT Publish: ${TOPIC_PUB_BUZZER} -> ${payload}`);
      setIsBuzzerOn(newBuzzerState);
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>🚪 Door Lock Status</h2>
        <div className={`badge ${connectionStatus === 'Connected' ? 'bg-success' : 'bg-danger'}`}>
          {connectionStatus === 'Connected' ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span className="ms-2">{connectionStatus}</span>
        </div>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-header">
          <h5 className="mb-0">Device Status Indicators</h5>
        </div>
        <div className="card-body">
          <StatusIndicator label="Door" status={doorStatus} />
          <StatusIndicator label="Card Reader" status={readerStatus} />
          <StatusIndicator label="PIN Pad" status={pinpadStatus} />
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header">
          <h5 className="mb-0">Remote Control</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <button 
                className="btn btn-primary w-100 p-3" 
                onClick={handleOpenDoor}
                disabled={connectionStatus !== 'Connected'}
              >
                <Key size={20} className="me-2" />
                Trigger Open Door
              </button>
            </div>
            <div className="col-12 col-md-6">
              <div className="form-check form-switch form-check-lg p-0">
                <button 
                  className={`btn w-100 p-3 ${isBuzzerOn ? 'btn-danger' : 'btn-outline-danger'}`}
                  onClick={handleToggleBuzzer}
                  disabled={connectionStatus !== 'Connected'}
                >
                  {isBuzzerOn ? '🔊 Silence Buzzer' : '🔊 Sound The Buzzer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}