import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../services/api";
import { mqttService } from "../services/api";

export default function DoorlockUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", access_id: "", door_id: "", pin: "" });
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
    
    // Initialize MQTT connection
    mqttService.connect().catch(err => {
      console.error('MQTT connection failed:', err);
    });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.access_id || !form.door_id || !form.pin) {
      alert("Please fill all fields including PIN!");
      return;
    }

    if (form.pin.length !== 6 || !/^\d+$/.test(form.pin)) {
      alert("PIN must be exactly 6 digits!");
      return;
    }

    setLoading(true);
    try {
      // Create user in database
      await apiPost("/doorlock/users", form);
      
      // Trigger MQTT sync to doorlock device
      const syncMessage = {
        type: "user_sync",
        access_id: form.access_id,
        name: form.name,
        pin: form.pin,
        door_id: form.door_id,
        timestamp: new Date().toISOString()
      };
      
      const syncSuccess = mqttService.publish("doorlock/sync/users", JSON.stringify(syncMessage));
      
      if (syncSuccess) {
        console.log("User sync triggered via MQTT");
      } else {
        console.warn("User created but MQTT sync failed");
      }
      
      setForm({ name: "", access_id: "", door_id: "", pin: "" });
      await loadUsers();
      alert("User created successfully and sync triggered!");
    } catch (err) {
      console.error("Failed to create doorlock user:", err);
      alert("Failed to create user: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (accessId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    setLoading(true);
    try {
      await apiDelete(`/doorlock/users/${accessId}`);
      
      // Trigger MQTT sync for user deletion
      const deleteMessage = {
        type: "user_delete",
        access_id: accessId,
        timestamp: new Date().toISOString()
      };
      
      mqttService.publish("doorlock/sync/users", JSON.stringify(deleteMessage));
      
      await loadUsers();
      alert("User deleted successfully!");
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
            required
          />
        </div>
        <div className="col-md-2">
          <input
            type="text"
            className="form-control"
            placeholder="Access ID"
            value={form.access_id}
            onChange={(e) => setForm({ ...form, access_id: e.target.value })}
            required
          />
        </div>
        <div className="col-md-2">
          <input
            type="text"
            className="form-control"
            placeholder="Door ID"
            value={form.door_id}
            onChange={(e) => setForm({ ...form, door_id: e.target.value })}
            required
          />
        </div>
        <div className="col-md-2">
          <input
            type="text"
            className="form-control"
            placeholder="6-digit PIN"
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value })}
            maxLength={6}
            pattern="\d{6}"
            title="PIN must be exactly 6 digits"
            required
          />
        </div>
        <div className="col-md-3">
          <button
            type="submit"
            className="btn btn-success w-100"
            disabled={loading}
          >
            {loading ? "Saving & Syncing..." : "Add User & Sync"}
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
              <th>PIN</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center text-muted">
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
                  <td>{u.pin}</td>
                  <td>
                    <span className={`badge ${u.is_active ? 'bg-success' : 'bg-danger'}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
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