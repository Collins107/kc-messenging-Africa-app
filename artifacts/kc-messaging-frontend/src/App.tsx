import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import AuthRoute from "./routes/auth";
import ChatRoute from "./routes/chat";

function Loading() {
  return (
    <div className="loading-screen">
      <div className="woven-strip is-loading" />
    </div>
  );
}

export default function App() {
  const { status } = useAuth();

  if (status === "checking") return <Loading />;

  return (
    <Routes>
      <Route
        path="/auth"
        element={status === "signed-in" ? <Navigate to="/" replace /> : <AuthRoute />}
      />
      <Route
        path="/"
        element={status === "signed-in" ? <ChatRoute /> : <Navigate to="/auth" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
