# Idea pinball · 工程落地方案 v0
更新：2026-11-04（仍不开库，仅文档）

## 栈
- 客户端：TypeScript + PixiJS + Vite
- 物理 v0：自写圆球惯性；后可换 Rapier2D wasm
- 输入：Action（Aim / Skill1–4 / FineTune / CancelAim）
- 技能瞄准：**按下进入瞄准，再按同键释放**（左键可释放；Cancel 取消）
- 联网后置：Go WebSocket 房间；v0 单机

## 里程碑
1. M0 脚手架：Vite+TS+Pixi；20×12 逻辑坐标；调试网格
2. M1 物理：半径0.5；摩擦；墙反弹；速度上限8
3. M2 碰撞：阈值掉血；朝向乘区；弹开；主动撞窗0.25s
4. M3 输入：Action；PC鼠键 + 手机虚拟键；瞄准同键二次释放
5. M4 一局：中点分；击破/助攻；8s回场+2s无敌；100分或4分钟
6. M5 英雄切片：钩刺四技能 → 磁环困圈 / 钉壳定锚
7. M6 后：Go 同步；其余英雄

## 拟目录
`src/core` · `src/input` · `src/render` · `src/heroes` · `src/ui`

## 验收
- M2：前/侧/后伤害与弹开可辨
- M3：横屏虚拟键可放技能
- M4：单机完整一局
- M5：钩刺急停→勾→捅→推可打出

## 开库
待你确认本方案后再建仓库（建议名 idea-pinball）；云端写码走 plan-then-commit。
