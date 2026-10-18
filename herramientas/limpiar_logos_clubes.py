# Logos de clubes para el sitio (fondo oscuro): sin fondo, recortados, más
# grandes y con el borde nítido. Así quedaron Wolf Strength, Primal Strength y
# Black Bars, que venían con fondo negro o blanco y se veían como un recuadro.
#
#   python3 herramientas/limpiar_logos_clubes.py claro  logo.jpg clubs/Club.png
#   python3 herramientas/limpiar_logos_clubes.py oscuro logo.png clubs/Club.png
#
#   claro:  logo claro sobre fondo negro → el negro se vuelve transparente y el
#           logo conserva sus colores (el rojo de Black Bars, los grises de Wolf).
#   oscuro: tinta negra sobre blanco → tinta blanca sobre transparente, para que
#           se lea sobre el azul del sitio.
# Necesita Pillow, numpy y scipy. Después de cambiar un logo que se subió desde
# Admin → Clubes, hay que volver a subirlo ahí: el de Admin tiene prioridad.
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def suave(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def limpiar(src, dst, modo, lo, hi, escala=3, corte=(0.0, 1.0), manchas=0, lado=512):
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    if modo == 'claro_sobre_negro':
        a = np.clip((im.max(axis=2) - lo) / (hi - lo), 0, 1)
        col = np.clip(im / np.maximum(a[..., None], 1e-3), 0, 1)      # el color que tenía antes de mezclarse con el negro
    else:
        lum = im @ np.array([.299, .587, .114], np.float32)
        a = np.clip((hi - lum) / (hi - lo), 0, 1)
        col = np.ones_like(im)
    # Agrandar premultiplicado (sin bordes sucios) y afinar el borde.
    W, H = a.shape[1] * escala, a.shape[0] * escala
    pre = np.dstack([col * a[..., None], a])
    big = np.stack([np.asarray(Image.fromarray((pre[..., i] * 65535).astype(np.uint16).astype(np.int32), 'I')
                               .resize((W, H), Image.LANCZOS)).astype(np.float32) / 65535 for i in range(4)], -1)
    big = np.clip(big, 0, 1)
    ab = big[..., 3]
    colb = np.clip(big[..., :3] / np.maximum(ab[..., None], 1e-3), 0, 1)
    ab = suave(ab, *corte)
    if manchas:                                                      # puntitos sueltos del fondo
        lab, n = ndimage.label(ab > 0.25)
        tam = ndimage.sum(np.ones_like(ab), lab, range(1, n + 1))
        chicas = np.isin(lab, np.where(tam < manchas)[0] + 1)
        ab[ndimage.binary_dilation(chicas, iterations=2) & ~np.isin(lab, np.where(tam >= manchas)[0] + 1)] = 0
    out = Image.fromarray(np.dstack([colb * 255, ab * 255]).round().astype(np.uint8), 'RGBA')
    bb = Image.fromarray((ab > 0.04).astype(np.uint8) * 255).getbbox()
    out = out.crop(bb)
    pad = int(max(out.size) * 0.04)
    lienzo = Image.new('RGBA', (out.width + 2 * pad, out.height + 2 * pad), (0, 0, 0, 0))
    lienzo.alpha_composite(out, (pad, pad))
    f = lado / max(lienzo.size)
    if f < 1: lienzo = lienzo.resize((round(lienzo.width * f), round(lienzo.height * f)), Image.LANCZOS)
    # Lo totalmente transparente sin color (PNG más liviano).
    arr = np.asarray(lienzo).copy(); arr[arr[..., 3] == 0] = 0
    Image.fromarray(arr, 'RGBA').save(dst, optimize=True)
    print(dst, lienzo.size)

if __name__ == '__main__':
    modo, src, dst = sys.argv[1:4]
    if modo == 'claro':
        limpiar(src, dst, 'claro_sobre_negro', 0.17, 0.52, corte=(0.04, 0.96), manchas=60)
    else:
        limpiar(src, dst, 'oscuro_sobre_blanco', 0.15, 0.85, corte=(0.3, 0.7))
