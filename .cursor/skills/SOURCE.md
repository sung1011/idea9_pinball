# 项目级开发 skill 来源记录

本目录只放开发期 Agent skill，**不是**游戏运行时依赖，不参与 Vite 打包。

- 上游：https://github.com/gamedev-skills/awesome-gamedev-agent-skills
- 固定 commit：`4cce500ce1a779b12fdd824be581c7d2ab4e7ba2`（2026-11-09）
- 许可：Apache License 2.0（见同目录 `LICENSE`、`NOTICE`）
- 版权：Copyright 2026 Abhishek Barali and the awesome-gamedev-agent-skills contributors
- 选取：仅 `skills/disciplines/create-game-assets/` 与 `skills/web-engines/pixijs-rendering/`
- 放置：`.cursor/skills/create-game-assets/`、`.cursor/skills/pixijs-rendering/`（Cursor 项目 skill 可识别的一层目录；无 `.cursor` 既有 skill，未覆盖用户/插件 skill）
- 未引入：其他技能、router、全局配置、额外引擎、安装器；未拷贝 `agents/openai.yaml`（Codex 展示元数据，SKILL.md 无相对引用）
- 可选脚本：`create-game-assets/scripts/*.py` 仅审查后拷贝，不在引入时执行、不安装 Pillow
- Pixi 基线：上游 skill 示例按 PixiJS **v8.22** 书写，仅作开发参考。本仓库保持现有锁版：`package.json` `pixi.js ^8.13.2`，`package-lock.json` 解析为 `8.22.0`。引入时不升级、不改 lock
- 未改运行时代码、美术、玩法或 `versions.json`
