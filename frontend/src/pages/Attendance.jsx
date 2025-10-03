import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../services/api";

export default function Attendance() {
  const [list, setList] = useState([]);
  const [username, setUsername] = useState("");

  const load = async () => {
    const res = await apiGet("/attendance");
    setList(res);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await apiPost("/attendance", { username });
    setUsername("");
    await load();
  };

  return (
    <div className="container py-4">
      <h2>Attendance</h2>
      <form onSubmit={submit} className="d-flex gap-2 mb-3">
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Username"
          className="form-control"
        />
        <button type="submit" className="btn btn-primary">Submit</button>
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
            {list.map(a => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td>{a.status}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
