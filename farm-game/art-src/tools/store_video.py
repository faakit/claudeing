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

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store_art as A  # noqa: E402

STORE = os.environ.get('STORE_OUT', 'C:/Users/andre/dev/tiny-acre/marketing')
FRAMES = os.path.join(STORE, 'video', 'frames')
WORK = os.path.join(STORE, 'video', 'cut')
FPS = 30
XF = 8  # cross-dissolve frames

# (moment, first frame, last frame, caption, cues as (sfx, seconds into the beat))
BEATS = [
    ('letter', 0, 89, 'A letter from Rosa', []),
    ('green', 0, 104, 'Bring the green back', [('green', 0.1)]),
    ('field', 12, 91, 'Grow a full field', [('swing', 0.62), ('harvest', 0.78)]),
    ('tow', 8, 157, 'Tow timber downriver', [('logHook', 0.4), ('logTug', 2.1), ('logTug', 3.0)]),
    ('river', 0, 94, 'The river comes home', [('green', 0.1)]),
    ('senna', 30, 114, 'Welcome families home', [('homecoming', 0.0)]),
    ('fishing', 30, 183, 'Fish the living river', [('select', 0.4), ('ui', 0.6), ('harvest', 3.05)]),
]
# SOCIAL=1: the social-media trailer, which opens on an AI-generated (Google Flow, Veo 3.1) shot animated from a real
# capture of the dry farm (frames in video/frames/veo-intro, 800x1600). Never used in the Play Store video.
SOCIAL = os.environ.get('SOCIAL') == '1'
if SOCIAL:
    BEATS.insert(0, ('veo-intro', 1, 105, 'The valley is fading', []))
END_FRAMES = 78
CARD = ('The Dry Year', 'Bring the valley back')


def end_card():
    """The last frame: the logo carved as on the title, the chapter, and the green farm (a real capture at 3x)
    under it. No store claims."""
    img = Image.new('RGB', (A.W, A.H), A.INK)
    farm = Image.open(os.path.join(A.RAW, 'wide', 'wide-store-full-field-farm-14-13.png')).convert('RGB')
    d = ImageDraw.Draw(img)
    d.rectangle([28 - 12, 1290 - 12, 28 + 1022 + 12, 1290 + 499 + 12], fill=A.WOOD)
    d.rectangle([28 - 8, 1290 - 8, 28 + 1022 + 8, 1290 + 499 + 8], fill=A.EARTH)
    d.rectangle([28 - 4, 1290 - 4, 28 + 1022 + 4, 1290 + 499 + 4], fill=A.INK)
    img.paste(farm.crop((0, 0, 1023, 500)), (28, 1290))
    cx = A.W // 2
    A.embossed(img, 'TINY', cx, 300, 26, 6)
    A.embossed(img, 'ACRE', cx, 540, 26, 6)
    A.embossed(img, CARD[0], cx, 860, 10, 4, face=A.CREAM)
    A.embossed(img, CARD[1], cx, 1040, 8, 4, face=A.SAND)
    return img


def clips():
    """Each clip as (get frame i, first, last): the beats in their caption frames, then the end card."""
    out = []
    px = min(A.caption_px(cap) for _, _, _, cap, _ in BEATS)
    for name, a, b, cap, _ in BEATS:
        frame = A.band(cap, px)

        def get(i, name=name, frame=frame):
            return A.compose(Image.open(os.path.join(FRAMES, name, f'{i:04d}.png')), None, frame=frame)

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
    green_at = starts[[b[0] for b in BEATS].index('green')] / FPS
    cues = []
    for k, (_, _, _, _, cs) in enumerate(BEATS):
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
