import { useEffect, useState } from 'react';
import MapaRed from '../components/MapaRed.jsx';
import { api } from '../lib/api.js';

export default function MapaPage() {
  const [ductos, setDuctos] = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [pozos, setPozos] = useState([]);

  useEffect(() => {
    api.ductos().then(setDuctos);
    api.estaciones().then((r) => setEstaciones(r.estaciones));
    api.pozos().then(setPozos);
  }, []);

  return (
    <div className="h-[calc(100vh-160px)]">
      <MapaRed sistemas={ductos} estaciones={estaciones} pozos={pozos} />
    </div>
  );
}
