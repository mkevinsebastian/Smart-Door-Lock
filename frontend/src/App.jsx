import { Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import Users from "./pages/Users";
import Attendance from "./pages/Attendance";
import Alarms from "./pages/Alarms";
import ProtectedRoute from "./components/ProtectedRoute";
import { logout, getToken } from "./services/api";
import Login from "./pages/login";
import Dashboard from "./pages/Dashboard";
import DoorlockUsers from "./pages/DoorlockUsers";

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; 
import DoorLockStatus from "./pages/DoorLockStatus";


export default function App() {
  const navigate = useNavigate();
  const isLoggedIn = !!getToken();

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div>
      {isLoggedIn && (
        <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
          <div className="container-fluid">
            <Link className="navbar-brand" to="/dashboard">🔒 Smart Door Lock</Link>
            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarNav"
            >
              <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarNav">
              <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                <li className="nav-item">
                  <Link className="nav-link" to="/users">Users</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/attendance">Attendance</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/alarms">Alarms</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/doorlock-users">Doorlock Users</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/door-status">
                    🚪 Door Status
                  </Link>
                </li>
              </ul>
              <button onClick={doLogout} className="btn btn-outline-light">
                Logout
              </button>
            </div>
          </div>
        </nav>
      )}

      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} />} />

        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
        <Route path="/alarms" element={<ProtectedRoute><Alarms /></ProtectedRoute>} />

        <Route path="/doorlock-users" element={<ProtectedRoute><DoorlockUsers /></ProtectedRoute>}/>
        <Route path="/door-status" element={
          <ProtectedRoute>
            <DoorLockStatus />
          </ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<h2 className="p-4">Page not found</h2>} />
      </Routes>
    </div>
  );
}
