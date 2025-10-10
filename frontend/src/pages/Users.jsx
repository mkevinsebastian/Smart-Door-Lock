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
      const res = await apiGet("/users/");
      setUsers(res.users || []);   // ✅ keep full object with id
    } catch (err) {
      console.error("Error loading users:", err);
      setError("Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("token")) {
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
      await apiPost("/users/", { username: newUsername, password: newPassword });
      setNewUsername("");
      setNewPassword("");
      await load();
    } catch (err) {
      console.error("Error creating user:", err);
      setError("Failed to create user: " + err.message);
    }
  };

  const deleteUser = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;

    try {
      setError("");
      await apiDelete(`/users/${id}`); // ✅ fixed
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
          <button
            type="button"
            className="btn-close"
            onClick={() => setError("")}
          ></button>
        </div>
      )}

      <form onSubmit={createUser} className="row g-2 mb-4">
        <div className="col-md-5">
          <input
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Username"
            className="form-control"
            required
          />
        </div>
        <div className="col-md-5">
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
      </form>

      {loading ? (
        <div className="text-center py-3">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="alert alert-info text-center">No users found</div>
      ) : (
        <ul className="list-group">
          {users.map(user => (
            <li
              key={user.id}
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              {user.username}
              <button
                className="btn btn-sm btn-danger"
                onClick={() => deleteUser(user.id, user.username)}
                disabled={user.username === localStorage.getItem("username")}
                title={
                  user.username === localStorage.getItem("username")
                    ? "Cannot delete your own account"
                    : "Delete user"
                }
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
