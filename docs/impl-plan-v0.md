# Idea pinball · 工程落地方案 v0
更新：2026-11-04（GitHub Pages 预览）

## 栈
- 客户端：TypeScript + PixiJS + Vite
- 物理 v0：自写圆球惯性；后可换 Rapier2D wasm
- 输入：Action（Aim / Skill1–4 / FineTune / CancelAim）
- 技能瞄准：**按下进入瞄准，再按同键释放**（左键可释放；Cancel 取消）
- 联网后置：Go WebSocket 房间；v0 单机
- 预览：GitHub Pages 项目站 `https://sung1011.github.io/idea9_pinball/`；`vite.config.ts` 的 `base` 为 `/idea9_pinball/`；推送 `main` 由 `.github/workflows/deploy-pages.yml` 发布；Pages Source 选 GitHub Actions

## 里程碑
1. M0 脚手架：Vite+TS+Pixi；20×12 逻辑坐标；调试网格 ✅
2. M1 物理：半径0.5；摩擦；墙反弹；速度上限8 ✅
3. M2 碰撞：阈值掉血；朝向乘区；弹开；主动撞窗0.25s
4. M3 输入：Action；PC鼠键 + 手机虚拟键；瞄准同键二次释放
5. M4 一局：中点分；击破/助攻；8s回场+2s无敌；100分或4分钟
6. M5 英雄切片：钩刺四技能 → 磁环困圈 / 钉壳定锚
7. M6 后：Go 同步；其余英雄

## 目录
- `src/core`：逻辑常量（`constants.ts`：地图 20×12、球半径 0.5、中点/矮柱、速度上限 8、摩擦）
- `src/core/ballBody.ts`：圆体状态
- `src/core/physicsStep.ts`：每帧积分 / 摩擦 / 盖帽
- `src/core/wallBounce.ts`：圆角矩形墙 + 矮柱胶囊反弹；球-球弹性分离（无伤害）
- `src/render`：逻辑→屏幕变换（`worldTransform.ts`）、场地（`arenaView.ts`）、球与朝向箭头（`ballView.ts`）
- `src/debug/debugVelocity.ts`：点击 / 方向键 / 空格给初速度
- 后续：`src/input` · `src/heroes` · `src/ui`

## M1 物理约定
- 积分：`x += v * dt`，`dt` 上限 1/20
- 摩擦：`v *= exp(-FRICTION * dt)`，`FRICTION = ln(8/0.4)/2`，满速约 2s 滑到爬行 0.4；低于 0.05 归零
- 墙：圆心约束在内缩圆角矩形（角半径 1.0）；完全弹性反弹
- 矮柱：按 2×1 胶囊当墙（半高 0.5 + 球半径）
- 球-球：等质量弹性分离，避免穿模；伤害 / 朝向乘区 / 弹开属 M2
- 速度盖帽 8；调试点击或热键直接给满速 8

## 验收
- M0：`npm i && npm run dev` 可见俯视空场地；`npm run build` 通过
- M1：两颗占位球可惯性滑动；摩擦约 2s 满速→爬行；撞圆角墙/矮柱反弹；速度≤8；点击或方向键/空格给初速度并画出朝向箭头
- M2：前/侧/后伤害与弹开可辨
- M3：横屏虚拟键可放技能
- M4：单机完整一局
- M5：钩刺急停→勾→捅→推可打出
