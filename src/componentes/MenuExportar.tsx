import * as Menu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { Boton } from './Boton';
import s from './Menu.module.css';

/** Botón "Exportar" con Excel y CSV. Exporta exactamente lo que se ve (con filtros). */
export function MenuExportar({ cantidad, onExcel, onCsv }: { cantidad: number; onExcel: () => Promise<void>; onCsv: () => void }) {
  const [cargando, setCargando] = useState(false);
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Boton icono={<Download aria-hidden />} cargando={cargando} disabled={cantidad === 0}>
          Exportar <ChevronDown aria-hidden style={{ width: 14, height: 14 }} />
        </Boton>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className={s.contenido} align="end" sideOffset={6}>
          <Menu.Label className={s.rotulo}>
            {cantidad} {cantidad === 1 ? 'fila' : 'filas'} con los filtros actuales
          </Menu.Label>
          <Menu.Item
            className={s.item}
            onSelect={async () => {
              setCargando(true);
              try {
                await onExcel();
              } finally {
                setCargando(false);
              }
            }}
          >
            <FileSpreadsheet aria-hidden /> Excel (.xlsx)
          </Menu.Item>
          <Menu.Item className={s.item} onSelect={onCsv}>
            <FileText aria-hidden /> CSV (planilla simple)
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
