import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Footer from './components/Footer.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MapaPage from './pages/MapaPage.jsx';
import SimuladorPage from './pages/SimuladorPage.jsx';
import ProyeccionesPage from './pages/ProyeccionesPage.jsx';
import InversionesPage from './pages/InversionesPage.jsx';
import PozosPage from './pages/PozosPage.jsx';
import EstacionesPage from './pages/EstacionesPage.jsx';

const TITULOS = {
  '/': 'Dashboard',
  '/mapa': 'Mapa Operativo',
  '/simulador': 'Simulador',
  '/proyecciones': 'Proyecciones',
  '/inversiones': 'Inversiones',
  '/pozos': 'Pozos e Interconexiones',
  '/estaciones': 'Estaciones',
};

export default function App() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const location = useLocation();
  const titulo = TITULOS[location.pathname] || 'DuctoVision Bolivia';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar titulo={titulo} onAbrirMenu={() => setMenuAbierto(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mapa" element={<MapaPage />} />
            <Route path="/simulador" element={<SimuladorPage />} />
            <Route path="/proyecciones" element={<ProyeccionesPage />} />
            <Route path="/inversiones" element={<InversionesPage />} />
            <Route path="/pozos" element={<PozosPage />} />
            <Route path="/estaciones" element={<EstacionesPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  );
}
