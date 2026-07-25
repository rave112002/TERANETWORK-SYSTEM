import { Component } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import ResultState from "./ResultState";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--color-canvas)" }}
        >
          <ResultState
            status="500"
            title="Something went wrong"
            description="We're sorry for the inconvenience. Please try refreshing the page."
            action={<Button onClick={this.handleReset}>Go Home</Button>}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
