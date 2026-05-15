import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./LandingPage";
import WhiteboardApp from "./WhiteboardApp";

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<WhiteboardApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
