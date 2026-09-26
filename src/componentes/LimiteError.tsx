import { Component, type ReactNode } from 'react';
import { Boton } from './Boton';
import { AvisoError } from './estados';

/** Si algo falla al dibujar una pantalla, se muestra un aviso claro en lugar de una hoja en blanco. */
export class LimiteError extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 'var(--esp-8)', maxWidth: 640 }}>
          <AvisoError
            titulo="Algo falló al mostrar esta pantalla"
            accion={<Boton onClick={() => window.location.reload()}>Recargar la página</Boton>}
          >
            Lo que ya estaba guardado no se perdió. Si vuelve a pasar, avisale a quien mantiene la app con este detalle:{' '}
            {this.state.error.message}
          </AvisoError>
        </div>
      );
    }
    return this.props.children;
  }
}
