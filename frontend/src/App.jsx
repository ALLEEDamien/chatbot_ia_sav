// Composant racine : définit les pages (routes) et affiche le widget de chat sur toutes.
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import ChatWidget from "./components/ChatWidget";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* "/" : vitrine de la boutique ; "/admin" : gestion de la base de connaissances */}
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      {/* Hors de <Routes> : la bulle de chat reste visible quelle que soit la page. */}
      <ChatWidget />
    </BrowserRouter>
  );
}

export default App;
