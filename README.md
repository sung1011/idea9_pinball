# idea9_pinball

惯性滑动弹球 3v3。

线上预览：https://sung1011.github.io/idea9_pinball/

仓库 **Settings → Pages** 的 Source 需选 **GitHub Actions**（首次可能要手动点一次）。推送到 `main` 后由 Actions 自动构建并发布。

## 本地运行

```bash
npm i
npm run dev
```

浏览器打开终端提示的本地地址（开发服务在 `/idea9_pinball/` 路径下），可见俯视场地（圆角矩形、中点圈、左右矮柱、两颗占位球）。

调试：点击场地给最近球初速度 8；方向键 / WASD / 空格给当前目标球。球带惯性、摩擦（满速约 2 秒滑到爬行）、撞墙/矮柱反弹，速度上限 8。

## 构建

```bash
npm run build
```

## 文档

- [设计锁点](docs/design-lock-v0.1.md)
- [工程落地方案](docs/impl-plan-v0.md)
- [场地示意](docs/pinball-arena-demo.jpg)
