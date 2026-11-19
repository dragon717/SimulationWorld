"""Exercise the actual upstream HTTP service without touching the player's world."""
from collections import Counter
import json
import socket
import subprocess
import time
import unittest
from urllib.error import URLError
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

        def state(path):
            method = "GET" if path == "state" else "POST"
            with urlopen(Request(url + "api/" + path, method=method), timeout=10) as response:
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
        for name in ("museum.css", "environment.js", "river.js", "lighting.js", "textures/hall-prefiltered.hdr", "textures/floodplain-ground.webp", "ui/gallery.webp", "ui/smoke-glass.webp"):
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
