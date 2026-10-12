"""Google Play store art for Tiny Acre: phone screenshots with caption bands, the feature graphic, the 512 icon.

Inputs are real gameplay captures from scripts/store-capture.mjs (raw, outside the repo, default
C:/Users/andre/dev/tiny-acre/marketing/raw) and the icon layers in resources/. Captions are set in the game's own
5x7 pixel font (parsed from src/ui/fontMetrics.ts), embossed like the title logo, on the HUD's plate colours.
Nothing here draws gameplay: every game pixel in a screenshot is a captured pixel, scaled by a whole number.

    python art-src/tools/store_art.py [shots|feature|icon|sheet|all]

Writes store/play/ (committed) and a contact sheet to $STORE_OUT/contact-sheet.png.
"""
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(os.environ.get('STORE_OUT', 'C:/Users/andre/dev/tiny-acre/marketing'), 'raw')
OUT = os.path.join(ROOT, 'store', 'play')

# The game's palette (src/ui/theme.ts)
INK = (42, 26, 36)
EARTH = (76, 44, 28)
SOIL = (124, 68, 44)
WOOD = (180, 124, 76)
SAND = (220, 180, 124)
GOLD = (244, 211, 94)
ORANGE = (228, 140, 36)
CREAM = (244, 234, 210)

# The store order, and each shot's caption (2-5 words).
SHOTS = [
    ('green', {'en': 'Bring the green back', 'pt-BR': 'Traga o verde de volta'}),
    ('letter', {'en': 'A letter from Rosa', 'pt-BR': 'Uma carta da Rosa'}),
    ('field', {'en': 'Grow a full field', 'pt-BR': 'Cultive um campo cheio'}),
    ('tow', {'en': 'Tow timber downriver', 'pt-BR': 'Reboque troncos pelo rio'}),
    ('river', {'en': 'The river comes home', 'pt-BR': 'O rio volta para casa'}),
    ('senna', {'en': 'Welcome families home', 'pt-BR': 'As famílias voltam'}),
    ('fishing', {'en': 'Fish the living river', 'pt-BR': 'Pesque no rio vivo'}),
]
FEATURE = {'en': 'The Dry Year', 'pt-BR': 'O Ano Seco'}


# ---- the font ---------------------------------------------------------------------------------------------------

def load_font():
    src = open(os.path.join(ROOT, 'src', 'ui', 'fontMetrics.ts'), encoding='utf8').read()
    glyphs = {}
    for block, tall in (('GLYPHS', False), ('TALL_GLYPHS', True)):
        body = re.search(r'export const %s[^=]*= \{(.*?)\n\};' % block, src, re.S).group(1)
        for m in re.finditer(r"^\s*(?:'(.+?)'|\"(.+?)\"|(\S)):\s*'([0-9a-f ]+)'", body, re.M):
            ch = m.group(1) or m.group(2) or m.group(3)
            ch = ch.replace("\\'", "'").replace('\\\\', '\\')
            rows = [int(h, 16) for h in m.group(4).split()]
            glyphs[ch] = (rows, tall)
    return glyphs


FONT = load_font()


def glyph(ch):
    rows, tall = FONT.get(ch, FONT['?'])
    cols = [c for c in range(5) if any(r & (1 << (4 - c)) for r in rows)]
    if not cols:
        return rows, tall, 0, 0
    return rows, tall, min(cols), max(cols) - min(cols) + 1


def text_width(text, px):
    """Advance width in device px at `px` device px per font pixel (the game's maths: ink width + 1)."""
    w = 0
    for ch in text:
        if ch == ' ':
            w += 4 * px
            continue
        w += (glyph(ch)[3] + 1) * px
    return max(0, w - px)


def draw_text(img, text, x, y, px, color):
    """Draw at top-left (x, y) of the cap line; tall glyphs reach 2 rows above it, descenders 2 below."""
    d = ImageDraw.Draw(img)
    for ch in text:
        if ch == ' ':
            x += 4 * px
            continue
        rows, tall, lo, w = glyph(ch)
        top = y - (2 * px if tall else 0)
        for r, bits in enumerate(rows):
            for c in range(w):
                if bits & (1 << (4 - (lo + c))):
                    X, Y = x + c * px, top + r * px
                    d.rectangle([X, Y, X + px - 1, Y + px - 1], fill=color)
        x += (w + 1) * px


def embossed(img, text, cx, y, px, unit, face=GOLD):
    """The title logo's carved look: an ink foot, soil and orange extrusion, then the gold face."""
    x = cx - text_width(text, px) // 2
    for dy, col in ((3, INK), (2, SOIL), (1, ORANGE)):
        draw_text(img, text, x, y + dy * unit, px, col)
    draw_text(img, text, x, y, px, face)


def wrap(text, px, maxw):
    if text_width(text, px) <= maxw:
        return [text]
    words = text.split()
    best = None
    for i in range(1, len(words)):
        a, b = ' '.join(words[:i]), ' '.join(words[i:])
        w = max(text_width(a, px), text_width(b, px))
        if best is None or w < best[0]:
            best = (w, [a, b])
    return best[1]


def plate(img, box, unit=4):
    """The HUD's plate: ink outline, earth fill, a wood rim line along the top."""
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(img)
    d.rectangle(box, fill=INK)
    d.rectangle([x0 + unit, y0 + unit, x1 - unit, y1 - unit], fill=EARTH)
    d.rectangle([x0 + 2 * unit, y0 + 2 * unit, x1 - 2 * unit, y0 + 3 * unit - 1], fill=WOOD)


# ---- screenshots ------------------------------------------------------------------------------------------------

W, H = 1080, 1920
GAME = (800, 1600)  # 200x400 game px at 4x, as captured
BAND = 292
GAME_AT = ((W - GAME[0]) // 2, BAND + 8)


def caption_px(caption):
    return next((p for p in (9, 8, 7) if text_width(caption, p) <= W - 140), 7)


def band(caption, px=None):
    """The 1080x1920 frame without the game: the caption plate on ink, and the frame the game sits in."""
    img = Image.new('RGB', (W, H), INK)
    plate(img, (36, 32, W - 37, BAND - 20))
    if caption:
        px = px or caption_px(caption)
        lines = wrap(caption, px, W - 140)
        lh = 9 * px + 4 * 4
        top = 32 + (BAND - 52 - (len(lines) * lh - 4 * 4)) // 2 + 6
        for i, line in enumerate(lines):
            embossed(img, line, W // 2, top + i * lh, px, 4)
    gx, gy = GAME_AT
    d = ImageDraw.Draw(img)
    d.rectangle([gx - 12, gy - 12, gx + GAME[0] + 11, gy + GAME[1] + 11], fill=WOOD)
    d.rectangle([gx - 8, gy - 8, gx + GAME[0] + 7, gy + GAME[1] + 7], fill=EARTH)
    d.rectangle([gx - 4, gy - 4, gx + GAME[0] + 3, gy + GAME[1] + 3], fill=INK)
    return img


def compose(shot, caption, px=None, frame=None):
    """A captured 800x1600 game image set into the store frame (pass a cached `frame` from band())."""
    assert shot.size == GAME, shot.size
    img = (frame or band(caption, px)).copy()
    img.paste(shot.convert('RGB'), GAME_AT)
    return img


def screenshot(locale, name, caption, px=None):
    return compose(Image.open(os.path.join(RAW, locale, f'{name}.png')), caption, px)


def shots():
    paths = []
    for locale in ('en', 'pt-BR'):
        out = os.path.join(OUT, 'screenshots', locale)
        os.makedirs(out, exist_ok=True)
        # one caption size for the whole set: the largest that fits every caption on one line
        px = min(caption_px(caps[locale]) for _, caps in SHOTS)
        for i, (name, caps) in enumerate(SHOTS, 1):
            p = os.path.join(out, f'{i:02d}-{name}.png')
            screenshot(locale, name, caps[locale], px).save(p, optimize=True)
            paths.append(p)
    return paths


# ---- feature graphic --------------------------------------------------------------------------------------------

def bayer(n=4):
    m = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    return lambda x, y: m[y % n][x % n] / 16


def feature(locale='en'):
    """1024x500: the same farm view captured dry and green, joined by the game's dithered reveal edge (in 3 px
    game pixels), the logo carved as on the title, and the chapter's name. Text stays inside the central safe area."""
    dry = Image.open(os.path.join(RAW, 'wide', 'wide-valley-farm-dry-farm-14-13.png')).convert('RGB')
    green = Image.open(os.path.join(RAW, 'wide', 'wide-store-full-field-farm-14-13.png')).convert('RGB')
    img = Image.new('RGB', (1024, 500), INK)
    img.paste(dry, (0, 0))
    # the reveal: green grows from the right in a soft diagonal, dithered on the 3 px game grid
    b = bayer()
    gp = green.load()
    ip = img.load()
    U = 3
    for gy in range(0, 500 // U + 1):
        for gx in range(0, 1023 // U + 1):
            edge = 470 + (gy * U - 250) * 0.35  # the seam leans like the light
            t = (gx * U - edge) / 90 + 0.5
            if t >= 1 or (t > 0 and t > b(gx, gy)):
                for yy in range(gy * U, min(500, gy * U + U)):
                    for xx in range(gx * U, min(1023, gx * U + U)):
                        ip[xx, yy] = gp[xx, yy]
    # a dusk vignette band behind the logo so it reads at any size
    shade = Image.new('RGB', (1024, 500), INK)
    mask = Image.new('L', (1024, 500), 0)
    md = ImageDraw.Draw(mask)
    for i, a in enumerate((70, 110, 150)):
        md.rectangle([260 + i * 24, 60 + i * 12, 763 - i * 24, 330 - i * 12], fill=a)
    img = Image.composite(shade, img, mask)
    # the logo, as on the title: TINY ACRE, carved gold (the title's scale-6 letters, here 4 px per font pixel x 3)
    embossed(img, 'TINY ACRE', 512, 120, 12, 4)
    draw = FEATURE[locale]
    embossed(img, draw, 512, 248, 6, 2, face=CREAM)
    return img


# ---- icon -------------------------------------------------------------------------------------------------------

def icon():
    """512x512, opaque: the Android adaptive icon's two layers (resources/icon-foreground.png over
    icon-background.png, scripts/make-icons.mjs) re-set on whole pixels. The foreground is the 32x32 art inset
    41/1024 on the dusk background; at 512 that is 15 px a pixel (480) inset 16 px, so every art pixel stays square."""
    fg = Image.open(os.path.join(ROOT, 'resources', 'icon-foreground.png')).convert('RGBA')
    bg = Image.open(os.path.join(ROOT, 'resources', 'icon-background.png')).convert('RGB')
    art = Image.open(os.path.join(ROOT, 'resources', 'icon.png')).convert('RGB').resize((32, 32), Image.NEAREST)
    # check the full-bleed art is the foreground's art (same pixels at the same cells)
    probe = fg.crop((41, 41, 1024 - 41, 1024 - 41)).convert('RGB').resize((32, 32), Image.NEAREST)
    diff = sum(1 for a, b in zip(probe.getdata(), art.getdata()) if sum(abs(p - q) for p, q in zip(a, b)) > 30)
    assert diff <= 32, f'icon.png and icon-foreground.png differ ({diff} cells)'
    out = Image.new('RGB', (512, 512), bg.getpixel((0, 0)))
    out.paste(art.resize((480, 480), Image.NEAREST), (16, 16))
    return out.convert('RGBA')  # Play asks for a 32-bit PNG; every pixel is opaque


# ---- contact sheet ----------------------------------------------------------------------------------------------

def sheet():
    cols = len(SHOTS)
    tw, th = 216, 384
    img = Image.new('RGB', (cols * (tw + 8) + 8, 2 * (th + 8) + 8 + 280), INK)
    for r, locale in enumerate(('en', 'pt-BR')):
        for c, (name, _) in enumerate(SHOTS):
            s = Image.open(os.path.join(OUT, 'screenshots', locale, f'{c + 1:02d}-{name}.png'))
            img.paste(s.resize((tw, th), Image.LANCZOS), (8 + c * (tw + 8), 8 + r * (th + 8)))
    y = 2 * (th + 8) + 8
    fg = Image.open(os.path.join(OUT, 'feature-graphic.png')).resize((512, 250), Image.LANCZOS)
    img.paste(fg, (8, y))
    ic = Image.open(os.path.join(OUT, 'icon-512.png')).resize((250, 250), Image.LANCZOS)
    img.paste(ic, (528, y))
    small = Image.open(os.path.join(OUT, 'feature-graphic.png')).resize((256, 125), Image.LANCZOS)
    img.paste(small, (788, y))
    p = os.path.join(os.path.dirname(RAW), 'contact-sheet.png')
    img.save(p)
    return p


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    os.makedirs(OUT, exist_ok=True)
    if what in ('icon', 'all'):
        icon().save(os.path.join(OUT, 'icon-512.png'), optimize=True)
        print('icon-512.png')
    if what in ('feature', 'all'):
        feature('en').save(os.path.join(OUT, 'feature-graphic.png'), optimize=True)
        feature('pt-BR').save(os.path.join(OUT, 'feature-graphic.pt-BR.png'), optimize=True)
        print('feature-graphic.png, feature-graphic.pt-BR.png')
    if what in ('shots', 'all'):
        for p in shots():
            print(os.path.relpath(p, ROOT))
    if what in ('sheet', 'all'):
        print(sheet())
