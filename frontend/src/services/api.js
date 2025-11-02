const API_BASE = "http://localhost:8090/api";

export function getToken() {
  return localStorage.getItem("token");
}

async function handleResponse(res) {
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `HTTP ${res.status}`);
  }
  
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return {};
}

export async function apiGet(path) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token || ''}`
  };

  const res = await fetch(`${API_BASE}${path}`, { headers });
  return handleResponse(res);
}

export async function apiPost(path, body, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  
  return handleResponse(res);
}

export async function apiDelete(path, auth = true) {
  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers,
  });
  
  return handleResponse(res);
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

export async function login(username, password) {
  try {
    const loginData = { username, password };
    const encryptedData = await encryptData(loginData);
    
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: encryptedData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (result.data) {
      const decryptedData = await decryptData(result.data);
      
      if (decryptedData.token) {
        localStorage.setItem("token", decryptedData.token);
        localStorage.setItem("username", decryptedData.username);
        localStorage.setItem("role", decryptedData.role);
        return decryptedData;
      } else if (decryptedData.error) {
        throw new Error(decryptedData.error);
      }
    } 
    else if (result.token) {
      localStorage.setItem("token", result.token);
      localStorage.setItem("username", result.username);
      localStorage.setItem("role", result.role);
      return result;
    }
    
    throw new Error("Invalid response format from server");
    
  } catch (error) {
    console.error("Login error:", error);
    
    try {
      console.log("Trying fallback to simple login...");
      const fallbackResponse = await fetch(`${API_BASE}/login-simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json();
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("username", data.username);
          localStorage.setItem("role", data.role);
          return data;
        }
      }
    } catch (fallbackError) {
      console.error("Fallback login also failed:", fallbackError);
    }
    
    throw error;
  }
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
}

// Doorlock users API
export async function getDoorlockUsers() {
  return apiGet("/doorlock/users");
}

export async function createDoorlockUser(userData) {
  return apiPost("/doorlock/users", userData);
}

export async function deleteDoorlockUser(accessId) {
  return apiDelete(`/doorlock/users/${accessId}`);
}

// Attendance API
export async function getAttendance() {
  return apiGet("/attendance");
}

// Alarms API
export async function getAlarms() {
  return apiGet("/alarms");
}

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

// Dashboard specific APIs
export async function getAttendanceSummary() {
  try {
    const data = await apiGet("/attendance/summary");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    throw error;
  }
}

export async function getDoorlockUsersCount() {
  try {
    const data = await getDoorlockUsers();
    return Array.isArray(data) ? data.length : 0;
  } catch (error) {
    console.error('Error fetching doorlock users:', error);
    throw error;
  }
}

// ====== NEW TREND ANALYSIS APIs ======
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

// ====== NEW MQTT CONTROL APIs ======
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

// ====== NEW DASHBOARD STATS API ======
export async function getDashboardStats() {
  try {
    const data = await apiGet("/dashboard/stats");
    return data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

// ====== SIMPLE MQTT SERVICE (WebSocket Basic) ======
class SimpleMQTTService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.messageCallbacks = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      try {
        // WebSocket connection langsung ke MQTT WebSocket
        this.ws = new WebSocket('ws://localhost:9001');
        
        this.ws.onopen = () => {
          console.log('✅ WebSocket MQTT Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            // Parse message as JSON
            const message = JSON.parse(event.data);
            console.log('📨 MQTT Message:', message);
            
            // Handle different message formats
            if (message.topic && message.payload) {
              this.handleMessage(message.topic, message.payload);
            } else if (message.destinationName && message.payloadString) {
              this.handleMessage(message.destinationName, message.payloadString);
            }
          } catch (error) {
            console.log('📨 Raw MQTT Message:', event.data);
            // Try to handle as raw string
            this.handleMessage('raw/data', event.data);
          }
        };

        this.ws.onclose = () => {
          console.log('❌ WebSocket MQTT Disconnected');
          this.isConnected = false;
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket MQTT Error:', error);
          this.isConnected = false;
          reject(error);
        };

      } catch (error) {
        console.error('WebSocket Connection Failed:', error);
        reject(error);
      }
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = setTimeout(() => {
        this.connect().catch(err => {
          console.error('Reconnection failed:', err);
        });
      }, 3000);
    } else {
      console.error('❌ Max reconnection attempts reached');
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
    }
  }

  handleMessage(topic, payload) {
    if (this.messageCallbacks.has(topic)) {
      const callbacks = this.messageCallbacks.get(topic);
      callbacks.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in MQTT callback:', error);
        }
      });
    }
    
    // Juga handle wildcard subscriptions
    this.messageCallbacks.forEach((callbacks, subscribedTopic) => {
      if (subscribedTopic.includes('+') || subscribedTopic.includes('#')) {
        // Simple wildcard matching (basic)
        if (this.topicMatches(subscribedTopic, topic)) {
          callbacks.forEach(callback => {
            try {
              callback(payload);
            } catch (error) {
              console.error('Error in wildcard MQTT callback:', error);
            }
          });
        }
      }
    });
  }

  topicMatches(subscribedTopic, actualTopic) {
    // Basic wildcard matching
    const subscribedParts = subscribedTopic.split('/');
    const actualParts = actualTopic.split('/');
    
    if (subscribedParts.length !== actualParts.length && !subscribedTopic.includes('#')) {
      return false;
    }
    
    for (let i = 0; i < subscribedParts.length; i++) {
      if (subscribedParts[i] === '#') return true;
      if (subscribedParts[i] !== '+' && subscribedParts[i] !== actualParts[i]) {
        return false;
      }
    }
    
    return true;
  }

  publish(topic, message) {
    if (!this.isConnected || !this.ws) {
      console.error('❌ MQTT not connected, cannot publish');
      return false;
    }

    try {
      const mqttMessage = {
        topic: topic,
        payload: typeof message === 'string' ? message : JSON.stringify(message)
      };
      
      this.ws.send(JSON.stringify(mqttMessage));
      console.log(`📤 MQTT Message Published: ${topic}`, message);
      return true;
    } catch (error) {
      console.error('❌ Error publishing MQTT message:', error);
      return false;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
    }
    clearTimeout(this.reconnectInterval);
  }

  getConnectionStatus() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export service
export const mqttService = new SimpleMQTTService();