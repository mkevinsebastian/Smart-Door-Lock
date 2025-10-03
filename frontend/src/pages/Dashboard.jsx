import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [alarms, setAlarms] = useState([]);

  useEffect(() => {
    (async () => {
      const u = await apiGet("/users");
      setUsers(u.users);
      const a = await apiGet("/attendance");
      setAttendance(a);
      const al = await apiGet("/alarms");
      setAlarms(al);
    })();
  }, []);

  return (
    <div className="container py-4">
      <h2>📊 Dashboard</h2>
      <div className="row mt-3">
        <div className="col-md-4">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Users</h5>
              <p className="display-6">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Attendance</h5>
              <p className="display-6">{attendance.length}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Alarms</h5>
              <p className="display-6">{alarms.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
