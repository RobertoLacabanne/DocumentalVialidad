import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LimiteError } from './componentes/LimiteError';
import { ProveedorToasts } from './componentes/Toast';
import { ProveedorGuardado } from './datos/guardado';
import { ProveedorSesion, useSesion } from './datos/sesion';
import { hayConexion } from './lib/supabase';
import { Acceso, Cargando, ErrorDeSesion, SinConfigurar, SinInvitacion } from './pantallas/Acceso';
import { Causas } from './pantallas/Causas';
import { Efectos } from './pantallas/Efectos';
import { Equipo } from './pantallas/Equipo';
import { Importar } from './pantallas/Importar';
import { Indice } from './pantallas/Indice';
import { Inicio } from './pantallas/Inicio';
import { Marco } from './pantallas/Marco';
import { Personas } from './pantallas/Personas';
import { PaginaDiseno } from './pantallas/PaginaDiseno';
import { Proximamente } from './pantallas/Proximamente';

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

export function App() {
  return (
    <BrowserRouter>
      <ProveedorToasts>
        <LimiteError>
          <Routes>
            <Route path="/diseno" element={<PaginaDiseno />} />
            <Route path="*" element={hayConexion ? <AppConectada /> : <SinConfigurar />} />
          </Routes>
        </LimiteError>
      </ProveedorToasts>
    </BrowserRouter>
  );
}

function AppConectada() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <ProveedorSesion>
        <Protegida />
      </ProveedorSesion>
    </QueryClientProvider>
  );
}

function Protegida() {
  const { estado } = useSesion();
  if (estado.tipo === 'cargando') return <Cargando />;
  if (estado.tipo === 'afuera') return <Acceso />;
  if (estado.tipo === 'sin_invitacion') return <SinInvitacion email={estado.email} />;
  if (estado.tipo === 'error') return <ErrorDeSesion mensaje={estado.mensaje} />;
  return (
    <ProveedorGuardado>
      <Routes>
        <Route path="/" element={<Causas />} />
        <Route path="/causa/:causaId" element={<Marco />}>
          <Route index element={<Navigate to="inicio" replace />} />
          <Route path="inicio" element={<Inicio />} />
          <Route path="indice" element={<Indice />} />
          <Route path="efectos" element={<Efectos />} />
          <Route path="personas" element={<Personas />} />
          <Route path="importar" element={<Importar />} />
          <Route path="equipo" element={<Equipo />} />
          <Route path=":seccion" element={<Proximamente />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProveedorGuardado>
  );
}
