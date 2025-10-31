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
// Simple encryption using Base64 (matching backend expectation)
async function encryptData(data) {
  try {
    // Convert data to JSON string and Base64 encode
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
    // Base64 decode and parse JSON
    const jsonString = decodeURIComponent(escape(atob(encryptedData)));
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt response data');
  }
}

// Enhanced login function with encryption support
export async function login(username, password) {
  try {
    // Prepare login data
    const loginData = { username, password };
    
    // Encrypt the data
    const encryptedData = await encryptData(loginData);
    
    // Send encrypted request
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
    
    // Handle encrypted response
    if (result.data) {
      // Backend mengirim response encrypted
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
    // Handle direct response (fallback)
    else if (result.token) {
      localStorage.setItem("token", result.token);
      localStorage.setItem("username", result.username);
      localStorage.setItem("role", result.role);
      return result;
    }
    
    throw new Error("Invalid response format from server");
    
  } catch (error) {
    console.error("Login error:", error);
    
    // Fallback: try simple login endpoint
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

// ====== NEW MQTT SERVICE ======
class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.messageCallbacks = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      try {
        // WebSocket connection to MQTT broker
        const wsUrl = `ws://localhost:9001/mqtt`;
        this.client = new WebSocket(wsUrl);
        
        this.client.onopen = () => {
          console.log('✅ MQTT Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.client.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing MQTT message:', error);
          }
        };

        this.client.onclose = () => {
          console.log('❌ MQTT Disconnected');
          this.isConnected = false;
          this.handleReconnect();
        };

        this.client.onerror = (error) => {
          console.error('MQTT Connection Error:', error);
          reject(error);
        };

      } catch (error) {
        console.error('MQTT Connection Failed:', error);
        reject(error);
      }
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect MQTT... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 3000);
    }
  }

  subscribe(topic, callback) {
    if (!this.messageCallbacks.has(topic)) {
      this.messageCallbacks.set(topic, []);
    }
    this.messageCallbacks.get(topic).push(callback);
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

  handleMessage(message) {
    const { topic, payload } = message;
    
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
  }

  publish(topic, message) {
    if (!this.isConnected || !this.client) {
      console.error('MQTT not connected');
      return false;
    }

    try {
      const mqttMessage = {
        topic: topic,
        payload: message
      };
      this.client.send(JSON.stringify(mqttMessage));
      return true;
    } catch (error) {
      console.error('Error publishing MQTT message:', error);
      return false;
    }
  }

  disconnect() {
    if (this.client) {
      this.client.close();
      this.isConnected = false;
    }
  }
}

export const mqttService = new MQTTService();