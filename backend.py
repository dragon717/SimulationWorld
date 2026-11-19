"""Build the pinned upstream simulator and serve the 3D client on the same origin."""
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent
UPSTREAM = ROOT / "upstream/SimulationWorld"
RUNTIME = ROOT / ".runtime"
SITE = RUNTIME / "site"
BINARY = RUNTIME / ("ecosim.exe" if os.name == "nt" else "ecosim")
PORT = 5184
SERVER_ARGS = ["-addr", f"127.0.0.1:{PORT}", "-cfg", str(UPSTREAM / "cfg"), "-client", str(SITE)]


def prepare():
    if (ROOT / ".git").exists() or not (UPSTREAM / "go.mod").is_file():
        subprocess.run(["git", "submodule", "update", "--init", "--", "upstream/SimulationWorld"], cwd=ROOT, check=True)
    if not (ROOT / "node_modules/three/build/three.module.js").is_file():
        subprocess.run(["npm.cmd" if os.name == "nt" else "npm", "ci"], cwd=ROOT, check=True)
    SITE.mkdir(parents=True, exist_ok=True)
    for name in ("index.html", "viewer.js", "ecosystem.js", "simulation.js", "assets", "previews", "textures", "node_modules/three"):
        source, target = ROOT / name, SITE / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.is_symlink():
            continue
        if os.name == "nt" and source.is_dir():
            if not target.exists():
                subprocess.run(["cmd", "/c", "mklink", "/J", str(target), str(source)], check=True)
        elif os.name == "nt":
            shutil.copy2(source, target)
        else:
            target.symlink_to(source, target_is_directory=source.is_dir())
    subprocess.run(["go", "build", "-o", str(BINARY), "./cmd/serve"], cwd=UPSTREAM, check=True)


if __name__ == "__main__":
    prepare()
    os.chdir(ROOT)
    os.execv(str(BINARY), [str(BINARY), *SERVER_ARGS])
