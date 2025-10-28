// Menggunakan Web Crypto API (bawaan browser) untuk AES-GCM
// Kunci ini HARUS sama dengan 'aesKey' di main.go
const AES_KEY = "kuncirahasia1234"; 

// --- Fungsi Enkripsi/Dekripsi AES-GCM ---

async function getCryptoKey() {
  const keyBytes = new TextEncoder().encode(AES_KEY);
  return await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptAES(plaintext) {
  const key = await getCryptoKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Nonce 12 bytes untuk GCM
  const encodedText = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encodedText
  );

  const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertextBuffer), iv.length);

  return btoa(String.fromCharCode.apply(null, combined));
}

async function decryptAES(base64Ciphertext) {
  try {
    const key = await getCryptoKey();
    
    const combined = new Uint8Array(atob(base64Ciphertext).split("").map(c => c.charCodeAt(0)));

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error("AES Decryption Failed:", err);
    throw new Error("Failed to decrypt response from server.");
  }
}

// --- API Service ---

const API_BASE = "http://localhost:8090/api";

export function getToken() {
  return localStorage.getItem("token");
}

async function handleResponse(res) {
  if (!res.ok) {
    let errorData;
    try {
        errorData = await res.json();
    } catch (e) {
        errorData = { error: await res.text() || `HTTP ${res.status}` };
    }
    throw new Error(errorData.error || errorData.message || `HTTP ${res.status}`);
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

export async function login(username, password) {
  const plainPayload = JSON.stringify({ username, password });
  const encryptedPayload = await encryptAES(plainPayload);
  const res = await apiPost("/login", { payload: encryptedPayload }, false);
  const decryptedPayload = await decryptAES(res.payload);
  const userData = JSON.parse(decryptedPayload);

  if (userData.token) {
    localStorage.setItem("token", userData.token);
    localStorage.setItem("username", userData.username);
    localStorage.setItem("role", userData.role);
  }
  return userData;
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

export async function createAttendance(accessId, arrow) {
  return apiPost("/attendance", { access_id: accessId, arrow: arrow });
}

// Alarms API
export async function getAlarms() {
  return apiGet("/alarms");
}

export async function createAlarm(alarmData) {
  return apiPost("/alarm", alarmData);
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

export async function getDashboardStats() {
  try {
    const data = await apiGet("/dashboard/stats");
    return data;
  } catch (error)
    {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}