# Idea pinball · 工程落地方案 v0
更新：2026-11-04（M3 输入）

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
3. M2 碰撞：阈值掉血；朝向乘区；弹开；主动撞窗0.25s ✅
4. M3 输入：Action；PC鼠键 + 手机虚拟键；瞄准同键二次释放 ✅
5. M4 一局：中点分；击破/助攻；8s回场+2s无敌；100分或4分钟
6. M5 英雄切片：钩刺四技能 → 磁环困圈 / 钉壳定锚
7. M6 后：Go 同步；其余英雄

## 目录
- `src/core`：逻辑常量（`constants.ts`：地图 20×12、球半径 0.5、中点/矮柱、速度上限 8、摩擦）
- `src/core/ballBody.ts`：圆体状态
- `src/core/physicsStep.ts`：每帧积分 / 摩擦 / 盖帽
- `src/core/wallBounce.ts`：圆角矩形墙 + 矮柱胶囊反弹；球-球弹性分离（伤害在 collisionDamage）
- `src/render`：逻辑→屏幕变换（`worldTransform.ts`）、场地（`arenaView.ts`）、球与朝向箭头（`ballView.ts`）
- `src/debug/debugVelocity.ts`：点击 / 方向键 / 空格给初速度并开 0.25s 主动撞窗；C/Z/X/V/R 验收对撞
- `src/core/collisionDamage.ts`：相对速度阈值 / 朝向乘区 / 掉血弹开
- `src/ui/hpHud.ts`：血量条、瞄准/微调提示、最近碰撞日志
- `src/input`：ActionBus 每帧采样 Aim / Skill1–4 / FineTune / CancelAim；PC 鼠键 + 横屏虚拟键
- `src/core/skillStub.ts`：四槽相同释放 stub（冲量 + 朝向刷新 + 主动撞窗）
- 后续：`src/heroes`；回场 / 中点分属 M4–M5

## M1 物理约定
- 积分：`x += v * dt`，`dt` 上限 1/20
- 摩擦：`v *= exp(-FRICTION * dt)`，`FRICTION = ln(8/0.4)/2`，满速约 2s 滑到爬行 0.4；低于 0.05 归零
- 墙：圆心约束在内缩圆角矩形（角半径 1.0）；完全弹性反弹
- 矮柱：按 2×1 胶囊当墙（半高 0.5 + 球半径）
- 球-球：等质量弹性分离，避免穿模；伤害 / 朝向乘区 / 弹开属 M2
- 速度盖帽 8；调试点击或热键直接给满速 8

## M2 碰撞约定
- 血量 100；相对速度 ≥ 4 才掉血；任一方处于主动撞窗则改用阈值 2.5；否则轻蹭（只做弹性分离/改方向）
- 伤害 = 6 × (相对速度 − 阈值) × 朝向系数，先乘再 cap 28
- 朝向相对受击方：前 ±45° ×1.0；侧 ±45°～±135° ×0.7；后 ±135°～180° ×1.35；速度档 0 用上一帧朝向
- 仅掉血时沿法线轻弹：2.0 × 朝向系数 × min(1,(相对速度−阈值)/8)，感上限 2.5
- 主动撞窗：调试冲刺/给速后 0.25s（M2 不接技能）；M3 技能释放 stub 复用同一窗口
- 本里程碑不做：击破回场、中点分、Action 层、英雄

## M3 输入约定
- Action：`Aim` / `Skill1–4` / `FineTune`（窗内）/ `CancelAim`；无移动键，鼠标/摇杆只改 Aim
- 技能：按下进入瞄准（扇形+箭头预览，**无最长时限**），再按同键或左键释放；右键 / Esc / 点空白(触屏) 取消，不冲量
- 释放 stub（四槽相同）：朝向=瞄准方向；速度 += 瞄准单位 × 3；再 clamp 上限 8；开 0.25s 主动撞窗；短 CD 0.4s 防连点
- FineTune：墙/柱/球任意碰撞（含轻蹭）后开 0.3s 窗；窗内每帧把**速度方向**向 Aim 轻扭约 90°/s；HUD 亮微调提示
- PC：Aim=鼠标相对红球；Skill1–4=`1`/`2`/`3`/`4`（兼 `QWE`；`R` 仍为重置）；Cancel=`右键`/`Esc`
- 手机横屏：左虚拟摇杆=Aim/FineTune；右四键=Skill1–4；点空白=Cancel；禁默认滚动/缩放
- 玩家控红球；蓝球保持 M2 调试靶；保留 C/Z/X/V/R

## 验收
- M0：`npm i && npm run dev` 可见俯视空场地；`npm run build` 通过
- M1：两颗占位球可惯性滑动；摩擦约 2s 满速→爬行；撞圆角墙/矮柱反弹；速度≤8；点击或方向键/空格给初速度并画出朝向箭头
- M2：前/侧/后伤害与弹开可辨（调试键 C/Z/X/V）；HUD 显示双方 HP；轻蹭不掉血；调试给速后 0.25s 主动撞窗
- M3：横屏虚拟键可放技能；PC 可瞄可放可取消；撞后 0.3s 内 Aim 能拧轨迹

## M3 自测
- `npx tsc --noEmit` 与 `npx vite build` 通过；启动时 `verifyM2` + `verifyM3`
- PC：按 `1` 进瞄（无超时）→ 再按 `1` 或左键释放 → 红球沿瞄向加速且开主动撞窗；右键 / Esc 取消不冲量
- 撞墙或轻蹭后 0.3s HUD 亮「微调」，鼠标能拧速度方向（约 90°/s）
- 触屏：左摇杆改 Aim，右四键同「按下进瞄 / 再按释放」；点空白取消
- M4：单机完整一局
- M5：钩刺急停→勾→捅→推可打出
