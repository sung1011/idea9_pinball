import { Graphics, Sprite, Texture } from 'pixi.js';
import { BALL_RADIUS, SPEAR_TIP_CD, SPEAR_TIP_DIST, SPEAR_TIP_RADIUS } from './constants';
import { spearTipPos } from './collisionDamage';
import { HERO_IDS } from '../heroes/heroIds';
import { createMatchRoster } from './matchSession';
import { createBallView } from '../render/ballView';
import {
  getHookRiderArt,
  HOOK_RIDER,
  HOOK_RIDER_BODY_BYTES,
  HOOK_RIDER_BODY_FILE,
  HOOK_RIDER_BODY_RED_BYTES,
  HOOK_RIDER_BODY_RED_FILE,
  HOOK_RIDER_BYTES,
  HOOK_RIDER_SPEAR_BYTES,
  HOOK_RIDER_SPEAR_FILE,
  HOOK_RIDER_TEAM_BYTES,
  hookRiderArtUrl,
  hookRiderBodyTexture,
  hookRiderHeadFrontOk,
  hookRiderRotation,
  setHookRiderArt,
} from '../render/hookRiderArt';
import { getHookRiderRunArt, setHookRiderRunArt } from '../render/hookRiderRunArt';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

function angNear(a: number, b: number, eps = 1e-6): boolean {
  const d = Math.atan2(Math.sin(a - b), Math.cos(a - b));
  return Math.abs(d) < eps;
}

function spritesOf(view: ReturnType<typeof createBallView>): Sprite[] {
  return view.root.children.filter((child): child is Sprite => child instanceof Sprite);
}

function stubTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 8, 8);
  }
  return Texture.from(canvas);
}

/** 全局 A 骑装：七英雄按真实队伍选身躯贴图；只改显示，不改碰撞/枪尖/CD；缺图回退圆盾。 */
export function verifyHookRider(): void {
  const prev = getHookRiderArt();
  const prevRun = getHookRiderRunArt();
  setHookRiderRunArt(null);
  try {
    assert(BALL_RADIUS === 1, '钩刺骑装：碰撞半径仍应为 1');
    assert(SPEAR_TIP_DIST === 2.24, '钩刺骑装：枪尖距仍应为 2.24');
    assert(SPEAR_TIP_RADIUS === 0.2, '钩刺骑装：枪尖检测半径仍应为 0.2');
    assert(SPEAR_TIP_CD === 1.5, '钩刺骑装：普攻 CD 仍应为 1.5');
    assert(hookRiderHeadFrontOk(), '钩刺骑装：马头前沿+枪头长度应对齐 2.24');
    assert(HOOK_RIDER.headFrontWorld === 1.82, '钩刺骑装：马头前沿应为 1.82');
    assert(HOOK_RIDER.spearWorldH === 0.42, '钩刺骑装：枪头世界高度应为 0.42');
    assert(HOOK_RIDER.bodyWorldW < BALL_RADIUS * 2, '钩刺骑装：人马宽度应小于碰撞直径');
    assert(HOOK_RIDER.bodyWorldW * 54 < 133, '钩刺骑装：1920 下宽度不得再是 133');
    assert(HOOK_RIDER.bodyWorldH * 54 < 401, '钩刺骑装：1920 下高度不得再是 401');
    assert(HOOK_RIDER.bodyWorldH * 54 < 220, '钩刺骑装：显示人马不得远大于原主体');
    assert(HOOK_RIDER.bodyTexW === 89 && HOOK_RIDER.bodyTexH === 256, '钩刺骑装：身躯贴图应为 89×256');
    assert(HOOK_RIDER.spearTexW === 29 && HOOK_RIDER.spearTexH === 96, '钩刺骑装：枪头贴图应为 29×96');
    assert(HOOK_RIDER_BODY_FILE === 'hook-body.webp' && HOOK_RIDER_SPEAR_FILE === 'hook-spear.webp', '钩刺骑装：文件名');
    assert(HOOK_RIDER_BODY_RED_FILE === 'hook-body-red.webp', '钩刺骑装：红方身躯文件名');
    assert(HOOK_RIDER_BODY_BYTES === 24810 && HOOK_RIDER_SPEAR_BYTES === 3828, '钩刺骑装：压缩图字节应与预览同一套');
    assert(HOOK_RIDER_BODY_RED_BYTES === 25256, '钩刺骑装：红方局部换色图应为 25256 字节');
    assert(HOOK_RIDER_BYTES === 28638, '钩刺骑装：蓝方两张合计 28638 字节');
    assert(HOOK_RIDER_TEAM_BYTES === 53894, '钩刺骑装：红蓝身躯+枪头合计 53894 字节');
    assert(hookRiderArtUrl(HOOK_RIDER_BODY_FILE).includes('/rider/hook-body.webp'), '钩刺骑装：身躯 URL 应走 public/rider');
    assert(hookRiderArtUrl(HOOK_RIDER_BODY_RED_FILE).includes('/rider/hook-body-red.webp'), '钩刺骑装：红方 URL 应走 public/rider');
    assert(hookRiderArtUrl(HOOK_RIDER_SPEAR_FILE).includes('/rider/hook-spear.webp'), '钩刺骑装：枪头 URL 应走 public/rider');
    assert(angNear(hookRiderRotation(0, -1), 0), '钩刺骑装：朝上旋转应为 0');
    assert(angNear(hookRiderRotation(1, 0), Math.PI / 2), '钩刺骑装：朝右旋转应为 π/2');
    assert(angNear(hookRiderRotation(0, 1), Math.PI), '钩刺骑装：朝下旋转应为 π');
    assert(angNear(hookRiderRotation(-1, 0), -Math.PI / 2), '钩刺骑装：朝左旋转应与 -π/2 同向');

    setHookRiderArt(null);
    const roster = createMatchRoster({ player: 'hook', ally: 'chain', blue1: 'ring', blue2: 'nail' });
    const hookBall = roster.find((ball) => ball.hero === 'hook');
    const chainBall = roster.find((ball) => ball.hero === 'chain');
    if (!hookBall || !chainBall) {
      throw new Error('钩刺骑装：应能拿到钩刺与链生');
    }
    const fallback = createBallView(hookBall);
    assert(spritesOf(fallback).length === 0, '钩刺骑装：缺图时应回退、不建 Sprite');
    assert(fallback.root.children[0] instanceof Graphics, '钩刺骑装：缺图时 children[0] 仍为标记');
    assert(fallback.root.children[1] instanceof Graphics, '钩刺骑装：缺图时 children[1] 仍为残影');
    const fallbackSpear = fallback.root.children[fallback.root.children.length - 1];
    assert(fallbackSpear instanceof Graphics && fallbackSpear.visible, '钩刺骑装：缺图时应画程序金矛');

    const blueBody = stubTexture();
    const redBody = stubTexture();
    const spearTex = stubTexture();
    setHookRiderArt({ body: blueBody, bodyRed: redBody, spear: spearTex });
    assert(hookRiderBodyTexture('red') === redBody, '骑装：红方应选红甲贴图');
    assert(hookRiderBodyTexture('blue') === blueBody, '骑装：蓝方应选原图');
    const hookView = createBallView(hookBall);
    const otherView = createBallView(chainBall);
    assert(hookView.root.children[0] instanceof Graphics, '钩刺骑装：有图时 children[0] 仍为标记');
    assert(hookView.root.children[1] instanceof Graphics, '钩刺骑装：有图时 children[1] 仍为残影');
    const hookSprites = spritesOf(hookView);
    const otherSprites = spritesOf(otherView);
    assert(hookSprites.length === 2, '钩刺骑装：钩刺应有人马+枪头两张 Sprite');
    assert(otherSprites.length === 2, '骑装：其他英雄也应有人马+枪头两张 Sprite');
    chainBall.facingX = -1;
    chainBall.facingY = 0;
    chainBall.hasAim = false;
    otherView.sync(chainBall);
    assert(otherSprites.every((spr) => spr.visible), '骑装：链生存活应显示同一套人马');
    const otherSpear = otherView.root.children[otherView.root.children.length - 1];
    assert(otherSpear instanceof Graphics && !otherSpear.visible, '骑装：有图时各英雄都隐藏程序金矛');
    assert(HERO_IDS.length === 7, '骑装：英雄池仍为 7');
    const red1 = roster.find((ball) => ball.team === 'red' && ball.teamSlot === 1);
    const blue1 = roster.find((ball) => ball.team === 'blue' && ball.teamSlot === 1);
    if (!red1 || !blue1) {
      throw new Error('骑装：应能拿到红1与蓝1');
    }
    assert(red1.color === 0xe24a4a, '骑装：红1队色应保持当前');
    assert(blue1.color === 0x3d7cf0, '骑装：蓝1队色应保持当前');
    for (const hero of HERO_IDS) {
      const sample = {
        ...hookBall,
        hero,
        id: 8100 + HERO_IDS.indexOf(hero),
        facingX: 1,
        facingY: 0,
        hasAim: false,
      };
      const view = createBallView(sample);
      view.sync(sample);
      const sprs = spritesOf(view);
      assert(sprs.length === 2 && sprs.every((spr) => spr.visible), `骑装：${hero} 应显示同一套人马`);
      assert(near(sprs[1].position.x, SPEAR_TIP_DIST), `骑装：${hero} 朝右枪尖 x=2.24`);
      const procG = view.root.children[view.root.children.length - 1];
      assert(procG instanceof Graphics && !procG.visible, `骑装：${hero} 有图时不画第二根程序枪`);
      for (const team of ['red', 'blue'] as const) {
        const teamSample = { ...sample, team, id: sample.id + (team === 'red' ? 70 : 80) };
        const teamView = createBallView(teamSample);
        teamView.sync(teamSample);
        assert(
          spritesOf(teamView)[0].texture === (team === 'red' ? redBody : blueBody),
          `骑装：${hero}/${team} 应按真实队伍选图`,
        );
      }
    }
    const dupA = { ...red1, hero: 'mirror' as const, id: 9001, facingX: 1, facingY: 0, hasAim: false };
    const dupB = { ...blue1, hero: 'mirror' as const, id: 9002, facingX: -1, facingY: 0, hasAim: false };
    const dupViewA = createBallView(dupA);
    const dupViewB = createBallView(dupB);
    dupViewA.sync(dupA);
    dupViewB.sync(dupB);
    const dupSpritesB = spritesOf(dupViewB);
    assert(spritesOf(dupViewA).every((spr) => spr.visible), '骑装：同局重复英雄红方应显示人马');
    assert(dupSpritesB.every((spr) => spr.visible), '骑装：同局重复英雄蓝方应显示人马');
    assert(spritesOf(dupViewA)[0].texture === redBody, '骑装：同局重复红方应选红甲贴图');
    assert(dupSpritesB[0].texture === blueBody, '骑装：同局重复蓝方应选原图');
    assert(dupA.color === 0xe24a4a && dupB.color === 0x3d7cf0, '骑装：红蓝队色应保持当前不同');
    assert(near(dupSpritesB[1].position.x, -SPEAR_TIP_DIST), '骑装：蓝方朝左枪尖 x=-2.24');

    hookBall.facingX = 1;
    hookBall.facingY = 0;
    hookBall.hasAim = false;
    hookView.sync(hookBall);
    const [horse, spearSpr] = spritesOf(hookView);
    assert(horse.visible && spearSpr.visible, '钩刺骑装：钩刺存活应显示人马和枪头');
    assert(horse.texture === (hookBall.team === 'red' ? redBody : blueBody), '骑装：身躯贴图应按真实队伍');
    assert(spearSpr.texture === spearTex, '骑装：红蓝共用同一枪头贴图');
    assert(horse.tint === 0xffffff && spearSpr.tint === 0xffffff, '骑装：不整图 tint');
    const origTeam = hookBall.team;
    hookBall.team = origTeam === 'red' ? 'blue' : 'red';
    hookView.sync(hookBall);
    assert(horse.texture === (hookBall.team === 'red' ? redBody : blueBody), '骑装：换队后应换身躯贴图');
    hookBall.team = origTeam;
    hookView.sync(hookBall);
    assert(horse.texture === (hookBall.team === 'red' ? redBody : blueBody), '骑装：换回队伍后贴图应还原');
    assert(near(horse.width, HOOK_RIDER.bodyWorldW, 1e-4), '钩刺骑装：人马世界宽');
    assert(near(horse.height, HOOK_RIDER.bodyWorldH, 1e-4), '钩刺骑装：人马世界高');
    assert(near(spearSpr.position.x, SPEAR_TIP_DIST, 1e-6), '钩刺骑装：朝右时枪头锚点 x=2.24');
    assert(near(spearSpr.position.y, 0, 1e-6), '钩刺骑装：朝右时枪头锚点 y=0');
    const tip = spearTipPos(hookBall);
    assert(near(hookBall.x + spearSpr.position.x, tip.x), '钩刺骑装：图片枪尖应等于真实命中点 x');
    assert(near(hookBall.y + spearSpr.position.y, tip.y), '钩刺骑装：图片枪尖应等于真实命中点 y');
    const proc = hookView.root.children[hookView.root.children.length - 1];
    assert(proc instanceof Graphics && !proc.visible, '钩刺骑装：有图时隐藏程序金矛，避免第二根枪');

    const dirs: Array<readonly [number, number]> = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const [fx, fy] of dirs) {
      hookBall.facingX = fx;
      hookBall.facingY = fy;
      hookView.sync(hookBall);
      const [, spr] = spritesOf(hookView);
      assert(near(spr.position.x, fx * SPEAR_TIP_DIST), `钩刺骑装：(${fx},${fy}) 枪尖 x`);
      assert(near(spr.position.y, fy * SPEAR_TIP_DIST), `钩刺骑装：(${fx},${fy}) 枪尖 y`);
      assert(angNear(spr.rotation, hookRiderRotation(fx, fy)), `钩刺骑装：(${fx},${fy}) 旋转`);
      assert(angNear(horse.rotation, spr.rotation), `钩刺骑装：(${fx},${fy}) 人马与枪头同向`);
    }

    hookBall.hero = 'ring';
    hookView.sync(hookBall);
    assert(spritesOf(hookView).every((spr) => spr.visible), '骑装：换英雄后仍显示同一骑装');
    assert(proc instanceof Graphics && !proc.visible, '骑装：换英雄后仍隐藏程序金矛');

    hookBall.hero = 'well';
    hookBall.inPlay = false;
    hookView.sync(hookBall);
    assert(!hookView.root.visible, '钩刺骑装：死亡仍隐藏整颗');

    hookBall.inPlay = true;
    hookView.sync(hookBall, { charging: true });
    assert(hookView.root.visible, '钩刺骑装：复活后应可见');
    assert(spritesOf(hookView).every((spr) => spr.visible), '骑装：复活后非钩刺仍显示人马');
    assert(hookView.root.children[1] instanceof Graphics, '钩刺骑装：冲锋残影层不改');
    const chargeFx = hookView.root.children[1];
    assert(chargeFx instanceof Graphics && chargeFx !== hookView.root.children[0], '骑装：残影仍是独立 Graphics，不改成钩刺特效');
  } finally {
    setHookRiderArt(prev);
    setHookRiderRunArt(prevRun);
  }
}
