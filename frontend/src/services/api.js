const API_BASE = "http://localhost:8090/api";

// ====== STORAGE UTILS ======
export function getToken() {
  return localStorage.getItem("token");
}

function setAuthData(data) {
  if (data.token) localStorage.setItem("token", data.token);
  if (data.username) localStorage.setItem("username", data.username);
  if (data.role) localStorage.setItem("role", data.role);
}

function clearAuthData() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
}

// ====== HTTP UTILS ======
async function handleResponse(res) {
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `HTTP ${res.status}`);
  }
  
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }
  return {};
}

function getAuthHeaders(auth = true) {
  const headers = { "Content-Type": "application/json" };
  
  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  
  return headers;
}

async function apiRequest(method, path, body = null, auth = true) {
  const config = {
    method,
    headers: getAuthHeaders(auth),
  };
  
  if (body) {
    config.body = JSON.stringify(body);
  }
  
  const res = await fetch(`${API_BASE}${path}`, config);
  return handleResponse(res);
}

// ====== BASIC API METHODS ======
export async function apiGet(path) {
  return apiRequest('GET', path);
}

export async function apiPost(path, body, auth = true) {
  return apiRequest('POST', path, body, auth);
}

export async function apiDelete(path, auth = true) {
  return apiRequest('DELETE', path, null, auth);
}

// ====== ENCRYPTION FUNCTIONS ======
async function encryptData(data) {
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = btoa(unescape(encodeURIComponent(jsonString)));
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt login data');
  }
}

async function decryptData(encryptedData) {
  try {
    const jsonString = decodeURIComponent(escape(atob(encryptedData)));
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt response data');
  }
}

// ====== AUTH API ======
export async function login(username, password) {
  try {
    // Try encrypted login first
    const loginData = { username, password };
    const encryptedData = await encryptData(loginData);
    
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: encryptedData }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    
    // Handle encrypted response
    if (result.data) {
      const decryptedData = await decryptData(result.data);
      
      if (decryptedData.token) {
        setAuthData(decryptedData);
        return decryptedData;
      } else if (decryptedData.error) {
        throw new Error(decryptedData.error);
      }
    } 
    // Handle plain response
    else if (result.token) {
      setAuthData(result);
      return result;
    }
    
    throw new Error("Invalid response format from server");
    
  } catch (error) {
    console.error("Encrypted login failed, trying simple login...", error);
    
    // Fallback to simple login
    try {
      const fallbackResponse = await fetch(`${API_BASE}/login-simple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        if (data.token) {
          setAuthData(data);
          return data;
        }
      }
    } catch (fallbackError) {
      console.error("Fallback login also failed:", fallbackError);
    }
    
    throw new Error("Login failed: " + error.message);
  }
}

export function logout() {
  clearAuthData();
}

// ====== DOORLOCK USERS API ======
export async function getDoorlockUsers() {
  return apiGet("/doorlock/users");
}

export async function createDoorlockUser(userData) {
  return apiPost("/doorlock/users", userData);
}

export async function deleteDoorlockUser(accessId) {
  return apiDelete(`/doorlock/users/${accessId}`);
}

// ====== ATTENDANCE API ======
export async function getAttendance() {
  return apiGet("/attendance");
}

export async function getAttendanceSummary() {
  try {
    const data = await apiGet("/attendance/summary");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    throw error;
  }
}

// ====== ALARMS API ======
export async function getAlarms() {
  return apiGet("/alarms");
}

// ====== SYSTEM USERS API ======
export async function getSystemUsers() {
  const res = await apiGet("/users/");
  return res.users || [];
}

export async function createSystemUser(userData) {
  return apiPost("/users", userData);
}

export async function updateSystemUser(id, userData) {
  return apiPost(`/users/${id}`, userData);
}

export async function deleteSystemUser(id) {
  return apiDelete(`/users/${id}`);
}

// ====== DASHBOARD API ======
export async function getDoorlockUsersCount() {
  try {
    const data = await getDoorlockUsers();
    return Array.isArray(data) ? data.length : 0;
  } catch (error) {
    console.error('Error fetching doorlock users:', error);
    throw error;
  }
}

export async function getDashboardStats() {
  try {
    const data = await apiGet("/dashboard/stats");
    return data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

// ====== TREND ANALYSIS APIs ======
export async function getFrequentAccess(hours = 24) {
  try {
    const data = await apiGet(`/trends/frequent-access?hours=${hours}`);
    return data;
  } catch (error) {
    console.error('Error fetching frequent access:', error);
    throw error;
  }
}

export async function getLongOpenDoors(durationThreshold = 60) {
  try {
    const data = await apiGet(`/trends/long-open-doors?duration=${durationThreshold}`);
    return data;
  } catch (error) {
    console.error('Error fetching long open doors:', error);
    throw error;
  }
}

export async function logDoorOpen(doorData) {
  try {
    const data = await apiPost("/trends/door-open-log", doorData);
    return data;
  } catch (error) {
    console.error('Error logging door open:', error);
    throw error;
  }
}

// ====== CONTROL APIs ======
export async function controlDoorLock(doorId, command) {
  try {
    const data = await apiPost("/control/doorlock", {
      door_id: doorId,
      command: command
    });
    return data;
  } catch (error) {
    console.error('Error controlling door lock:', error);
    throw error;
  }
}

export async function controlBuzzer(buzzerId, command, duration = 5) {
  try {
    const data = await apiPost("/control/buzzer", {
      buzzer_id: buzzerId,
      command: command,
      duration: duration
    });
    return data;
  } catch (error) {
    console.error('Error controlling buzzer:', error);
    throw error;
  }
}

// ====== IMPROVED MQTT SERVICE - INTERNAL FOCUS ======
class SimpleMQTTService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.messageCallbacks = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = null;
    this.connectionPromise = null;
  }

  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        console.log('✅ Already connected to local Mosquitto');
        resolve();
        return;
      }

      // INTERNAL ONLY endpoints
      const endpoints = [
        'ws://localhost:9001',
        'ws://127.0.0.1:9001',
        'ws://localhost:8080/mqtt'
      ];

      let currentEndpointIndex = 0;

      const tryNextEndpoint = () => {
        if (currentEndpointIndex >= endpoints.length) {
          const error = new Error(
            'Failed to connect to local Mosquitto.\n\n' +
            'Please ensure Mosquitto is running on localhost:9001'
          );
          reject(error);
          this.connectionPromise = null;
          return;
        }

        const endpoint = endpoints[currentEndpointIndex++];
        console.log(`🔌 Attempting to connect to: ${endpoint}`);

        try {
          if (this.ws) {
            this.ws.close();
          }

          this.ws = new WebSocket(endpoint);
          
          const connectionTimeout = setTimeout(() => {
            console.log(`⏰ Timeout: ${endpoint}`);
            this.ws.close();
            tryNextEndpoint();
          }, 5000);

          this.ws.onopen = () => {
            clearTimeout(connectionTimeout);
            console.log(`✅ CONNECTED to local Mosquitto: ${endpoint}`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.connectionPromise = null;
            resolve();
          };

          this.ws.onmessage = (event) => {
            this.handleIncomingMessage(event);
          };

          this.ws.onclose = (event) => {
            clearTimeout(connectionTimeout);
            console.log(`🔌 Disconnected from Mosquitto: ${endpoint}`, event.code, event.reason);
            this.isConnected = false;
            if (!this.connectionPromise) {
              this.handleReconnect();
            }
          };

          this.ws.onerror = (error) => {
            clearTimeout(connectionTimeout);
            console.error(`❌ Connection error: ${endpoint}`, error);
            this.isConnected = false;
            tryNextEndpoint();
          };

        } catch (error) {
          console.error(`❌ Failed to create WebSocket: ${endpoint}`, error);
          tryNextEndpoint();
        }
      };

      tryNextEndpoint();
    });

    return this.connectionPromise;
  }

  handleIncomingMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('📨 MQTT Message:', message);
      
      if (message.topic && message.payload !== undefined) {
        this.handleMessage(message.topic, message.payload);
      }
    } catch (error) {
      console.log('📨 Raw message (non-JSON):', event.data);
      this.handleMessage('raw/data', event.data);
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(2000 * this.reconnectAttempts, 15000);
      
      console.log(`🔄 Auto-reconnect in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = setTimeout(() => {
        this.connect().catch(err => {
          console.error('Auto-reconnect failed:', err.message);
        });
      }, delay);
    } else {
      console.error('❌ Max auto-reconnect attempts reached');
    }
  }

  subscribe(topic, callback) {
    if (!this.messageCallbacks.has(topic)) {
      this.messageCallbacks.set(topic, []);
    }
    this.messageCallbacks.get(topic).push(callback);
    console.log(`✅ Subscribed to: ${topic}`);
  }

  unsubscribe(topic, callback) {
    if (this.messageCallbacks.has(topic)) {
      const callbacks = this.messageCallbacks.get(topic);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.messageCallbacks.delete(topic);
      }
    }
  }

  handleMessage(topic, payload) {
    if (this.messageCallbacks.has(topic)) {
      const callbacks = this.messageCallbacks.get(topic);
      callbacks.forEach(callback => {
        try {
          callback(payload, topic);
        } catch (error) {
          console.error('Error in MQTT callback:', error);
        }
      });
    }
    
    this.messageCallbacks.forEach((callbacks, subscribedTopic) => {
      if (this.topicMatches(subscribedTopic, topic)) {
        callbacks.forEach(callback => {
          try {
            callback(payload, topic);
          } catch (error) {
            console.error('Error in wildcard MQTT callback:', error);
          }
        });
      }
    });
  }

  topicMatches(subscribedTopic, actualTopic) {
    if (subscribedTopic === actualTopic) return true;
    if (subscribedTopic === '#') return true;
    
    const subscribedParts = subscribedTopic.split('/');
    const actualParts = actualTopic.split('/');
    
    for (let i = 0; i < subscribedParts.length; i++) {
      if (subscribedParts[i] === '#') return true;
      if (subscribedParts[i] !== '+' && subscribedParts[i] !== actualParts[i]) {
        return false;
      }
      if (i === subscribedParts.length - 1 && i < actualParts.length - 1) {
        return false;
      }
    }
    
    return subscribedParts.length === actualParts.length;
  }

  publish(topic, message) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ MQTT not connected, cannot publish');
      return false;
    }

    try {
      const mqttMessage = {
        topic: topic,
        payload: typeof message === 'string' ? message : JSON.stringify(message),
        timestamp: new Date().toISOString()
      };
      
      this.ws.send(JSON.stringify(mqttMessage));
      console.log(`📤 Published to ${topic}:`, message);
      return true;
    } catch (error) {
      console.error('❌ Error publishing MQTT message:', error);
      return false;
    }
  }

  disconnect() {
    clearTimeout(this.reconnectInterval);
    this.connectionPromise = null;
    this.isConnected = false;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    console.log('✅ MQTT service disconnected');
  }

  getConnectionStatus() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  getSubscribedTopics() {
    return Array.from(this.messageCallbacks.keys());
  }
}

// ====== MQTT EXPORTS ======
export const mqttService = new SimpleMQTTService();

export const MQTT_TOPICS = {
  ATTENDANCE_NEW: "attendance/new",
  ATTENDANCE_ALL: "attendance/#",
  ALARMS_NEW: "alarms/new", 
  ALARMS_ALL: "alarms/#",
  DOOR_STATUS: "doorlock/status/door",
  DOOR_ALL: "doorlock/status/#",
  USERS_ONLINE: "users/online",
  SYSTEM_UPDATE: "system/update"
};

export const publishRealTimeUpdate = (topic, data) => {
  return mqttService.publish(topic, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

// ====== MQTT TESTING FUNCTIONS ======
export async function testMQTTConnection() {
  try {
    console.log('🏠 Testing connection to INTERNAL Mosquitto...');
    await mqttService.connect();
    
    return {
      success: true,
      message: '✅ SUCCESS: Connected to local Mosquitto',
      status: mqttService.getConnectionStatus(),
      subscribedTopics: mqttService.getSubscribedTopics()
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ FAILED: Cannot connect to local Mosquitto\n\nError: ${error.message}`,
      status: false
    };
  }
}

export async function testMQTTPublish(topic = 'doorlock/test', message = 'Test from React') {
  try {
    if (!mqttService.getConnectionStatus()) {
      await mqttService.connect();
    }
    
    const success = mqttService.publish(topic, {
      message: message,
      timestamp: new Date().toISOString(),
      from: 'react-web-client'
    });
    
    return {
      success: success,
      message: success ? `✅ Message published to ${topic}` : `❌ Failed to publish to ${topic}`,
      topic: topic,
      data: message
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Publish Error: ${error.message}`,
      topic: topic
    };
  }
}

// Global access for testing
if (typeof window !== 'undefined') {
  window.mqttTest = {
    testConnection: testMQTTConnection,
    testPublish: testMQTTPublish,
    service: mqttService
  };
}