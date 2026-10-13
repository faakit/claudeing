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

import math

from PIL import Image, ImageDraw, ImageFilter

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

# The story set (store/BRIEF.md): the store order, the raw capture(s) each frame uses, and its caption.
STORY = [
    ('hero', ('hero-dry', 'hero-green'), None,
     {'en': 'Bring a fading valley back to life', 'pt-BR': 'Faça o vale florescer de novo'}),
    # the logo and the letter at 5x (game px 8-192 x 25-285)
    ('letter', ('letter-5x',), (40, 125, 960, 1425),
     {'en': "Your grandmother's farm is waiting", 'pt-BR': 'A fazenda da sua avó te espera'}),
    # HOME AGAIN, Senna at her door, Mara at the store, at 5x (game px 8-192 x 74-334)
    ('homecoming', ('homecoming-5x',), (40, 370, 960, 1670),
     {'en': 'Rebuild homes. Welcome families back', 'pt-BR': 'Reerga as casas. Receba quem volta'}),
    ('river', ('river-town',), None,
     {'en': 'The river finds its way home', 'pt-BR': 'O rio encontra o caminho de casa'}),
    ('field', ('cozy',), None,
     {'en': 'Your fields, at your own pace', 'pt-BR': 'Sua roça, no seu ritmo'}),
    # the Marls' house in scaffolding at 8x (game px 75-175 of the world view)
    ('rebuild', ('rebuild-8x',), (600, 0, 1400, 1304),
     {'en': 'Rebuild the town, house by house', 'pt-BR': 'Reerga a vila, casa por casa'}),
    ('hand', ('hand',), None,
     {'en': 'Made for one hand', 'pt-BR': 'Feito para jogar com uma mão'}),
]
FLOW = os.environ.get('STORE_FLOW', os.path.join(os.path.dirname(RAW), 'flow-raw'))
FEATURE = {'en': 'The Dry Year', 'pt-BR': 'O Ano Seco'}
# The feature graphic's key art (round 4: Nano Banana from the current build's dry and green farm captures and the
# town river; the extra rowboat it painted was removed, so only things the game has are in it) and its crop's top row
KEY_ART = os.path.join('r4', 'key-b2-noboat.png')
KEY_TOP = 0
# The backdrop behind every screenshot (round 4: Nano Banana from the key art and the same two captures): straw down
# the left edge, green and the river down the right, so the frame sits on the valley's change
BACKDROP = os.environ.get('STORE_BACKDROP', os.path.join('r4', 'bd-a2.jpg'))


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


PANEL = (800, 1304)  # the clean world view, 200x326 game px at 4x
PANEL_AT = ((W - PANEL[0]) // 2, 500)


def backdrop():
    """The painted key art behind every frame (Google Flow, Nano Banana, from real screenshots): atmosphere only."""
    bd = Image.open(os.path.join(FLOW, BACKDROP)).convert('RGB')
    k = W / bd.width
    bd = bd.resize((W, round(bd.height * k)), Image.LANCZOS).crop((0, 0, W, H))
    # an ink veil over the sky so the caption reads at any size
    veil = Image.new('L', (1, H), 0)
    for y in range(490):
        veil.putpixel((0, y), int(215 * (1 - y / 490) ** 0.8))
    veil = veil.resize((W, H))
    return Image.composite(Image.new('RGB', (W, H), INK), bd, veil)


def fits(text, px, maxw):
    lines = wrap(text, px, maxw)
    return len(lines) <= 2 and all(text_width(line, px) <= maxw for line in lines)


def story_px(locale):
    """One caption size for the whole set: the largest that sets every caption in at most two lines."""
    return next((px for px in (12, 11, 10, 9) if all(fits(c[locale], px, W - 100) for *_, c in STORY)), 9)


def caption(img, text, px):
    lines = wrap(text, px, W - 100)
    lh = 9 * px + 6 * 4
    block = len(lines) * lh - 6 * 4
    top = 60 + (400 - block) // 2
    for i, line in enumerate(lines):
        embossed(img, line, W // 2, top + i * lh, px, 5)


def framed(img, panel, at):
    """Set a captured frame into the store image: a soft ink shadow, the wood rim, the panel."""
    x, y = at
    w, h = panel.size
    sh = Image.new('L', img.size, 0)
    ImageDraw.Draw(sh).rectangle([x - 4, y + 8, x + w + 20, y + h + 28], fill=120)
    img.paste(Image.new('RGB', img.size, INK), (0, 0), sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(img)
    d.rectangle([x - 16, y - 16, x + w + 15, y + h + 15], fill=INK)
    d.rectangle([x - 12, y - 12, x + w + 11, y + h + 11], fill=WOOD)
    d.rectangle([x - 8, y - 8, x + w + 7, y + h + 7], fill=EARTH)
    d.rectangle([x - 4, y - 4, x + w + 3, y + h + 3], fill=INK)
    img.paste(panel, (x, y))


def split(dry, green, unit=4):
    """The hero: the same view parched and green, joined by the game's dithered reveal edge on the game-pixel grid,
    leaning like the light (the green spreads in from the lower right)."""
    out = dry.copy()
    gp, op = green.load(), out.load()
    b = bayer()
    w, h = out.size
    for gy in range(h // unit):
        for gx in range(w // unit):
            edge = w * 0.52 - (gy * unit - h / 2) * 0.45
            t = (gx * unit - edge) / 70 + 0.5
            if t >= 1 or (t > 0 and t > b(gx, gy)):
                for yy in range(gy * unit, gy * unit + unit):
                    for xx in range(gx * unit, gx * unit + unit):
                        op[xx, yy] = gp[xx, yy]
    return out


def thumb(img, tip):
    """A pixel-art thumb (8 px pixels, the palette's sand and ink) reaching up to the Action button from the lower
    right: it says "one hand" and covers only the edge of the button."""
    U = 8
    small = Image.new('RGBA', (W // U, H // U), (0, 0, 0, 0))
    d = ImageDraw.Draw(small)
    tx, ty = tip[0] / U, tip[1] / U
    ang = math.radians(32)
    dx, dy = math.sin(ang), math.cos(ang)  # down and to the right
    nx, ny = dy, -dx
    pts = []
    for k in range(0, 181, 12):  # the rounded tip
        a = math.radians(k)
        r = 6.5
        pts.append((tx + r * (math.cos(a) * nx - math.sin(a) * dx), ty + r * (math.cos(a) * ny - math.sin(a) * dy)))
    L = 60
    pts.append((tx - 8.5 * nx + L * dx, ty - 8.5 * ny + L * dy))
    pts.append((tx + 8.5 * nx + L * dx, ty + 8.5 * ny + L * dy))
    d.polygon(pts, fill=(42, 26, 36, 255))
    inner = [(x - (x - tx - 20 * dx) * 0.14, y - (y - ty - 20 * dy) * 0.14) for x, y in pts]
    d.polygon(inner, fill=(220, 180, 124, 255))
    d.polygon([(x + 1.5 * nx, y + 1.5 * ny) for x, y in inner[len(inner) // 2:]], fill=(180, 124, 76, 255))
    d.ellipse([tx - 3, ty - 1, tx + 2, ty + 4], fill=(244, 228, 188, 255))
    big = small.resize((W, H), Image.NEAREST)
    img.paste(big, (0, 0), big)


def phone(img, screen, at):
    """A phone held upright: an ink body and bezel around the 600x1200 capture (3x)."""
    x, y = at
    w, h = screen.size
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x - 36, y - 56, x + w + 35, y + h + 55], radius=64, fill=(20, 16, 31))
    d.rounded_rectangle([x - 30, y - 50, x + w + 29, y + h + 49], radius=58, outline=(90, 72, 96), width=4)
    d.rounded_rectangle([x + w // 2 - 50, y - 34, x + w // 2 + 50, y - 22], radius=6, fill=(58, 48, 80))
    img.paste(screen, (x, y))


def story_shot(locale, name, raws, crop, text, px):
    img = backdrop()
    caption(img, text, px)

    def load(r):
        return Image.open(os.path.join(RAW, locale, f'{r}.png')).convert('RGB')

    if name == 'hero':
        framed(img, split(load(raws[0]), load(raws[1])), PANEL_AT)
    elif name == 'hand':
        scr = load('hand')
        assert scr.size == (600, 1200), scr.size
        at = ((W - 600) // 2, 600)
        phone(img, scr, at)
        # the Action button's centre is about (165, 344) game px: 3x, from the screen's corner
        thumb(img, (at[0] + 165 * 3 + 6, at[1] + 344 * 3 + 30))
    else:
        panel = load(raws[0])
        if crop:
            panel = panel.crop(crop)
        framed(img, panel, ((W - panel.width) // 2, PANEL_AT[1]))
    return img


def shots():
    paths = []
    for locale in ('en', 'pt-BR'):
        out = os.path.join(OUT, 'screenshots', locale)
        os.makedirs(out, exist_ok=True)
        for f in os.listdir(out):
            os.remove(os.path.join(out, f))
        px = story_px(locale)
        for i, (name, raws, crop, caps) in enumerate(STORY, 1):
            p = os.path.join(out, f'{i:02d}-{name}.png')
            story_shot(locale, name, raws, crop, caps[locale], px).save(p, optimize=True)
            paths.append(p)
    return paths


# ---- feature graphic --------------------------------------------------------------------------------------------

def bayer(n=4):
    m = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    return lambda x, y: m[y % n][x % n] / 16


def feature(locale='en'):
    """1024x500: one evocative image, the valley half straw and half green under a dusk sky (key art painted with
    Google Flow, Nano Banana, from real screenshots), with the TINY ACRE logo carved in the game's own font."""
    art = Image.open(os.path.join(FLOW, KEY_ART)).convert('RGB')
    art = art.crop((0, KEY_TOP, 1376, KEY_TOP + 672)).resize((1024, 500), Image.LANCZOS)
    veil = Image.new('L', (1024, 500), 0)
    ImageDraw.Draw(veil).ellipse([230, -70, 794, 150], fill=120)
    veil = veil.filter(ImageFilter.GaussianBlur(28))
    img = Image.composite(Image.new('RGB', (1024, 500), INK), art, veil)
    embossed(img, 'TINY ACRE', 512, 18, 8, 3)
    embossed(img, FEATURE[locale], 512, 92, 4, 2, face=CREAM)
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
    """One contact sheet per language: the 7 screenshots, that language's feature graphic at full and Play-card size,
    and the icon at 512 and at launcher size. Written next to raw/ as contact-sheet-<locale>.png."""
    tw, th = 270, 480
    paths = []
    for locale in ('en', 'pt-BR'):
        img = Image.new('RGB', (len(STORY) * (tw + 8) + 8, th + 16 + 516), INK)
        for c, (name, *_) in enumerate(STORY):
            sh = Image.open(os.path.join(OUT, 'screenshots', locale, f'{c + 1:02d}-{name}.png'))
            img.paste(sh.resize((tw, th), Image.LANCZOS), (8 + c * (tw + 8), 8))
        y = th + 16
        f = 'feature-graphic.png' if locale == 'en' else f'feature-graphic.{locale}.png'
        fg = Image.open(os.path.join(OUT, f)).convert('RGB')
        img.paste(fg, (8, y))
        img.paste(fg.resize((256, 125), Image.LANCZOS), (1040, y))
        ic = Image.open(os.path.join(OUT, 'icon-512.png')).convert('RGB')
        img.paste(ic.resize((256, 256), Image.LANCZOS), (1040, y + 135))
        img.paste(ic.resize((96, 96), Image.LANCZOS), (1306, y + 135))
        img.paste(ic.resize((48, 48), Image.LANCZOS), (1412, y + 135))
        p = os.path.join(os.path.dirname(RAW), f'contact-sheet-{locale}.png')
        img.save(p)
        paths.append(p)
    return paths


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
