import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../services/api";

export default function DoorlockUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", access_id: "", door_id: "" });
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await apiGet("/doorlock/users");
      setUsers(res || []);
    } catch (err) {
      console.error("Failed to load doorlock users:", err);
      setUsers([]);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.access_id || !form.door_id) {
      alert("Please fill all fields!");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/doorlock/users", form);
      setForm({ name: "", access_id: "", door_id: "" });
      await loadUsers();
    } catch (err) {
      console.error("Failed to create doorlock user:", err);
      alert("Failed to create user!");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (accessId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    setLoading(true);
    try {
      await apiDelete(`/doorlock/users/${accessId}`);  // ✅ correct param
      await loadUsers();
    } catch (err) {
      console.error("Failed to delete doorlock user:", err);
      alert(`Failed to delete user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="container py-4">
      <h2>🔑 Doorlock Users Management</h2>

      <form className="row g-3 mt-3" onSubmit={handleCreate}>
        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Access ID"
            value={form.access_id}
            onChange={(e) => setForm({ ...form, access_id: e.target.value })}
          />
        </div>
        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Door ID"
            value={form.door_id}
            onChange={(e) => setForm({ ...form, door_id: e.target.value })}
          />
        </div>
        <div className="col-md-3">
          <button
            type="submit"
            className="btn btn-success w-100"
            disabled={loading}
          >
            {loading ? "Saving..." : "Add User"}
          </button>
        </div>
      </form>

      <div className="mt-4">
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Access ID</th>
              <th>Door ID</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-muted">
                  No doorlock users found
                </td>
              </tr>
            ) : (
              users.map((u, i) => (
                <tr key={u.id}>
                  <td>{i + 1}</td>
                  <td>{u.name}</td>
                  <td>{u.access_id}</td>
                  <td>{u.door_id}</td>
                  <td>{u.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(u.access_id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
