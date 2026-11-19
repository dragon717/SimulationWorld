# 实景性能验收

在 Apple M3 Pro（14 核 GPU）、120 Hz 内置屏幕、Chrome for Testing 158.0.8127.18 的可见窗口测试，WebGL 渲染器为 ANGLE Metal。页面为 1280 × 800 CSS 像素，设备像素比 1，生态监控展开。每个场景使用独立浏览器配置和本地 Go 服务，从同一种子 20260902 开始。可交互后预热 0.9 秒，再连续记录约 30 秒。全景交替执行相机拖动和点地面，近景跟随孟加拉虎并拖动环看。

| 测量项 | 1× 全景 | 5× 全景 | 20× 虎近景 |
| --- | ---: | ---: | ---: |
| 动画步数范围 | 2–33 | 6–157 | 20–614 |
| 实际帧间隔样本数 | 3618 | 3615 | 3611 |
| 平均 FPS | 120 | 120 | 120 |
| 显示回调间隔 P99 / 最大，毫秒 | 9.3 / 9.4 | 9.3 / 10.3 | 10.3 / 10.4 |
| 渲染回调 CPU P99，毫秒 | 1.1 | 0.9 | 0.8 |
| GPU 计时区间 P99，毫秒 | 5.72 | 5.01 | 7.48 |
| GPU 耗时小于 2 毫秒的比例 | 83.2% | 84.7% | 59.2% |
| 指针事件到处理完成 P99 / 最大，毫秒 | 0.6 / 0.6 | 0.8 / 1 | 0.8 / 0.8 |
| 指针事件到下一帧提交 P99，毫秒 | 8 | 8.1 | 9.4 |
| 按下单步到界面步数更新 P99，毫秒 | 19.9 | 21.2 | 21 |
| 冷导航到首次真实三维帧提交，毫秒 | 175.4 | 615.1 | 585.2 |
| 首次观察到首帧 GPU 围栏完成，毫秒 | 583.3 | 687.3 | 654.9 |

**验收结论**　120 Hz 的显示周期约 8.33 毫秒。CPU 渲染回调 P99 在 2 毫秒以内。GPU 的 99% 帧耗时目标、端到端操作响应低于 5 毫秒，以及完整冷加载低于 10 毫秒，本次未通过。平均 FPS 和最长帧间隔应一起判断。

CPU 数值覆盖应用的动画更新和渲染提交；GPU 数值来自有效的 WebGL GPU 时间查询。主线程在回调外处理快照、浏览器合成及显示扫描各有开销。输入计时从真实指针事件时间戳起算，「下一帧提交」为浏览器端指标，实际屏幕亮起时间需要外部仪器测量。每组另测 24 次单步操作。冷加载从新页面导航起算，终点是有模型和首份生态状态的真实画面；首帧围栏在后续显示回调检查。

## 复测

启动独立的测试服务并选择相同的种子，避免推进正在使用的世界。本次测试使用 Playwright 1.64.1。它仅用于测量，运行游戏无需安装。以下示例在项目根目录执行，测试服务独占端口 5196，每组开始前重置测试世界。

```sh
# 首个终端
python3 -c 'from backend import prepare; prepare()'
.runtime/ecosim -addr 127.0.0.1:5196 -cfg upstream/SimulationWorld/cfg -client .runtime/site

# 第二个终端，在专用目录安装浏览器测试依赖
bench_dir="$(mktemp -d)"
npm install --prefix "$bench_dir" playwright@1.64.1
"$bench_dir/node_modules/.bin/playwright" install chromium
export NODE_PATH="$bench_dir/node_modules"
curl -fsS -X POST 'http://127.0.0.1:5196/api/reset?seed=20260902' -o /dev/null
BENCH_URL=http://127.0.0.1:5196 HEADED=1 SPEED=5 BENCH_SECONDS=30 node tools/benchmark.cjs
curl -fsS -X POST 'http://127.0.0.1:5196/api/reset?seed=20260902' -o /dev/null
BENCH_URL=http://127.0.0.1:5196 HEADED=1 SPEED=20 FOCUS=tiger BENCH_SECONDS=30 node tools/benchmark.cjs
```

可通过 `CHROME_BIN` 指定已安装的 Chromium，`BENCH_OUT` 保存包含样本数、中位数、P99 和最大值的 JSON。无头浏览器可能按 60 Hz 调度。
