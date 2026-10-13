"""Set up and start CourseMap in demo mode on Windows, starting from nothing.

Run it from any folder with:  python run_windows.py

It clones https://github.com/vynride/coursemap into .\\coursemap (or updates it if
it is already there), installs Node.js with winget if needed, builds the frontend,
creates a Python venv with the backend's dependencies, and starts the server at
http://localhost:8765 in demo mode (no Google keys needed). Run it again to update
and restart. Needs git, Python 3.11+ and internet. Also works on macOS and Linux.
"""

import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

REPO_URL = "https://github.com/vynride/coursemap.git"
PORT = int(os.environ.get("PORT", "8765"))
MIN_NODE = 22
WINDOWS = os.name == "nt"


def step(message):
    print(f"\n=== {message}", flush=True)


def fail(message):
    print(f"\nERROR: {message}", flush=True)
    if WINDOWS:
        input("Press Enter to close...")
    sys.exit(1)


def run(cmd, cwd=None):
    print("  >", " ".join(str(c) for c in cmd), flush=True)
    if subprocess.run([str(c) for c in cmd], cwd=cwd).returncode != 0:
        fail(f"this command failed: {' '.join(str(c) for c in cmd)}")


def find_repo():
    """Use the checkout this script sits in, otherwise clone or update .\\coursemap."""
    here = Path(__file__).resolve().parent
    if (here / "backend" / "coursemap").is_dir() and (here / "frontend").is_dir():
        return here
    if not shutil.which("git"):
        fail("git is not installed. Install it from https://git-scm.com/download/win and run this again.")
    repo = Path.cwd() / "coursemap"
    if (repo / ".git").is_dir():
        step("Updating the existing clone")
        run(["git", "pull", "--ff-only"], cwd=repo)
    else:
        step(f"Cloning {REPO_URL}")
        run(["git", "clone", REPO_URL, repo])
    return repo


def node_version(node):
    try:
        out = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
        return int(out.lstrip("v").split(".")[0])
    except (OSError, ValueError):
        return 0


def find_npm():
    """Return the path to npm, installing Node.js LTS with winget when it is missing or too old."""
    extra = [Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs"] if WINDOWS else []
    for attempt in range(2):
        node = shutil.which("node") or next((str(p / "node.exe") for p in extra if (p / "node.exe").exists()), None)
        if node and node_version(node) >= MIN_NODE:
            npm = shutil.which("npm", path=str(Path(node).parent)) or shutil.which("npm")
            if npm:
                return npm
        if attempt == 1 or not WINDOWS or not shutil.which("winget"):
            break
        step(f"Installing Node.js LTS with winget (found {'v' + str(node_version(node)) if node else 'none'}, need {MIN_NODE}+)")
        subprocess.run(["winget", "install", "--id", "OpenJS.NodeJS.LTS", "-e", "--silent",
                        "--accept-package-agreements", "--accept-source-agreements"])
        # winget updates PATH for new terminals only; look in the install folder directly.
        os.environ["PATH"] = os.pathsep.join([str(p) for p in extra] + [os.environ["PATH"]])
    fail(f"Node.js {MIN_NODE} or newer is needed. Install the LTS from https://nodejs.org and run this again.")


def build_frontend(repo):
    npm = find_npm()
    step("Installing frontend packages")
    run([npm, "ci", "--no-audit", "--no-fund"], cwd=repo / "frontend")
    step("Building the frontend")
    run([npm, "run", "build"], cwd=repo / "frontend")


def setup_backend(repo):
    backend = repo / "backend"
    venv = backend / ".venv-run"   # separate from the uv-managed .venv
    python = venv / ("Scripts/python.exe" if WINDOWS else "bin/python")
    if not python.exists():
        step("Creating the Python environment")
        run([sys.executable, "-m", "venv", venv])
    step("Installing backend packages")
    run([python, "-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", backend / "requirements.txt"])
    return python


def open_browser_when_ready(url):
    for _ in range(60):
        try:
            urllib.request.urlopen(url + "/api/health", timeout=1)
            print(f"\n=== CourseMap is running at {url}  (Ctrl+C to stop)\n", flush=True)
            webbrowser.open(url)
            return
        except OSError:
            time.sleep(1)


def main():
    if sys.version_info < (3, 11):
        fail(f"Python 3.11 or newer is needed, this is {sys.version.split()[0]}. Install it from https://www.python.org/downloads/")
    repo = find_repo()
    build_frontend(repo)
    python = setup_backend(repo)

    url = f"http://localhost:{PORT}"
    step(f"Starting CourseMap in demo mode on {url}")
    env = {**os.environ, "DEMO": "1", "STATIC_DIR": str(repo / "frontend" / "dist")}
    threading.Thread(target=open_browser_when_ready, args=(url,), daemon=True).start()
    try:
        subprocess.run([str(python), "-m", "uvicorn", "coursemap.main:app", "--port", str(PORT)],
                       cwd=repo / "backend", env=env)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
