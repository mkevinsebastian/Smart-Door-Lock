import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../services/api";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiGet("/users");
      // Handle both response formats: {users: []} or direct array
      const usersArray = res.users || res || [];
      setUsers(usersArray);
    } catch (err) {
      console.error("Error loading users:", err);
      setError("Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  const token = localStorage.getItem("token");
  if (token) {
    load();
  }
}, []);


  const createUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword) {
      setError("Username and password are required");
      return;
    }

    try {
      setError("");
      await apiPost("/users", { 
        username: newUsername, 
        password: newPassword,
        role: "user" // Add default role
      });
      setNewUsername("");
      setNewPassword("");
      await load();
    } catch (err) {
      console.error("Error creating user:", err);
      setError("Failed to create user: " + err.message);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      setError("");
      await apiDelete(`/users/${userId}`);
      await load();
    } catch (err) {
      console.error("Error deleting user:", err);
      setError("Failed to delete user: " + err.message);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">👥 Users</h2>
      
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Create User Form */}
      <form onSubmit={createUser} className="row g-2 mb-4">
        <div className="col-md-4">
          <input
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Username"
            className="form-control"
            required
          />
        </div>
        <div className="col-md-4">
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Password"
            className="form-control"
            required
          />
        </div>
        <div className="col-md-2">
          <button 
            type="submit" 
            className="btn btn-success w-100"
            disabled={loading}
          >
            {loading ? "Adding..." : "Tambah"}
          </button>
        </div>
        <div className="col-md-2">
          <button 
            type="button" 
            className="btn btn-outline-secondary w-100"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </form>

      {/* Users List */}
      {loading ? (
        <div className="text-center py-3">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="alert alert-info text-center">
          No users found
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">System Users ({users.length})</h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-striped mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>
                        <strong>{user.username}</strong>
                        {user.username === localStorage.getItem("username") && (
                          <span className="badge bg-primary ms-1">You</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          user.role === 'admin' ? 'bg-danger' : 
                          user.role === 'manager' ? 'bg-warning' : 'bg-secondary'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          user.is_active ? 'bg-success' : 'bg-danger'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => deleteUser(user.id)}
                          disabled={user.username === localStorage.getItem("username")}
                          title={user.username === localStorage.getItem("username") ? 
                                 "Cannot delete your own account" : "Delete user"}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}