import { useState } from "react";
import { login } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate("/users");
    } catch (err) {
      setErr("Login gagal");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow p-4 w-100" style={{ maxWidth: "400px" }}>
        <h3 className="text-center mb-4">🔒 Smart Door Lock</h3>
        <form onSubmit={submit}>
          <div className="mb-3">
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              className="form-control"
            />
          </div>
          <div className="mb-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="form-control"
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">Login</button>
        </form>
        {err && <p className="text-danger mt-3">{err}</p>}
      </div>
    </div>
  );
}
