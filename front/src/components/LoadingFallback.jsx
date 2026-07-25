import Spinner from "./Spinner";

export const ComponentLoader = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="large" />
    </div>
  );
};

export const PageLoader = () => {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="large" />
    </div>
  );
};
