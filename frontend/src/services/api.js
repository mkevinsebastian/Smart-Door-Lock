const API_BASE = "http://localhost:8080/api";

export function getToken() {
  return localStorage.getItem("token");
}

async function handleResponse(res) {
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `HTTP ${res.status}`);
  }
  
  // Handle empty responses
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return {}; // Return empty object for non-JSON responses
}

export async function apiGet(path) {
  const token = getToken();
  const headers = { 
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
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
  const res = await apiPost("/login", { username, password }, false);
  if (res.token) {
    localStorage.setItem("token", res.token);
    localStorage.setItem("username", res.username);
    localStorage.setItem("role", res.role);
  }
  return res;
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

export async function createAttendance(accessId) {
  return apiPost("/attendance", { access_id: accessId });
}

// Alarms API
export async function getAlarms() {
  return apiGet("/alarms");
}

export async function createAlarm(alarmData) {
  return apiPost("/alarm", alarmData);
}

// Users management API
export async function getSystemUsers() {
  try {
    const data = await apiGet("/users");
    // Handle both response formats: {users: []} or direct array
    return Array.isArray(data) ? data : (data.users || []);
  } catch (error) {
    console.error('Error fetching system users:', error);
    throw error; // Re-throw to handle in component
  }
}

export async function createSystemUser(userData) {
  return apiPost("/users", userData);
}

export async function updateSystemUser(id, userData) {
  return apiPost(`/users/${id}`, userData); // Use apiPost for consistency
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