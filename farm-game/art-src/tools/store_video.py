"""The Google Play promo video (portrait 1080x1920, 30 fps, H.264), cut from real gameplay frames.

Frames come from `node scripts/store-capture.mjs video en` ($STORE_OUT/video/frames/<moment>/NNNN.png, stepped
from the game's own loop: no screen recording). Each beat is set in the store frame with its caption
(store_art.py), beats are joined by short cross-dissolves, and the soundtrack is the game's own mix rendered
offline (`store-capture.mjs audio`: the summer music thinned for the dry valley and filling back in at the first
green, with the game's sfx cued to the cut). An optional intro clip (e.g. a Flow/Veo shot, 1080x1920) is prepended
with INTRO=<mp4>.

    python art-src/tools/store_video.py            (writes $STORE_OUT/video/tiny-acre-promo-en.mp4)
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
BEATS = [
    ('green-clean', 0, 104, 'Bring a fading valley back to life', [('green', 0.25)], None),
    ('letter', 0, 89, "Your grandmother's farm is waiting", [], TITLE_CROP),
    ('river-clean', 0, 104, 'The river finds its way home', [('green', 0.2)], None),
    ('senna', 0, 109, 'Rebuild homes. Welcome families back', [('homecoming', 0.0)], (0, 0, 800, 1304)),
    ('cozy', 10, 95, 'Your fields, at your own pace', [('swing', 0.33), ('harvest', 0.5)], None),
    ('fishing', 60, 183, 'Your fields, at your own pace', [('ui', 0.1), ('harvest', 2.05)], SHEET_CROP),
]
# SOCIAL=1: the social-media trailer, which opens on an AI-generated (Google Flow, Veo 3.1) shot animated from a real
# capture of the dry farm (frames in video/frames/veo-intro, 800x1600). Never used in the Play Store video.
SOCIAL = os.environ.get('SOCIAL') == '1'
if SOCIAL:
    BEATS.insert(0, ('veo-intro', 1, 105, 'The valley is fading', [], (0, 148, 800, 1452)))
END_FRAMES = 84
CARD = {'en': 'The Dry Year', 'pt-BR': 'O Ano Seco'}
STUDIO = 'Quiet Spirit Studio'


def end_card():
    """The last frame: the painted key art (Flow, the valley half straw and half green), the logo carved as on the
    title, the chapter. No store claims."""
    img = A.backdrop()
    art = Image.open(os.path.join(A.FLOW, 'key-split-2.jpg')).convert('RGB')
    art = art.resize((1000, round(art.height * 1000 / art.width)), Image.LANCZOS)
    A.framed(img, art, (40, 900))
    cx = A.W // 2
    A.embossed(img, 'TINY', cx, 170, 24, 6)
    A.embossed(img, 'ACRE', cx, 400, 24, 6)
    veil = Image.new('L', img.size, 0)
    ImageDraw.Draw(veil).rounded_rectangle([170, 650, A.W - 170, 790], radius=40, fill=150)
    img = Image.composite(Image.new('RGB', img.size, A.INK), img, veil.filter(ImageFilter.GaussianBlur(14)))
    A.embossed(img, CARD['en'], cx, 680, 10, 4, face=A.CREAM)
    # the studio's sign-off, small, on an ink plate under the key art
    w = A.text_width(STUDIO, 6) + 80
    ImageDraw.Draw(img).rounded_rectangle([cx - w // 2, 1500, cx + w // 2, 1600], radius=20, fill=A.INK)
    A.embossed(img, STUDIO, cx, 1528, 6, 2, face=A.SAND)
    return img


def clips():
    """Each clip as (get frame i, first, last): the beats in their story frames, then the end card."""
    out = []
    px = A.story_px('en')
    blank = Image.new('RGB', A.PANEL, A.INK)
    for name, a, b, cap, _, crop in BEATS:
        base = A.backdrop()
        A.caption(base, cap, px)
        A.framed(base, blank, A.PANEL_AT)

        def get(i, name=name, base=base, crop=crop):
            shot = Image.open(os.path.join(FRAMES, name, f'{i:04d}.png')).convert('RGB')
            if crop:
                shot = shot.crop(crop)
            img = base.copy()
            img.paste(shot, A.PANEL_AT)
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
    seconds = count / FPS
    print(f'{count} frames, {seconds:.2f} s; beats start at', [round(s / FPS, 2) for s in starts])
    # the soundtrack: summer music, thin while the valley is dry, full from the first green
    green_at = starts[[b[0] for b in BEATS].index('green-clean')] / FPS
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
    tag = '-social' if SOCIAL else ''
    opt_file = os.path.join(STORE, 'video', f'audio-opts{tag}.json')
    wav = os.path.join(STORE, 'video', f'soundtrack{tag}.wav')
    json.dump(opts, open(opt_file, 'w'), indent=1)
    subprocess.run(['node', 'scripts/store-capture.mjs', 'audio', opt_file, wav], cwd=A.ROOT, check=True)
    out = os.path.join(STORE, 'video', 'tiny-acre-trailer-social-en.mp4' if SOCIAL else 'tiny-acre-promo-en.mp4')
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
