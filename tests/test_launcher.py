from pathlib import Path
import runpy
import signal
import unittest
from unittest.mock import patch

from backend import BINARY, SERVER_ARGS


class LauncherTest(unittest.TestCase):
    def test_restart_only_terminates_the_matching_preview_without_a_prompt(self):
        stop = runpy.run_path(str(Path(__file__).resolve().parents[1] / "启动游戏.command"))["stop_listener"]
        commands = [
            "python3 -m http.server --bind 127.0.0.1 5184",
            " ".join([str(BINARY), *SERVER_ARGS]),
            "another-server --port 5184",
        ]
        for command in commands:
            for same_project in (False, True):
                with self.subTest(command=command, same_project=same_project):
                    listening = {73}

                    def output(*args):
                        if args[0] == "lsof":
                            return "73" if same_project else ""
                        return command

                    with patch.dict(stop.__globals__, output=output, listeners=listening.copy), \
                            patch("sys.stdin.isatty", return_value=False), \
                            patch("os.kill", side_effect=lambda pid, sig: listening.remove(pid)) as kill:
                        if same_project and command in commands[:2]:
                            stop(73)
                            kill.assert_called_once_with(73, signal.SIGTERM)
                        else:
                            with self.assertRaises(SystemExit):
                                stop(73)
                            kill.assert_not_called()
