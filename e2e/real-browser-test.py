"""
Prueba real de extremo a extremo de AulaRec con Chromium de verdad.

- Sirve la app compilada (dist/) en http://localhost:4173/
- Chromium con:
    --auto-select-desktop-capture-source="Entire screen"  (sin diálogo nativo)
    --use-fake-ui-for-media-stream                         (permisos auto)
    --use-fake-device-for-media-stream                     (cámara/mic falsos)
- Recorre: inicio -> asistente (pantalla/cámara/micro) -> configuración ->
  cuenta atrás -> grabación (visible + PESTAÑA OCULTA 6s con animación en
  otra pestaña) -> finalizar -> vista previa -> exportar -> descargar.
- El análisis posterior (ffprobe/ffmpeg) verifica que los fotogramas del
  vídeo cambian durante el tramo de pestaña oculta.

Uso:  xvfb-run -a -s "-screen 0 1280x800x24" python3 e2e/real-browser-test.py
"""
import time
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:4173/"
OUT = "/tmp/e2e-recording.mp4"

ANIM_PAGE = (
    "data:text/html,"
    "<body style='margin:0'>"
    "<div id=c style='font-size:140px;font-family:sans-serif;padding:40px'>0</div>"
    "<script>let n=0;setInterval(()=>{n++;"
    "document.getElementById('c').textContent=n;"
    "document.body.style.background=n%2?'%23fdd':'%23ddf'},200)</script>"
)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--no-sandbox",
                "--auto-select-desktop-capture-source=Entire screen",
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--window-size=1280,800",
            ],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(URL)

        page.get_by_role("button", name="Nueva grabación").click()
        page.get_by_role("button", name="Seleccionar pantalla, ventana o pestaña").click()
        page.get_by_role("button", name="Continuar a la cámara").click()
        page.get_by_role("button", name="Activar cámara").click()
        page.get_by_role("button", name="Continuar al micrófono").click()
        page.get_by_role("button", name="Activar micrófono").click()
        page.get_by_role("button", name="Ir a la configuración").click()

        page.get_by_role("button", name="Empezar grabación").click()
        # La cuenta atrás (3s) termina y aparece la barra de grabación.
        page.wait_for_selector("text=Finalizar", timeout=20000)
        print("grabando (pestaña visible)…", flush=True)
        time.sleep(3)

        # Ocultar la pestaña de la app: aquí moría requestAnimationFrame.
        tab2 = browser.new_page()
        tab2.goto(ANIM_PAGE)
        print("pestaña de la app oculta 6s…", flush=True)
        time.sleep(6)
        tab2.close()

        page.bring_to_front()
        time.sleep(2)
        page.get_by_role("button", name="Finalizar").click()
        page.wait_for_selector("text=Tu vídeo está listo", timeout=30000)
        print("vista previa lista", flush=True)

        page.get_by_role("button", name="Exportar vídeo").click()
        page.wait_for_selector("text=Descargar vídeo", timeout=60000)
        with page.expect_download() as dl_info:
            page.get_by_role("button", name="Descargar vídeo").click()
        dl_info.value.save_as(OUT)
        print(f"vídeo guardado en {OUT}", flush=True)
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
