"""Render art-src/flow/prompts.json (+ the shared preambles) to art-src/flow/prompts.md."""
import json
import os

D = os.path.join(os.path.dirname(__file__), "..", "flow")
P = json.load(open(os.path.join(D, "prompts.json")))
pre = {
    "standard": open(os.path.join(D, "preamble.txt")).read().strip(),
    "character": open(os.path.join(D, "preamble-character.txt")).read().strip(),
}
out = [
    "# Google Flow prompts",
    "",
    "Every image used as source material, generated with Google Flow (model Nano Banana 2.1) by the project",
    "owner's account, 2 outputs per prompt (`-a`, `-b`). Raw downloads are kept outside the repo",
    "(`flow-raw/<id>-a.jpg`); the per-sprite crops that feed the pipeline are in `crops/<id><variant>/`.",
    "Each prompt is the shared preamble followed by the body below. Generated file: edit `prompts.json`.",
    "",
]
for k, v in pre.items():
    out += [f"## Preamble: {k}", "", "> " + v, ""]
out += [f"Generations: **{len(P)}** prompts.", ""]
for i, p in enumerate(P, 1):
    out += [
        f"## {i}. `{p['id']}` ({p.get('aspect', '1:1')}, preamble: {p.get('preamble', 'standard')})",
        "",
        "> " + p["body"],
        "",
        f"- raw: {', '.join(p['raw'])}",
        f"- used: {p.get('used', '')}",
    ]
    if p.get("note"):
        out.append(f"- note: {p['note']}")
    out.append("")
open(os.path.join(D, "prompts.md"), "w", newline="\n").write("\n".join(out))
print(len(P), "prompts")
