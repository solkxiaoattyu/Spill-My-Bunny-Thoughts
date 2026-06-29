import { useNavigate } from "react-router-dom";
import RandomPickModal from "../components/RandomPickModal";

export default function RandomPick() {
  const navigate = useNavigate();

  return (
    <RandomPickModal
      open
      onClose={() => navigate(-1)}
    />
  );
}
