import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../services/api";

export default function Alarms() {
  const [list, setList] = useState([]);
  const [accessId, setAccessId] = useState("");   // renamed for clarity
  const [type, setType] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await apiGet("/alarms");
      setList(res || []);
    } catch (err) {
      console.error("Failed to load alarms:", err);
      setList([]);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!accessId) return;

    try {
      setLoading(true);
      await apiPost("/alarm", { alarm_type: type, access_id: accessId });
      setAccessId("");
      await load();
    } catch (err) {
      console.error("Failed to trigger alarm:", err);
      alert("Failed to trigger alarm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <h2>🚨 Alarms</h2>

      <form onSubmit={submit} className="row g-2 mb-3">
        <div className="col-md-5">
          <input
            value={accessId}
            onChange={e => setAccessId(e.target.value)}
            placeholder="Access ID"
            className="form-control"
          />
        </div>
        <div className="col-md-5">
          <select
            value={type}
            onChange={e => setType(Number(e.target.value))}
            className="form-select"
          >
            <option value={1}>3x gagal masuk</option>
            <option value={2}>Pintu terbuka &gt; 1 menit</option>
          </select>
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-danger w-100" disabled={loading}>
            {loading ? "Triggering..." : "Trigger"}
          </button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>Username</th>
              <th>Reason</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-muted">No alarms</td></tr>
            ) : (
              list.map(a => (
                <tr key={a.id}>
                  <td>{a.username}</td>
                  <td>{a.reason}</td>
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
