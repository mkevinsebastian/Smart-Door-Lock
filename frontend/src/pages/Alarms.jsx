import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../services/api";

export default function Alarms() {
  const [list, setList] = useState([]);
  const [username, setUsername] = useState("");
  const [type, setType] = useState(1);

  const load = async () => {
    const res = await apiGet("/alarms");
    setList(res);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!username) return;
    await apiPost("/alarm", { alarm_type: type, username });
    setUsername("");
    await load();
  };

  return (
    <div className="container py-4">
      <h2>Alarms</h2>
      <form onSubmit={submit} className="row g-2 mb-3">
        <div className="col-md-5">
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            className="form-control"
          />
        </div>
        <div className="col-md-5">
          <select value={type} onChange={e => setType(Number(e.target.value))} className="form-select">
            <option value={1}>3x gagal masuk</option>
            <option value={2}>Pintu terbuka &gt; 1 menit</option>
          </select>
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-danger w-100">Trigger</button>
        </div>
      </form>
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Username</th>
              <th>Reason</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {list.map(a => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td>{a.reason}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
