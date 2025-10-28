import React, { createContext, useContext, useEffect, useState } from 'react';
import mqtt from 'mqtt';

// --- KONFIGURASI MQTT ---
// Ganti ini dengan URL broker MQTT Anda
// Gunakan 'ws://' untuk koneksi non-SSL atau 'wss://' untuk SSL
// Port 9001 adalah port default umum untuk MQTT over WebSockets
const MQTT_BROKER_URL = 'ws://localhost:9001'; 

const MQTT_CLIENT_ID = `smartdoor_webapp_${Math.random().toString(16).substring(2, 8)}`;

const MQTTContext = createContext();

export const MQTTProvider = ({ children }) => {
  const [client, setClient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  useEffect(() => {
    console.log('Connecting to MQTT broker...');
    setConnectionStatus('Connecting...');
    
    // Ganti ini jika broker Anda butuh username/password
    const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
      clientId: MQTT_CLIENT_ID,
      // username: 'your-username',
      // password: 'your-password',
    });

    mqttClient.on('connect', () => {
      console.log('✅ MQTT Client Connected');
      setConnectionStatus('Connected');
      setClient(mqttClient);
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
      setConnectionStatus('Error');
      mqttClient.end();
    });

    mqttClient.on('reconnect', () => {
      setConnectionStatus('Reconnecting...');
    });

    mqttClient.on('close', () => {
      console.log('MQTT Client Disconnected');
      setConnectionStatus('Disconnected');
    });

    // Cleanup on unmount
    return () => {
      if (mqttClient) {
        mqttClient.end();
      }
    };
  }, []);

  return (
    <MQTTContext.Provider value={{ client, connectionStatus }}>
      {children}
    </MQTTContext.Provider>
  );
};

// Custom hook untuk mengakses client dan status
export const useMQTT = () => {
  return useContext(MQTTContext);
};
