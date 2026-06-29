import { useNavigate } from "react-router-dom";
import QuizResultsModal from "../components/QuizResultsModal";

export default function QuizResults() {
  const navigate = useNavigate();

  return (
    <QuizResultsModal
      open
      onClose={() => navigate("/home")}
    />
  );
}
