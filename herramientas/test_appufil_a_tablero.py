"""
Prueba del script que arma el paquete de texto desde una base de AppUFIL.

    python3 -m unittest herramientas/test_appufil_a_tablero.py

Arma una base mínima con las mismas tablas y columnas que usa AppUFIL (archivo, pagina,
lectura, palabra) y verifica el paquete: mejor lectura por página, renglones, confianza
en porcentaje, ruta recortada y que la base no se toque.
"""
import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("appufil_a_tablero", RAIZ / "public" / "herramientas" / "appufil-a-tablero.py")
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)

ESQUEMA = """
CREATE TABLE archivo (sha256 TEXT PRIMARY KEY, ruta_original TEXT NOT NULL, nombre TEXT NOT NULL,
  bytes INTEGER NOT NULL, mtime REAL, mime TEXT, paginas INTEGER, ingerido_en TEXT NOT NULL);
CREATE TABLE pagina (id INTEGER PRIMARY KEY, sha256 TEXT NOT NULL, nro INTEGER NOT NULL, ancho_pt REAL, alto_pt REAL,
  tiene_texto INTEGER, render TEXT, render_escala REAL, rotacion INTEGER DEFAULT 0, clasificacion TEXT, huella TEXT,
  UNIQUE (sha256, nro));
CREATE TABLE lectura (id INTEGER PRIMARY KEY, pagina_id INTEGER NOT NULL, ruta TEXT NOT NULL, motor TEXT NOT NULL,
  version TEXT, confianza REAL, ms INTEGER, creado_en TEXT NOT NULL, UNIQUE (pagina_id, ruta));
CREATE TABLE palabra (id INTEGER PRIMARY KEY, lectura_id INTEGER NOT NULL, orden INTEGER NOT NULL, texto TEXT NOT NULL,
  x0 REAL, y0 REAL, x1 REAL, y1 REAL, conf REAL);
"""


class PaqueteDesdeAppufil(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        carpeta = Path(self.dir.name) / "datos" / "legajos" / "299113"
        carpeta.mkdir(parents=True)
        self.base = carpeta / "ufil.sqlite"
        cx = sqlite3.connect(self.base)
        cx.executescript(ESQUEMA)
        self.sha = hashlib.sha256(b"pdf de prueba").hexdigest()
        cx.execute("INSERT INTO archivo VALUES (?, ?, ?, ?, NULL, 'application/pdf', 2, '2026-09-26')",
                   (self.sha, "/home/ufil/escaneos/EFECTO 48453/Compras Marzo 2023.pdf", "Compras Marzo 2023.pdf", 1234))
        cx.execute("INSERT INTO pagina (id, sha256, nro) VALUES (1, ?, 1), (2, ?, 2)", (self.sha, self.sha))
        # Página 1: dos lecturas OCR; gana la más confiable. Página 2: capa nativa, gana siempre.
        cx.execute("INSERT INTO lectura VALUES (10, 1, 'ocr_a', 'tesseract', '5.3', 0.62, 900, 'x')")
        cx.execute("INSERT INTO lectura VALUES (11, 1, 'ocr_b', 'tesseract', '5.3', 0.88, 900, 'x')")
        cx.execute("INSERT INTO lectura VALUES (20, 2, 'ocr_a', 'tesseract', '5.3', 0.95, 900, 'x')")
        cx.execute("INSERT INTO lectura VALUES (21, 2, 'nativo', 'pymupdf', '1.24', 1.0, 10, 'x')")
        palabras = [
            (10, 0, "MAL", 0, 10, 20, 20), (11, 0, "FACTURA", 0, 10, 60, 20), (11, 1, "B", 70, 10, 80, 20),
            (11, 2, "CUIT:", 0, 40, 30, 50), (11, 3, "30-67454952-7", 35, 40, 120, 50),
            (20, 0, "ocr", 0, 0, 1, 1), (21, 0, "Remito", 0, 0, 40, 10), (21, 1, "firmado", 45, 0, 90, 10),
        ]
        cx.executemany("INSERT INTO palabra (lectura_id, orden, texto, x0, y0, x1, y1) VALUES (?,?,?,?,?,?,?)", palabras)
        cx.commit()
        cx.close()
        self.antes = self.base.read_bytes()

    def tearDown(self):
        self.dir.cleanup()

    def test_arma_el_paquete_con_la_mejor_lectura(self):
        salida = Path(self.dir.name) / "paquete.json"
        self.assertEqual(modulo.main([str(self.base), "-o", str(salida)]), 0)
        p = json.loads(salida.read_text(encoding="utf-8"))
        self.assertEqual(p["formato"], "tablero-texto/1")
        self.assertEqual(p["legajo"], "299113")
        a = p["archivos"][0]
        self.assertEqual(a["sha256"], self.sha)
        self.assertEqual(a["ruta"], "EFECTO 48453/Compras Marzo 2023.pdf")
        self.assertEqual(a["paginas"], 2)
        self.assertEqual(a["texto"][0]["texto"], "FACTURA B\nCUIT: 30-67454952-7")
        self.assertEqual(a["texto"][0]["confianza"], 88.0)
        self.assertIn("ocr_b", a["texto"][0]["motor"])
        self.assertEqual(a["texto"][1]["texto"], "Remito firmado")
        self.assertIn("nativo", a["texto"][1]["motor"])

    def test_no_modifica_la_base(self):
        modulo.armar_paquete(modulo.conectar_solo_lectura(self.base))
        self.assertEqual(self.base.read_bytes(), self.antes)
        cx = modulo.conectar_solo_lectura(self.base)
        with self.assertRaises(sqlite3.OperationalError):
            cx.execute("DELETE FROM archivo")

    def test_rechaza_lo_que_no_es_una_base_de_appufil(self):
        otra = Path(self.dir.name) / "otra.sqlite"
        sqlite3.connect(otra).execute("CREATE TABLE x (a)").connection.close()
        with self.assertRaises(SystemExit):
            modulo.conectar_solo_lectura(otra)


if __name__ == "__main__":
    unittest.main()
