import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

export default function Attendance() {
  const [list, setList] = useState([]);

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

  return (
    <div className="container py-4">
      <h2>📝 Attendance</h2>
      
      <p className="text-muted">Daftar absensi yang diterima dari perangkat. Data di-refresh secara real-time melalui Dashboard.</p>

      <div className="table-responsive">
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>Username</th>
              <th>Status</th>
              <th>Arah</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted">
                  No attendance records
                </td>
              </tr>
            ) : (
              list.map(a => (
                <tr key={a.id}>
                  <td>{a.username}</td>
                  <td>{a.status}</td>
                  <td>
                    {a.arrow === 'in' ? (
                      <span className="badge bg-success">Masuk</span>
                    ) : (
                      <span className="badge bg-warning">Keluar</span>
                    )}
                  </td>
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