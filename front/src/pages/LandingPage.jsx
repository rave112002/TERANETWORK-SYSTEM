import { Button } from "antd";
import { useNavigate } from "react-router";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--gradient-background)" }}
    >
      <div className="text-center">
        <h1
          className="text-5xl font-bold mb-4"
          style={{ color: "var(--color-text-dark)" }}
        >
          {import.meta.env.VITE_APP_NAME}
        </h1>
        <p
          className="text-xl mb-8"
          style={{ color: "var(--color-text-secondary)" }}
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
