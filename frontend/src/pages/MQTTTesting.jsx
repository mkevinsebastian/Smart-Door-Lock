import React, { useState, useEffect } from 'react';
import { 
  testMQTTConnection,
  testMQTTPublish,
  mqttService,
  MQTT_TOPICS 
} from "../services/api";

const InternalMQTTTest = () => {
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [customTopic, setCustomTopic] = useState('doorlock/test');
  const [customMessage, setCustomMessage] = useState('{"message": "Hello from React"}');

  // Monitor connection status
  useEffect(() => {
    const checkConnection = () => {
      setConnectionStatus(mqttService.getConnectionStatus());
    };

    // Check every 2 seconds
    const interval = setInterval(checkConnection, 1000);
    checkConnection(); // Initial check

    return () => clearInterval(interval);
  }, []);

  // Subscribe to receive messages
  useEffect(() => {
    const handleInternalMessage = (payload, topic) => {
      try {
        const message = typeof payload === 'string' ? JSON.parse(payload) : payload;
        setReceivedMessages(prev => [{
          topic,
          data: message,
          timestamp: new Date().toLocaleTimeString(),
          direction: 'INCOMING'
        }, ...prev.slice(0, 9)]); // Keep last 10 messages
      } catch (error) {
        setReceivedMessages(prev => [{
          topic,
          data: payload,
          timestamp: new Date().toLocaleTimeString(),
          direction: 'INCOMING'
        }, ...prev.slice(0, 9)]);
      }
    };

    // Subscribe to test topics
    mqttService.subscribe('doorlock/#', handleInternalMessage);
    mqttService.subscribe('test/#', handleInternalMessage);

    return () => {
      mqttService.unsubscribe('doorlock/#', handleInternalMessage);
      mqttService.unsubscribe('test/#', handleInternalMessage);
    };
  }, []);

  const connectToInternal = async () => {
    setIsTesting(true);
    try {
      const result = await testMQTTConnection();
      setTestResult(result);
      setConnectionStatus(mqttService.getConnectionStatus());
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ Gagal connect: ${error.message}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const runInternalTest = async () => {
    if (!connectionStatus) {
      setTestResult({
        success: false,
        message: '❌ Belum terhubung ke MQTT'
      });
      return;
    }

    setIsTesting(true);
    try {
      const testMessage = {
        type: 'internal_test',
        message: 'Testing MQTT connection',
        timestamp: new Date().toISOString(),
        source: 'react_app'
      };

      const result = await testMQTTPublish('doorlock/test', testMessage);
      setTestResult(result);

      // Add to received messages as outgoing
      if (result.success) {
        setReceivedMessages(prev => [{
          topic: 'doorlock/test',
          data: testMessage,
          timestamp: new Date().toLocaleTimeString(),
          direction: 'OUTGOING'
        }, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ Test gagal: ${error.message}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const publishCustomMessage = async () => {
    if (!connectionStatus) {
      setTestResult({
        success: false,
        message: '❌ Belum terhubung ke MQTT'
      });
      return;
    }

    try {
      let messageData;
      try {
        messageData = JSON.parse(customMessage);
      } catch {
        messageData = { message: customMessage };
      }

      const success = mqttService.publish(customTopic, messageData);
      
      if (success) {
        setTestResult({
          success: true,
          message: `✅ Pesan dikirim ke: ${customTopic}`
        });

        // Add to received messages
        setReceivedMessages(prev => [{
          topic: customTopic,
          data: messageData,
          timestamp: new Date().toLocaleTimeString(),
          direction: 'OUTGOING'
        }, ...prev.slice(0, 9)]);
      } else {
        setTestResult({
          success: false,
          message: '❌ Gagal mengirim pesan'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ Error: ${error.message}`
      });
    }
  };

  const simulateDoorEvents = async () => {
    if (!connectionStatus) return;

    const events = [
      {
        topic: 'doorlock/status/door1',
        data: {
          door_id: 'door1',
          status: 'OPEN',
          user: 'john_doe',
          timestamp: new Date().toISOString()
        }
      },
      {
        topic: 'attendance/new',
        data: {
          user_id: 'user123',
          name: 'John Doe',
          timestamp: new Date().toISOString(),
          status: 'IN'
        }
      }
    ];

    for (const event of events) {
      mqttService.publish(event.topic, event.data);
      
      setReceivedMessages(prev => [{
        topic: event.topic,
        data: event.data,
        timestamp: new Date().toLocaleTimeString(),
        direction: 'OUTGOING'
      }, ...prev.slice(0, 9)]);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setTestResult({
      success: true,
      message: '✅ Event simulasi dikirim!'
    });
  };

  const clearMessages = () => {
    setReceivedMessages([]);
  };

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ddd', 
      margin: '10px',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa'
    }}>
      <h3>🏠 Internal MQTT Test</h3>
      
      {/* Connection Status */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: connectionStatus ? '#d4edda' : '#f8d7da',
        border: `2px solid ${connectionStatus ? '#28a745' : '#dc3545'}`,
        borderRadius: '8px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {connectionStatus ? '✅ TERHUBUNG' : '❌ TERPUTUS'}
        </div>
        <div style={{ fontSize: '14px', marginTop: '5px' }}>
          {connectionStatus ? 'Ke Mosquitto Local' : 'Ke Mosquitto Local'}
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={connectToInternal} 
          disabled={isTesting || connectionStatus}
          style={buttonStyle(connectionStatus ? '#28a745' : '#dc3545', isTesting)}
        >
          {isTesting ? 'Connecting...' : connectionStatus ? '✅ Connected' : '🔌 Connect MQTT'}
        </button>

        <button 
          onClick={runInternalTest} 
          disabled={isTesting || !connectionStatus}
          style={buttonStyle('#007bff', isTesting)}
        >
          🧪 Test Connection
        </button>

        <button 
          onClick={simulateDoorEvents} 
          disabled={!connectionStatus}
          style={buttonStyle('#6f42c1', false)}
        >
          🚪 Simulate Events
        </button>

        <button 
          onClick={clearMessages}
          style={buttonStyle('#6c757d', false)}
        >
          🗑️ Clear Messages
        </button>
      </div>

      {/* Custom Message Panel */}
      {connectionStatus && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d9ff',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 15px 0' }}>📤 Custom Message</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Topic:</label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                style={inputStyle}
                placeholder="doorlock/test"
              />
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Message (JSON):</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                style={{ ...inputStyle, minHeight: '80px' }}
                placeholder='{"message": "Hello"}'
              />
            </div>
            <button 
              onClick={publishCustomMessage}
              style={buttonStyle('#fd7e14', false)}
            >
              📨 Publish Message
            </button>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResult && (
        <div style={{
          padding: '15px',
          border: `2px solid ${testResult.success ? '#28a745' : '#dc3545'}`,
          borderRadius: '8px',
          backgroundColor: testResult.success ? '#d4edda' : '#f8d7da',
          color: testResult.success ? '#155724' : '#721c24',
          marginBottom: '20px',
          whiteSpace: 'pre-line'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>
            {testResult.success ? '✅ Berhasil' : '❌ Gagal'}
          </h4>
          {testResult.message}
        </div>
      )}

      {/* Received Messages */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0 }}>📨 MQTT Messages</h4>
          <span style={{ fontSize: '12px', color: '#6c757d' }}>
            Total: {receivedMessages.length} messages
          </span>
        </div>
        
        {receivedMessages.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#6c757d',
            border: '2px dashed #dee2e6',
            borderRadius: '8px'
          }}>
            No messages received yet
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {receivedMessages.map((msg, index) => (
              <div key={index} style={{
                padding: '10px',
                margin: '5px 0',
                border: '1px solid #ccc',
                borderRadius: '6px',
                backgroundColor: msg.direction === 'OUTGOING' ? '#fff3cd' : '#ffffff',
                borderLeft: `4px solid ${msg.direction === 'OUTGOING' ? '#ffc107' : '#007bff'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                  <span style={{ 
                    fontWeight: 'bold',
                    color: msg.direction === 'OUTGOING' ? '#856404' : '#004085'
                  }}>
                    {msg.direction === 'OUTGOING' ? '📤 SENT' : '📥 RECEIVED'}
                  </span>
                  <span style={{ color: '#6c757d' }}>{msg.timestamp}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#495057', marginBottom: '5px' }}>
                  <strong>Topic:</strong> {msg.topic}
                </div>
                <pre style={{ 
                  margin: 0, 
                  fontSize: '11px', 
                  backgroundColor: '#f8f9fa',
                  padding: '8px',
                  borderRadius: '4px',
                  overflowX: 'auto'
                }}>
                  {typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Style helpers
const buttonStyle = (backgroundColor, disabled) => ({
  padding: '10px 15px',
  backgroundColor: disabled ? '#6c757d' : backgroundColor,
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '14px',
  fontWeight: 'bold',
  minWidth: '160px'
});

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  fontSize: '14px',
  boxSizing: 'border-box'
};

export default InternalMQTTTest;