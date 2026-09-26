import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import s from './Toast.module.css';

type Toast = {
  id: number;
  texto: ReactNode;
  tono: 'ok' | 'aviso' | 'error';
  accion?: { texto: string; alHacer: () => void };
};

type Contexto = { avisar: (texto: ReactNode, opciones?: Partial<Omit<Toast, 'id' | 'texto'>> & { duracion?: number }) => void };

const ToastContexto = createContext<Contexto>({ avisar: () => undefined });

export function ProveedorToasts({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const siguiente = useRef(1);

  const avisar = useCallback<Contexto['avisar']>((texto, opciones = {}) => {
    const id = siguiente.current++;
    const { duracion = 4200, tono = 'ok', accion } = opciones;
    setToasts((lista) => [...lista.slice(-2), { id, texto, tono, accion }]);
    window.setTimeout(() => setToasts((lista) => lista.filter((t) => t.id !== id)), duracion);
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <ToastContexto.Provider value={valor}>
      {children}
      <div className={s.zona} aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`${s.toast} ${t.tono === 'aviso' ? s.aviso : ''} ${t.tono === 'error' ? s.error : ''}`}>
            <span className={s.punto} aria-hidden />
            <span>{t.texto}</span>
            {t.accion && (
              <button
                type="button"
                className={s.accion}
                onClick={() => {
                  t.accion?.alHacer();
                  setToasts((lista) => lista.filter((x) => x.id !== t.id));
                }}
              >
                {t.accion.texto}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContexto.Provider>
  );
}

export function useToast() {
  return useContext(ToastContexto);
}
