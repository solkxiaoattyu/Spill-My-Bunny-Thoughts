import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import RandomPick from "./pages/RandomPick";
import Profile from "./pages/Profile";
import BrowseHistory from "./pages/BrowseHistory";
import Favorites from "./pages/Favorites";
import CopiedHistory from "./pages/CopiedHistory";
import DrawHistory from "./pages/DrawHistory";
import MatchHistory from "./pages/MatchHistory";
import Login from "./pages/Login";
import Quiz from "./pages/Quiz";
import QuizResults from "./pages/QuizResults";
import Welcome from "./pages/Welcome";
import CopyToast from "./components/CopyToast";

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const navigate = useNavigate();

  const finishSplash = () => {
    setSplashDone(true);
    navigate("/home", { replace: true });
  };

  return (
    <div className="app-shell mx-auto flex h-full min-h-0 w-full max-w-[430px] flex-col">
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/random" element={<RandomPick />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/history" element={<BrowseHistory />} />
        <Route path="/draw-history" element={<DrawHistory />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/copied" element={<CopiedHistory />} />
        <Route path="/match-history" element={<MatchHistory />} />
        <Route path="/login" element={<Login />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/quiz/results" element={<QuizResults />} />
      </Routes>

      {!splashDone && <Welcome onComplete={finishSplash} />}
      <CopyToast />
    </div>
  );
}
