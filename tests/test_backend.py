"""Exercise the Go engine through the game's HTTP service on a temporary port."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import json
import socket
import subprocess
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend import BINARY, ROOT, SITE, UPSTREAM, prepare


class BackendTest(unittest.TestCase):
    def test_world_api_and_repeatable_reset(self):
        prepare()
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        server = subprocess.Popen(
            [str(BINARY), "-addr", f"127.0.0.1:{port}", "-cfg", str(UPSTREAM / "cfg"), "-client", str(SITE)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        def stop():
            server.terminate()
            server.wait(timeout=5)
        self.addCleanup(stop)
        url = f"http://127.0.0.1:{port}/"

        def state(path, session=None, checkpoint=None):
            method = "GET" if path == "state" else "POST"
            headers = {}
            if session is not None:
                headers["X-Simulation-Session"] = session
            if checkpoint is not None:
                headers["X-Simulation-Checkpoint"] = checkpoint
            with urlopen(Request(url + "api/" + path, headers=headers, method=method), timeout=10) as response:
                return json.load(response)

        for _ in range(100):
            try:
                first = state("state")
                break
            except URLError:
                self.assertIsNone(server.poll())
                time.sleep(.05)
        else:
            self.fail("Go server did not start")
        with urlopen(url, timeout=3) as response:
            self.assertEqual(response.read(), (ROOT / "index.html").read_bytes())
        for name in ("museum.css", "environment.js", "vegetation.js", "textures/meadow-clump.webp", "river.js", "lighting.js", "probe-worker.js", "textures/hall-prefiltered.rgba16f.gz", "textures/floodplain-ground.webp", "ui/gallery.webp", "ui/smoke-glass.webp"):
            with self.subTest(asset=name), urlopen(url + name, timeout=3) as response:
                self.assertEqual(response.read(), (ROOT / name).read_bytes())
        self.assertEqual(first["tick"], 0)
        self.assertEqual(len(first["terrain"]), first["width"] * first["height"])
        self.assertEqual({a["species"] for a in first["animals"]}, {"deer", "tiger", "crocodile"})
        self.assertEqual(state("step")["tick"], 1)
        evolved = state("run?n=99")
        self.assertEqual(evolved["tick"], 100)
        self.assertNotEqual(evolved["animals"], first["animals"])
        self.assertNotEqual(evolved["grass"], first["grass"])
        self.assertTrue({"hunt", "died"} <= {e["type"] for e in evolved["events"]})
        counts = Counter(a["species"] for a in evolved["animals"])
        for kind in counts:
            self.assertEqual(counts[kind], evolved["samples"][-1][kind + "_pop"])
        self.assertNotEqual(state("reset?seed=7")["terrain"], first["terrain"])
        self.assertEqual(state("reset?seed=" + str(first["seed"]))["state_hash"], first["state_hash"])
        self.assertEqual(state("run?n=100")["state_hash"], evolved["state_hash"])

        visitor_a, visitor_b = "a" * 32, "b" * 32
        self.assertEqual(state("state", visitor_a)["tick"], 0)
        self.assertEqual(state("state", visitor_b)["state_hash"], first["state_hash"])
        seed_a = (1 << 64) - 1
        state(f"reset?seed={seed_a}", visitor_a)
        state("reset?seed=23", visitor_b)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a, b = pool.map(lambda session: state("step", session), [visitor_a, visitor_b])
        self.assertEqual((a["seed"], a["tick"]), (seed_a, 1))
        self.assertEqual((b["seed"], b["tick"]), (23, 1))
        state("reset?seed=7", visitor_b)
        self.assertEqual(state("state", visitor_a)["state_hash"], a["state_hash"])

        resumed = "c" * 32
        self.assertEqual(state("state", resumed, f"{seed_a}:1")["state_hash"], a["state_hash"])
        self.assertEqual(state("step", resumed, f"{seed_a}:1")["tick"], 2)
        self.assertEqual(state("state", visitor_a)["tick"], 1)
        self.assertEqual(state("state")["state_hash"], evolved["state_hash"])

        for session, checkpoint in [("bad session", None), (resumed, "23:-1")]:
            with self.assertRaises(HTTPError) as response:
                state("state", session, checkpoint)
            self.assertEqual(response.exception.code, 400)
