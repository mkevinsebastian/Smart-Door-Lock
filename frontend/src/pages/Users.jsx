import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../services/api";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = async () => {
    const res = await apiGet("/users");
    setUsers(res.users);
  };

  useEffect(() => { load(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    await apiPost("/users", { username: newUsername, password: newPassword });
    setNewUsername("");
    setNewPassword("");
    await load();
  };

  const deleteUser = async (username) => {
    await apiPost("/users/delete", { username });
    await load();
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">Users</h2>
      <form onSubmit={createUser} className="row g-2 mb-3">
        <div className="col-md-5">
          <input
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Username"
            className="form-control"
          />
        </div>
        <div className="col-md-5">
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Password"
            className="form-control"
          />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-success w-100">Tambah</button>
        </div>
      </form>
      <ul className="list-group">
        {users.map(u => (
          <li key={u} className="list-group-item d-flex justify-content-between align-items-center">
            {u}
            <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u)}>Hapus</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
