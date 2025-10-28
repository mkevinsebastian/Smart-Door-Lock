import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

export default function Alarms() {
  const [list, setList] = useState([]);

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

  return (
    <div className="container py-4">
      <h2>🚨 Alarms</h2>

      <p className="text-muted">Daftar alarm yang diterima dari perangkat. Data di-refresh secara real-time melalui Dashboard.</p>

      <div className="table-responsive">
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>Username</th>
              <th>Access ID</th>
              <th>Reason</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted">No alarms</td></tr>
            ) : (
              list.map(a => (
                <tr key={a.id}>
                  <td>{a.username}</td>
                  <td>{a.access_id || "-"}</td>
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