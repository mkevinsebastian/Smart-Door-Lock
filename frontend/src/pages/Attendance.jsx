import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../services/api";

export default function Attendance() {
  const [list, setList] = useState([]);
  const [accessId, setAccessId] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await apiGet("/attendance");
      setList(res || []);
    } catch (err) {
      console.error("Failed to load attendance:", err);
      setList([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!accessId) return;

    try {
      setLoading(true);
      await apiPost("/attendance", { access_id: accessId });
      setAccessId("");
      await load();
    } catch (err) {
      console.error("Failed to submit attendance:", err);
      alert("Failed to submit attendance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <h2>📝 Attendance</h2>
      <form onSubmit={submit} className="d-flex gap-2 mb-3">
        <input
          value={accessId}
          onChange={e => setAccessId(e.target.value)}
          placeholder="Access ID"
          className="form-control"
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>

      <div className="table-responsive">
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>Username</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted">
                  No attendance records
                </td>
              </tr>
            ) : (
              list.map(a => (
                <tr key={a.id}>
                  <td>{a.username}</td>
                  <td>{a.status}</td>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
