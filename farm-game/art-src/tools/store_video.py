"""The Google Play promo video (portrait 1080x1920, 30 fps, H.264), cut from real gameplay frames.

Frames come from `node scripts/store-capture.mjs video en` ($STORE_OUT/video/frames/<moment>/NNNN.png, stepped
from the game's own loop: no screen recording). Each beat is set in the store frame with its caption
(store_art.py), beats are joined by short cross-dissolves, and the soundtrack is the game's own mix rendered
offline (`store-capture.mjs audio`: the summer music thinned for the dry valley and filling back in at the first
green, with the game's sfx cued to the cut). An optional intro clip (e.g. a Flow/Veo shot, 1080x1920) is prepended
with INTRO=<mp4>.

    python art-src/tools/store_video.py            (writes $STORE_OUT/video/tiny-acre-promo-en.mp4)
    LOCALE=pt-BR python art-src/tools/store_video.py   (the pt-BR cut: pt-BR frames where the game shows text, captions
                                                   and the end card in Portuguese)
"""
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store_art as A  # noqa: E402

STORE = os.environ.get('STORE_OUT', 'C:/Users/andre/dev/tiny-acre/marketing')
FRAMES = os.path.join(STORE, 'video', 'frames')
WORK = os.path.join(STORE, 'video', 'cut')
FPS = 30
XF = 8  # cross-dissolve frames

# The story arc (store/BRIEF.md). (moment, first frame, last frame, caption, cues as (sfx, seconds into the beat),
# crop of a full-screen capture to the 800x1304 panel or None for the clean world view)
TITLE_CROP = (0, 120, 800, 1424)
SHEET_CROP = (0, 296, 800, 1600)
LOCALE = os.environ.get('LOCALE', 'en')
CAPS = {name: caps[LOCALE] for name, _, _, caps in A.STORY}
# The bite comes at a random moment, so each language's fishing capture has its own range: 20 frames before the reel
# bar appears, then the reel and about a second of the catch (round 4: the reel starts at 123 in en and 77 in pt-BR)
# and it ends 1.5 s into the catch result, so the result is seen whole before the end card dissolves in
FISH = {'en': (103, 251), 'pt-BR': (57, 205)}
# the catch has its own caption (critic V2: the field's caption must not promise the fishing)
FISH_CAP = {'en': 'Cast a line, land a catch', 'pt-BR': 'Jogue a linha e fisgue'}
# The hook: the first green captured at half speed (green-clean@slow, STORE_STEP=1), so it starts on the first frame
# and is still spreading at 1.3 s. The river: its cracked bed filling under the game's own THE RIVER IS BACK banner
# (river-bed, STORE_KEEP=54,55), water in the frame from the start of the beat to its end.
BEATS = [
    ('green-clean@slow', 10, 100, CAPS['hero'], [('green', 0.05)], None),
    ('letter', 0, 89, CAPS['letter'], [], TITLE_CROP),
    ('river-bed', 0, 104, CAPS['river'], [('green', 0.1)], None),
    ('senna', 0, 109, CAPS['homecoming'], [('homecoming', 0.0)], (0, 0, 800, 1304)),
    ('cozy', 10, 95, CAPS['field'], [('swing', 0.33), ('harvest', 0.5)], None),
    ('fishing', *FISH[LOCALE], FISH_CAP[LOCALE], [('ui', 0.67), ('harvest', 3.43)], SHEET_CROP),
]
# SOCIAL=1: the social-media trailer, which opens on an AI-generated (Google Flow, Veo 3.1) shot animated from a real
# capture of the dry farm (frames in video/frames/veo-intro, 800x1600). Never used in the Play Store video.
SOCIAL = os.environ.get('SOCIAL') == '1'
if SOCIAL:
    # round 4: VEO_FRAMES picks the intro's frame range; the clip is 800x1304 (the clean world view)
    va, vb = (int(v) for v in os.environ.get('VEO_FRAMES', '0,119').split(','))
    BEATS.insert(0, ('veo-intro', va, vb, {'en': 'The valley is fading', 'pt-BR': 'O vale está secando'}[LOCALE],
                     [], None))
END_FRAMES = 84
CARD = {'en': 'The Dry Year', 'pt-BR': 'O Ano Seco'}
STUDIO = 'Quiet Spirit Studio'


def end_card():
    """The last frame: the painted key art (Flow, the valley half straw and half green), the logo carved as on the
    title, the chapter. No store claims."""
    img = A.backdrop()
    art = Image.open(os.path.join(A.FLOW, A.KEY_ART)).convert('RGB').crop((0, A.KEY_TOP, 1376, A.KEY_TOP + 672))
    art = art.resize((1000, round(art.height * 1000 / art.width)), Image.LANCZOS)
    A.framed(img, art, (40, 880))
    cx = A.W // 2
    A.embossed(img, 'TINY', cx, 170, 24, 6)
    A.embossed(img, 'ACRE', cx, 400, 24, 6)
    veil = Image.new('L', img.size, 0)
    ImageDraw.Draw(veil).rounded_rectangle([170, 650, A.W - 170, 790], radius=40, fill=150)
    img = Image.composite(Image.new('RGB', img.size, A.INK), img, veil.filter(ImageFilter.GaussianBlur(14)))
    A.embossed(img, CARD[LOCALE], cx, 680, 10, 4, face=A.CREAM)
    # the studio's sign-off, small, on an ink plate under the key art
    w = A.text_width(STUDIO, 6) + 80
    ImageDraw.Draw(img).rounded_rectangle([cx - w // 2, 1560, cx + w // 2, 1660], radius=20, fill=A.INK)
    A.embossed(img, STUDIO, cx, 1588, 6, 2, face=A.SAND)
    return img


def clips():
    """Each clip as (get frame i, first, last): the beats in their story frames, then the end card."""
    out = []
    px = A.story_px(LOCALE)
    blank = Image.new('RGB', A.PANEL, A.INK)
    for name, a, b, cap, _, crop in BEATS:
        base = A.backdrop()
        A.caption(base, cap, px)
        A.framed(base, blank, A.PANEL_AT)
        ai = name == 'veo-intro'

        def get(i, name=name, base=base, crop=crop, ai=ai):
            d = os.path.join(FRAMES, f'{name}@{LOCALE}')
            d = d if LOCALE != 'en' and os.path.isdir(d) else os.path.join(FRAMES, name)
            shot = Image.open(os.path.join(d, f'{i:04d}.png')).convert('RGB')
            if crop:
                shot = shot.crop(crop)
            img = base.copy()
            img.paste(shot, A.PANEL_AT)
            if ai:
                # the AI footage is labelled on screen for as long as it shows (critic rule for the social trailer)
                label = {'en': 'AI-assisted intro', 'pt-BR': 'Intro feita com IA'}[LOCALE]
                w = A.text_width(label, 4) + 48
                x, y = A.W // 2, A.PANEL_AT[1] + A.PANEL[1] - 90
                ImageDraw.Draw(img).rounded_rectangle([x - w // 2, y - 20, x + w // 2, y + 52], radius=16, fill=A.INK)
                A.draw_text(img, label, x - A.text_width(label, 4) // 2, y, 4, A.CREAM)
            return img

        out.append((get, a, b))
    end = end_card()
    out.append((lambda i: end, 0, END_FRAMES - 1))
    return out


def render(work):
    """Write the cut's frames to `work`, each clip dissolving over the previous one's last XF frames (only those
    are held in memory). Returns the frame count and where each clip starts."""
    starts = []
    tail = []  # the last XF frames, not yet written: (index, image)
    n = 0

    def flush(keep):
        while len(tail) > keep:
            i, im = tail.pop(0)
            im.save(os.path.join(work, f'{i:04d}.png'), compress_level=1)

    for k, (get, a, b) in enumerate(clips()):
        starts.append(n - (XF if k else 0))
        for j in range(b - a + 1):
            img = get(a + j)
            if k > 0 and j < XF:
                idx, prev = tail[j]
                tail[j] = (idx, Image.blend(prev, img, (j + 1) / (XF + 1)))
                continue
            tail.append((n, img))
            n += 1
            flush(XF)
    flush(0)
    return n, starts


def main():
    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK)
    count, starts = render(WORK)
    end_card().save(os.path.join(STORE, 'video', f'end-card-{LOCALE}.png'))
    seconds = count / FPS
    print(f'{count} frames, {seconds:.2f} s; beats start at', [round(s / FPS, 2) for s in starts])
    # the soundtrack: summer music, thin while the valley is dry, full from the first green
    green_at = starts[[b[0] for b in BEATS].index('green-clean@slow')] / FPS
    cues = []
    for k, (_, _, _, _, cs, _) in enumerate(BEATS):
        for cue, at in cs:
            cues.append({'cue': cue, 'at': round(starts[k] / FPS + at, 3)})
    opts = {
        'seconds': round(seconds + 0.5, 2),
        'slot': 'summer',
        'thin': True,
        'music': 0.7,
        'sfx': 0.8,
        'changes': [{'at': round(green_at + 0.1, 2), 'thin': False}],
        'cues': cues,
    }
    tag = ('-social' if SOCIAL else '') + ('' if LOCALE == 'en' else f'-{LOCALE}')
    opt_file = os.path.join(STORE, 'video', f'audio-opts{tag}.json')
    wav = os.path.join(STORE, 'video', f'soundtrack{tag}.wav')
    json.dump(opts, open(opt_file, 'w'), indent=1)
    subprocess.run(['node', 'scripts/store-capture.mjs', 'audio', opt_file, wav], cwd=A.ROOT, check=True)
    kind = 'trailer-social' if SOCIAL else 'promo'
    out = os.path.join(STORE, 'video', f'tiny-acre-{kind}-{LOCALE}.mp4')
    fade_out = max(0, seconds - 1.2)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(WORK, '%04d.png'),
           '-i', wav,
           '-af', f'loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.4,afade=t=out:st={fade_out:.2f}:d=1.2',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
           '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart',
           out]
    intro = os.environ.get('INTRO')
    if intro:
        body = out.replace('.mp4', '-body.mp4')
        cmd[-1] = body
        subprocess.run(cmd, check=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', intro, '-i', body, '-filter_complex',
                        '[0:v]scale=1080:1920,fps=30,format=yuv420p,setsar=1[v0];[1:v]setsar=1[v1];'
                        '[0:a][1:a]concat=n=2:v=0:a=1[a];[v0][v1]concat=n=2:v=1:a=0[v]',
                        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
                        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out],
                       check=True)
    else:
        subprocess.run(cmd, check=True)
    print(out)


if __name__ == '__main__':
    main()
