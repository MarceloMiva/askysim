import { useState, useEffect } from "react";
import StudentApp from "./StudentApp.jsx";
import AdminApp from "./AdminApp.jsx";

function useRoute() {
  const [route, setRoute] = useState(window.location.hash || "#/");
  useEffect(() => {
    const h = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  if (route.startsWith("#/admin")) return <AdminApp />;
  return <StudentApp />;
}
