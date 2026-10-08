"""Print a coarse envelope (10 ms blocks: peak and mean) of one file, to see attacks, DC and tails."""
import sys

import numpy as np

sys.path.insert(0, __file__.rsplit("/", 1)[0].rsplit("\\", 1)[0])
from analyze import SR, load  # noqa: E402

x = load(sys.argv[1])
blk = SR // 100
n = int(sys.argv[2]) if len(sys.argv) > 2 else 40
for i in range(min(n, len(x) // blk)):
    b = x[i * blk : (i + 1) * blk]
    print(f"{i*10:5d}ms peak {np.abs(b).max():.3f} mean {b.mean():+.3f}")
