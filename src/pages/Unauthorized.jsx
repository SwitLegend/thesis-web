import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Unauthorized</h2>
      <p>You do not have access.</p>
      <Link to="/login">Go to Login</Link>
    </div>
  );
}
