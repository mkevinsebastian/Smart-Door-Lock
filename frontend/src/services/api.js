const API_BASE = "http://localhost:8080/api";

export function getToken() {
  return localStorage.getItem("token");
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path, body, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function login(username, password) {
  const res = await apiPost("/login", { username, password }, false);
  localStorage.setItem("token", res.token);
  localStorage.setItem("username", res.username);
  localStorage.setItem("role", res.role);
  return res;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("role");
}
