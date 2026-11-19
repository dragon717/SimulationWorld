#!/usr/bin/env python3
import fcntl
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parent
PORT = 5184
URL = f"http://127.0.0.1:{PORT}/"
SERVER_ARGS = ["-m", "http.server", "--bind", "127.0.0.1", str(PORT)]


def output(*args):
    result = subprocess.run(args, stdout=subprocess.PIPE, encoding="utf-8")
    return result.stdout.strip()


def listeners():
    return {int(pid) for pid in output("lsof", "-nP", "-t", f"-iTCP:{PORT}", "-sTCP:LISTEN").split()}


def stop_listener(pid):
    if pid not in listeners():
        return
    command = output("ps", "-ww", "-p", str(pid), "-o", "command=")
    project_cwd = output("lsof", "-nP", "-a", "-p", str(pid), "-d", "cwd", "-t", str(ROOT))
    own_preview = project_cwd == str(pid) and command.endswith(" " + " ".join(SERVER_ARGS))
    if not own_preview:
        name = output("ps", "-p", str(pid), "-o", "comm=")
        message = f"端口 {PORT} 由其他程序 {name}（PID {pid}）占用。"
        if not sys.stdin.isatty() or input(message + " 结束该程序并启动场景？[y/N] ").strip().lower() != "y":
            raise SystemExit(message + " 已取消启动。")
    if pid in listeners():
        print(f"正在释放端口 {PORT}…", flush=True)
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        for _ in range(30):
            if pid not in listeners():
                return
            time.sleep(.1)
        raise SystemExit(f"程序 {pid} 仍在监听端口 {PORT}，请关闭后重试。")


def start():
    if not (ROOT / "node_modules/three/build/three.module.js").is_file():
        subprocess.run(["npm", "ci"], check=True)
    for pid in listeners():
        stop_listener(pid)
    process = subprocess.Popen(
        [sys.executable, *SERVER_ARGS], stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True,
    )
    for _ in range(50):
        if process.poll() is not None:
            raise SystemExit(f"预览启动失败，请检查端口 {PORT}。")
        if process.pid in listeners():
            return
        time.sleep(.1)
    process.terminate()
    raise SystemExit("预览未在预期时间内启动。")


if __name__ == "__main__":
    os.chdir(ROOT)
    # Serialize double-clicks without leaving a PID or lock file behind.
    lock = os.open(".", os.O_RDONLY)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        start()
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"启动失败：{error}")
    finally:
        os.close(lock)
    print(f"拉普蒂河漫滩已启动：{URL}", flush=True)
    if subprocess.call(["open", URL]) != 0:
        print("请在浏览器中打开上面的地址。", file=sys.stderr)
