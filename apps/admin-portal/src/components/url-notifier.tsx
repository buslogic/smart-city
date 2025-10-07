import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Obavestavanje rutera o promeni URL-a. Koristice se u slucajo ako se odluci da se ne reloaduju strane prilikom promene URL-a (za react komponente)
function URLNotifier() {
  const navigate = useNavigate();
  useEffect(() => {
    const handlePopState = () => {
      navigate(window.location.pathname, { replace: true });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  return null;
}

export default URLNotifier;
