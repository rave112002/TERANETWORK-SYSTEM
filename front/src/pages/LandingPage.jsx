import { Button } from "antd";
import { useNavigate } from "react-router";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-canvas)" }}
    >
      <div className="text-center">
        <h1
          className="m-0 font-semibold leading-tight"
          style={{
            fontSize: 42,
            letterSpacing: "-1px",
            color: "var(--color-text-dark)",
          }}
        >
          {import.meta.env.VITE_APP_NAME}
        </h1>
        <p
          className="m-0 mt-3 mb-8"
          style={{ fontSize: 15, color: "var(--color-text-secondary)" }}
        >
          Your modern web application
        </p>
        <Button type="primary" size="large" onClick={() => navigate("/admin")}>
          Admin Login
        </Button>
      </div>
    </div>
  );
};

export default LandingPage;
