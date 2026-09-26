#!/usr/bin/env python3
"""
appufil-a-tablero.py — arma el «paquete de texto» del Tablero de Prueba a partir
de la base de un legajo de AppUFIL.

    python3 appufil-a-tablero.py datos/legajos/<legajo>/ufil.sqlite
    python3 appufil-a-tablero.py datos/legajos/<legajo>/ufil.sqlite --legajo 299113 -o salida.json

Qué hace, y qué no:
  · Abre la base en SOLO LECTURA (no escribe nada, no toca los PDF ni los derivados).
  · Por cada archivo toma su huella SHA-256, su nombre y la carpeta donde estaba, y el
    texto de cada página con la MEJOR lectura disponible (la misma regla que usa AppUFIL
    para su buscador: capa de texto nativa, después visión, después la OCR más confiable).
  · Reconstruye los renglones con las coordenadas de cada palabra.
  · De la ruta original guarda solo la carpeta y el archivo («EFECTO 48435/PARTE 1.pdf»):
    el resto de la ruta de esa computadora no viaja.

Sólo usa la biblioteca estándar de Python 3.8 o más nuevo. No necesita internet.
El archivo que genera se lleva al tablero y se importa en Documentos → «Traer texto de AppUFIL».
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path, PurePath

FORMATO = "tablero-texto/1"
VERSION = "1.0"
PRIORIDAD = "CASE l.ruta WHEN 'nativo' THEN 0 WHEN 'vlm' THEN 1 ELSE 2 END"


def conectar_solo_lectura(ruta: Path) -> sqlite3.Connection:
    if not ruta.is_file():
        raise SystemExit(f"No existe la base: {ruta}")
    cx = sqlite3.connect(f"{ruta.resolve().as_uri()}?mode=ro", uri=True)
    cx.row_factory = sqlite3.Row
    tablas = {r[0] for r in cx.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    faltan = {"archivo", "pagina", "lectura", "palabra"} - tablas
    if faltan:
        raise SystemExit(f"No parece una base de AppUFIL: faltan las tablas {', '.join(sorted(faltan))}.")
    return cx


def ruta_corta(ruta_original: str | None, nombre: str) -> str:
    """Carpeta y archivo, sin el resto de la ruta de la computadora."""
    if not ruta_original:
        return nombre
    partes = PurePath(ruta_original.replace("\\", "/")).parts
    return "/".join(partes[-2:]) if len(partes) >= 2 else nombre


def texto_de_palabras(palabras: list[sqlite3.Row]) -> str:
    """Une las palabras en orden; salta de renglón cuando la palabra baja más de media altura."""
    salida: list[str] = []
    previa = None
    for p in palabras:
        t = (p["texto"] or "").strip()
        if not t:
            continue
        if previa is not None:
            alto = max((previa["y1"] or 0) - (previa["y0"] or 0), 1.0)
            if p["y0"] is not None and previa["y0"] is not None and p["y0"] - previa["y0"] > alto * 0.5:
                salida.append("\n")
            else:
                salida.append(" ")
        salida.append(t)
        previa = p
    return "".join(salida).strip()


def confianza_en_porcentaje(valor) -> float | None:
    if valor is None:
        return None
    v = float(valor)
    return round(v * 100 if v <= 1 else v, 2)


def armar_paquete(cx: sqlite3.Connection, legajo: str | None = None) -> dict:
    archivos = []
    for a in cx.execute("SELECT sha256, ruta_original, nombre, bytes, paginas FROM archivo ORDER BY ruta_original, nombre"):
        mejores = {}
        for f in cx.execute(
            f"""SELECT p.nro, l.id AS lid, l.ruta, l.motor, l.version, l.confianza
                  FROM pagina p JOIN lectura l ON l.pagina_id = p.id
                 WHERE p.sha256 = ?
                 ORDER BY p.nro, {PRIORIDAD}, l.confianza DESC""",
            (a["sha256"],),
        ):
            mejores.setdefault(f["nro"], f)
        texto = []
        for nro, f in sorted(mejores.items()):
            palabras = cx.execute(
                "SELECT texto, y0, y1 FROM palabra WHERE lectura_id = ? ORDER BY orden", (f["lid"],)
            ).fetchall()
            texto.append({
                "nro": nro,
                "texto": texto_de_palabras(palabras),
                "motor": " ".join(x for x in (f"AppUFIL {f['ruta']}", f["motor"], f["version"]) if x),
                "confianza": confianza_en_porcentaje(f["confianza"]),
            })
        paginas = a["paginas"] or cx.execute("SELECT COUNT(*) FROM pagina WHERE sha256 = ?", (a["sha256"],)).fetchone()[0]
        archivos.append({
            "sha256": a["sha256"].lower(),
            "nombre": a["nombre"],
            "ruta": ruta_corta(a["ruta_original"], a["nombre"]),
            "bytes": a["bytes"],
            "paginas": paginas,
            "texto": texto,
        })
    return {
        "formato": FORMATO,
        "generado_por": f"AppUFIL (appufil-a-tablero.py {VERSION})",
        "generado_en": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "legajo": legajo,
        "archivos": archivos,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Arma el paquete de texto del Tablero de Prueba desde una base de AppUFIL.")
    ap.add_argument("base", type=Path, help="ufil.sqlite del legajo (datos/legajos/<legajo>/ufil.sqlite)")
    ap.add_argument("--legajo", help="número de legajo, para que el tablero avise si no coincide (por defecto, la carpeta)")
    ap.add_argument("-o", "--salida", type=Path, help="archivo a escribir (por defecto, texto-para-el-tablero-<legajo>.json)")
    args = ap.parse_args(argv)

    cx = conectar_solo_lectura(args.base)
    legajo = args.legajo or args.base.resolve().parent.name
    paquete = armar_paquete(cx, legajo)
    cx.close()
    salida = args.salida or Path(f"texto-para-el-tablero-{legajo}.json")
    salida.write_text(json.dumps(paquete, ensure_ascii=False, indent=1), encoding="utf-8")
    paginas = sum(len(a["texto"]) for a in paquete["archivos"])
    print(f"Listo: {len(paquete['archivos'])} archivos y {paginas} páginas con texto en {salida}")
    print("Llevá ese archivo al tablero: Documentos → «Traer texto de AppUFIL».")
    return 0


if __name__ == "__main__":
    sys.exit(main())
