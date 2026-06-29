import { useNavigate } from "react-router-dom";
import { useState } from "react";
import QuizModal from "../components/QuizModal";
import QuizResultsModal from "../components/QuizResultsModal";

export default function Quiz() {
  const navigate = useNavigate();
  const [resultsOpen, setResultsOpen] = useState(false);

  return (
    <>
      <QuizModal
        open={!resultsOpen}
        onClose={() => navigate(-1)}
        onComplete={() => setResultsOpen(true)}
      />
      <QuizResultsModal
        open={resultsOpen}
        onClose={() => navigate(-1)}
      />
    </>
  );
}
