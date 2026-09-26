import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import s from './Dialogo.module.css';

export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  pie,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <RadixDialog.Root open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={s.fondo} />
        <RadixDialog.Content className={s.caja} aria-describedby={descripcion ? undefined : undefined}>
          <div className={s.cabecera}>
            <RadixDialog.Title className={s.titulo}>{titulo}</RadixDialog.Title>
            {descripcion ? (
              <RadixDialog.Description className={s.descripcion}>{descripcion}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="visualmente-oculto">{titulo}</RadixDialog.Description>
            )}
          </div>
          {children}
          {pie && <div className={s.pie}>{pie}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const clasesDialogo = { cuerpo: s.cuerpo, dosColumnas: s.dosColumnas, pie: s.pie };
