# Ícono y pantalla de inicio de la app a partir del logo HD, sobre el azul del sitio.
# Desde app/:  python3 assets/generar_iconos.py ../yourlift_logo_hd.png assets  &&  npm run iconos
import sys
from PIL import Image
LOGO, OUT = sys.argv[1], sys.argv[2]
NAVY = (10, 22, 40, 255)
logo = Image.open(LOGO).convert('RGBA'); logo = logo.crop(logo.getbbox())

def con_logo(lado_w, lado_h, ancho, fondo):
    im = Image.new('RGBA', (lado_w, lado_h), fondo)
    w = int(ancho); h = int(logo.height * w / logo.width)
    l = logo.resize((w, h), Image.LANCZOS)
    im.alpha_composite(l, ((lado_w - w) // 2, (lado_h - h) // 2))
    return im

con_logo(1024, 1024, 1024 * 0.80, NAVY).convert('RGB').save(f'{OUT}/icon-only.png')
con_logo(1024, 1024, 1024 * 0.78, (0, 0, 0, 0)).save(f'{OUT}/icon-foreground.png')
Image.new('RGB', (1024, 1024), NAVY[:3]).save(f'{OUT}/icon-background.png')
s = con_logo(2732, 2732, 1000, NAVY).convert('RGB')
s.save(f'{OUT}/splash.png'); s.save(f'{OUT}/splash-dark.png')
print('ok')
