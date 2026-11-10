export type ChangeLogItem = {
  title: string;
};

export type AppVersionEntry = {
  id: string;
  version: string;
  date: string;
  summary: string;
};

export type VersionGroup = {
  version: string;
  date: string;
  summaries: string[];
  ids: string[];
};

export type VersionState = {
  entries: AppVersionEntry[];
  grouped: VersionGroup[];
  history: VersionGroup[];
  installed: VersionGroup | null;
  pending: VersionGroup[];
  flash: string;
};

export type AppVersions = {
  getState: () => VersionState;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
  checkUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  dispose: () => void;
};

export const APP_VERSION = {
  version: __APP_VERSION__,
  sha: __GIT_SHA__,
};

export const CHANGE_LOG: readonly ChangeLogItem[] = [
  { title: '镜卫四技能接入已确认全幅插画（512 WebP）；第五键必杀仍空槽不挂图；按钮外框/CD/能量环不变，钩刺/磁环/链生/钉壳/闪弧/井绳已上线图不动' },
  { title: '井绳四技能接入已确认全幅插画（512 WebP）；第五键必杀仍空槽不挂图；按钮外框/CD/能量环不变，钩刺/磁环/链生/钉壳/闪弧已上线图不动' },
  { title: '闪弧四技能接入已确认全幅插画（512 WebP）；第五键必杀仍空槽不挂图；按钮外框/CD/能量环不变，钩刺/磁环/链生/钉壳已上线图不动' },
  { title: '钉壳四技能接入已确认全幅插画（512 WebP）；第五键必杀仍空槽不挂图；按钮外框/CD/能量环不变，钩刺/磁环/链生五图不动' },
  { title: '链生五技能接入已确认全幅插画（512 WebP，含第五键均血图）；按钮外框/CD/必杀能量环不变，钩刺与磁环五图不动' },
  { title: '磁环五技能接入已确认全幅插画（512 WebP，含第五键沉磁井图）；按钮外框/CD/必杀能量环不变，钩刺五图与其余英雄剪影不动' },
  { title: '钩刺五技能接入第二版全幅插画（512 WebP，含第五键无畏冲锋图）；按钮外框/CD/必杀能量环不变，其余英雄仍圆形剪影' },
  { title: '设置 GM 页只留「科技点 +1」；去掉旧调试按钮、开关与 Z/X/C/V/F/G/T/Y/H，R 与常规设置/科技/玩法不变' },
  { title: '钩刺蓄势科技改为弹出沿途接触携带友军冲锋；沿用 0.25s 主动撞窗，旧充分蓄力首次撞敌+8取消；旧点亮无损迁移' },
  { title: '科技界面其他英雄按英雄→普通四技能展示同款槽位，名称/图标/顺序读现有技能，一律 todo 不可购买；钩刺四强化与英雄解锁不变' },
  { title: 'A骑装七层四蹄步态：速度驱动错相，低速收步，轻身体起伏与骑手随动尾摆；侧滑后滑保持瞄准朝向；枪尖/碰撞/身份圈不随腿动；缺分层回退整图' },
  { title: '科技树首版：本机资源点永久点亮独立槽位；钩刺免费，其余英雄前三次付费解锁各30之后60；钩刺四技能条件强化；练习试用不解锁不发点；战外购买下场生效' },
  { title: '玩法选择从左上迁到设置常规页；八杀/占点选项、顺序、当前值与换玩法立刻重开不变；左上入口移除' },
  { title: '链生第五键均血：以自身为圆心半径4立刻按百分比算术平均调血，我方再回最大生命10%；降血不走普通伤害/护盾/反伤；其余英雄必杀仍todo' },
  { title: '磁环第五键沉磁井：前方选点最远6格，半径4，落地即吸3秒后爆炸；20+10N完整伤只打敌人；其余英雄必杀仍todo；八杀环境圈与药剂时序不变' },
  { title: '八杀取消随机环境伤害圈（地裂不生成也不伤害）；药剂正式开战第10秒首刷，之后仍每45秒；技能/状态圈与占点时序不变' },
  { title: '撞后 0.3s 青色提示圈去掉；微调强拧窗/触发/时长保留；本人身份圈与技能状态圈、碰撞数值不变' },
  { title: '红方 A 骑装盔甲与盾牌原像素局部换红；蓝方原图；白马/皮肤/长枪/羽冠/马具不染；常驻圈与碰撞数值不变' },
  { title: '常驻身份圈仅本人一层奶黄深棕；友方敌方与重复英雄去掉该类圈；技能/状态圈与红蓝队色、碰撞数值不变' },
  { title: '七英雄红蓝共用同一套 A 骑装（含重复出场）；队色描边保持当前红蓝，不新配色；碰撞/伤害/枪尖/技能/能量/残影不变' },
  { title: '钩刺红蓝共用 A 骑装透明人马（拆枪头对齐 2.24 命中点，约 72×206px）；其余英雄仍圆盾；碰撞/伤害/枪尖/技能/能量不变' },
  { title: '触屏左下常显半透明圆形瞄准摇杆；拖动改朝向、松手回中不放技能；纯鼠标桌面不常显，惯性与技能数值不变' },
  { title: '钩刺无畏冲锋后撤三步每步 0.2s→0.4s，距离仍 0.8 格；冲出初速/加速度/上限/转向/伤害/能量不变' },
  { title: '设置常规页增加「刷新游戏」，点击硬刷新当前页；不清存档、不重开本局' },
  { title: '独立窗等首次稳定横屏后按真正可见区锁定战场比例；网页仍横屏直进即锁，锁后只平移裁切' },
  { title: '枪尖普攻成功掉血后 CD 1s→1.5s（不是 2s）；伤害公式/门槛/进度条逻辑不变' },
  { title: '局内四技能键换上圆形剪影图标 v1（无木环）；切英雄换图、缺图短名、冷却/点击不变；第五键必杀不接头像' },
  { title: '钩刺第五键无畏冲锋：满能量后退三步后沿枪尖加速穿刺；七英雄统一必杀键+能量，其余点 5 显示 todo' },
  { title: '首次稳定横屏（宽≥高）再适配并锁定战场比例；竖窗不按竖屏锁死，横屏期内仍只平移' },
  { title: '钩刺蓄势弹出速度与距离约为原来 1.5 倍（16.5 格/秒）；冷却/时长/摩擦不变' },
  { title: '自己阵亡时屏幕中央偏上显示「复活还需 X 秒」（仅本人、无遮罩）；5s 回场与 2s 无敌不变' },
  { title: '自己离场时场中显示大号回场倒计时（仅本人、整数秒）；5s 回场与 2s 无敌不变，他人仍短 toast' },
  { title: '局内左上英雄选择改到设置常规页「我的英雄」，只换本地玩家；队友仍按开局随机，模式下落保留' },
  { title: '统计行去掉排名序号和队色圆点，保留红1/蓝1 等编号文字；每次进入默认收起，打开状态不持久化' },
  { title: '统计面板去掉行首图标与「我」标记，名称和数值改队色深红/深蓝；页签/收起与口径不变' },
  { title: '进入战场按当前窗适配一次后锁定显示比例；缩窗裁切、扩窗留背景，刷新才重新适配' },
  { title: '局内四技能键接入已定稿 28 张图标；切英雄换图，缺图用短名，冷却/瞄准/点击不变' },
  { title: '本地玩家脚下奶黄色双环+深棕描边，仅本人、随人移动；无头顶小牌、不改碰撞' },
  { title: '钩刺蓄势弹出改按当刻可见枪尖方向，蓄势中转向影响弹出；力度/冷却/时长不变' },
  { title: '右下本局伤害/治疗统计：双方全员、页签切换、可收到右侧；只记实际扣血回血，重开/切模式清零' },
  { title: '新增八杀模式（先到 8 杀、药水、地裂矛阵），占点保留旧领地规则；左上模式下落本地记住' },
  { title: '技能四键放大到约 60px；瞄准中「取消」出现在当前技能正上方' },
  { title: '锁死当前横屏侧：不再 CSS 转 90°，也不允许 180° 对调；无转屏提示' },
  { title: '英雄放大约 2 倍：碰撞半径 1.0，枪尖距 2.24；圆盾/羽冠/矛尖/冲锋残影对齐，技能与世界宽高不动' },
  { title: '战场加宽到 iPhone 18 Pro Max 横屏比例（高 20、宽 20×956/440）；956×440 看全图，更方屏左右略裁无黑边' },
  { title: '永远横屏对局：竖持整屏转 90°（家庭键在右时正向），无转屏提示；锁失败仍旋转，不回退竖屏可玩布局' },
  { title: '系统锁横屏（manifest + orientation.lock）；删掉请横过来遮罩与说明卡转屏文案；横屏 cover + 四角 HUD；画面不翻转' },
  { title: '只要横屏：竖窗盖「请横过来再玩」并暂停对局输入；横窗仍 cover + 四角 HUD；画面不翻转' },
  { title: '战场 cover 铺满无 letterbox；HUD 四角：换英雄左上、比分顶中、?齿轮顶右、技能右下；任意方向不翻转' },
  { title: '撤销骑马主体皮，还原圆盾+羽冠约六成+金矛尖+盾面本队编号；冲锋残影改回圆盾/圆影' },
  { title: '胜利结算板换羊皮纸木框皮；热闹金矛碎裂庆祝点缀；交互与胜负结算不动' },
  { title: '链生愈链友HOT/敌DoT、盾脉贴敌吸血、援勾对敌击退；闪弧侧闪贴背、掠刃荼毒下次枪尖+6' },
  { title: '局内主体换成俯视椭圆战马骑士；冲锋残影跟新皮，无旧圆盾影' },
  { title: '枪尖普攻去掉相对速度门槛；成功掉血后 1s CD，血条下细进度条从空涨到满' },
  { title: '触屏瞄准中点空白=瞄向并释放；滑动只改向；再点技能键仍释放；鼠键逻辑不动' },
  { title: '玩法说明卡与设置模态换羊皮纸木框皮；标题墨色，金仍只点在计时；胜利板不动' },
  { title: '局内 HUD chrome 换皮：羊皮纸+木框 2px；金只点在顶中计时；技能就绪无金闪' },
  { title: '开局与每次 R：队友和两名敌方从含镜卫全池均匀随机；玩家英雄记住上次所选' },
  { title: '钩刺钩矛：二次确认按瞄准预览扇形锁敌，后退滑时圈内敌也能放出' },
  { title: '骑士主体羽冠缩短到约六成；冲锋残影尺寸与逻辑不动' },
  { title: '技能贴战场左下外侧、我/队友下拉贴战场左上外侧；顶中比分与顶右齿轮仍贴窗顶' },
  { title: '顶右齿轮左侧加 ?，打开同一份玩法说明卡；设置「怎么玩」仍可用' },
  { title: 'HUD：左上竖叠我/队友下拉，左下 Skill1–4 横排；顶中比分与顶右齿轮不动' },
  { title: '战场 20×20；领地半径 2.5；红蓝上下两出生；竖/横窗 letterbox，画面不旋转' },
  { title: '纯竖屏操作：战场 letterbox，HUD 按竖窗重排，画面不旋转' },
  { title: '本机固定 2v2：玩家控红1 + 链生简 bot 红2，对 2 蓝简 bot；左下可换队友英雄' },
  { title: '竖持 letterbox，画面不旋转' },
  { title: '镜卫四技能落地：折光 / 反照 / 裂镜 / 镜壁；7 人池，同局可重复选' },
  { title: '竖持强制横屏显示，去掉转屏提示' },
  { title: '战斗飘字仅数字：伤害红橙、治疗绿、护盾青；从结算点上浮淡出' },
  { title: '技能键 CD：12 点起顺时针径向遮罩，剩余秒一位小数；长按提示 CD 中仍可用' },
  { title: 'Layout B 顶中一颗胶囊：红分 | 计时 | 蓝分（小队标）；去掉左上/右上独立比分' },
  { title: '囚环物理关死出不去；各持续技能时长 +2s（钉锚硬控 0.6s 不动）' },
  { title: '长按技能键约 0.4 秒弹出骑士对外名 + 一行效果；松开收起；CD 中也可看；不挡点按进瞄 / 同键释放' },
  { title: '战场 HUD Layout B：角落比分/计时胶囊、右下紧凑技能、左下换英雄；默认隐藏调试；横屏全屏、竖持强制横屏显示' },
  { title: '站点图标：红蓝对撞金矛 favicon / 触屏图标' },
  { title: '对局顶栏可随时换英雄：左下下拉指定 7 人；只换 kit，血量/位置/对局不变；GM · H 仍循环' },
  { title: '井绳四技能落地：索爆 / 易位 / 索桩 / 回索；GM · H 循环钩刺 / 磁环 / 链生 / 钉壳 / 闪弧 / 井绳' },
  { title: '闪弧四技能落地：侧闪 / 掠刃 / 回印 / 虚影；GM · H 循环钩刺 / 磁环 / 链生 / 钉壳 / 闪弧' },
];

export const ACKED_VERSION_KEY = 'idea9PinballAckedVersion';
export const HISTORY_LIMIT = 10;
export const POLL_MS = 10_000;

const RELOAD_PARAM = '_reload';
const FLASH_MS = 2000;

export function isAppVersionEntry(value: unknown): value is AppVersionEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.version === 'string' &&
    typeof entry.date === 'string' &&
    typeof entry.summary === 'string'
  );
}

export function parseVersions(data: unknown): AppVersionEntry[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isAppVersionEntry);
}

/** 按 `version` 分组，保持文件顺序（新→旧）。 */
export function groupVersions(entries: AppVersionEntry[]): VersionGroup[] {
  const groups: VersionGroup[] = [];
  const byVersion = new Map<string, VersionGroup>();
  for (const entry of entries) {
    let group = byVersion.get(entry.version);
    if (!group) {
      group = { version: entry.version, date: entry.date, summaries: [], ids: [] };
      byVersion.set(entry.version, group);
      groups.push(group);
    }
    group.summaries.push(entry.summary);
    group.ids.push(entry.id);
    if (entry.date > group.date) {
      group.date = entry.date;
    }
  }
  return groups;
}

export function findGroupIndex(groups: VersionGroup[], acked: string | null): number {
  if (!acked) {
    return -1;
  }
  return groups.findIndex((group) => group.ids.includes(acked) || group.version === acked);
}

function versionsUrl(): string {
  return `${import.meta.env.BASE_URL}versions.json?t=${Date.now()}`;
}

function readAcked(): string | null {
  try {
    return localStorage.getItem(ACKED_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeAcked(id: string): void {
  try {
    localStorage.setItem(ACKED_VERSION_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

function stripReloadParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(RELOAD_PARAM)) {
    return;
  }
  url.searchParams.delete(RELOAD_PARAM);
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function hardReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set(RELOAD_PARAM, String(Date.now()));
  window.location.replace(url.toString());
}

export function createAppVersions(): AppVersions {
  let entries: AppVersionEntry[] = [];
  let ackedId: string | null = readAcked();
  let flash = '';
  let flashTimer = 0;
  let timer = 0;
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const snapshot = (): VersionState => {
    const grouped = groupVersions(entries);
    const idx = findGroupIndex(grouped, ackedId);
    const installed = idx === -1 ? (grouped[0] ?? null) : grouped[idx];
    const pending = !ackedId
      ? grouped[0]
        ? [grouped[0]]
        : []
      : idx === -1
        ? grouped
        : grouped.slice(0, idx);
    return {
      entries,
      grouped,
      history: grouped.slice(0, HISTORY_LIMIT),
      installed,
      pending,
      flash,
    };
  };

  const showFlash = (message: string): void => {
    flash = message;
    emit();
    if (flashTimer) {
      window.clearTimeout(flashTimer);
    }
    flashTimer = window.setTimeout(() => {
      flash = '';
      flashTimer = 0;
      emit();
    }, FLASH_MS);
  };

  const refresh = async (): Promise<void> => {
    try {
      const response = await fetch(versionsUrl(), { cache: 'no-store' });
      if (!response.ok) {
        return;
      }
      const next = parseVersions(await response.json());
      if (!next.length) {
        return;
      }
      ackedId = readAcked();
      entries = next;
      emit();
    } catch {
      // ignore network errors; next poll retries
    }
  };

  const clearCaches = async (reloadDelayMs = 0): Promise<void> => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // still reload so the shell refetches
    }
    if (reloadDelayMs > 0) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, reloadDelayMs);
      });
    }
    hardReload();
  };

  const applyUpdate = async (): Promise<void> => {
    const newest = entries[0];
    if (newest) {
      writeAcked(newest.id);
      ackedId = newest.id;
      emit();
    }
    try {
      await clearCaches();
    } catch {
      hardReload();
    }
  };

  const checkUpdate = async (): Promise<void> => {
    await refresh();
    const state = snapshot();
    if (!state.entries.length) {
      showFlash('暂时读不到版本说明');
      return;
    }
    if (state.pending.length) {
      showFlash('有新版本');
      return;
    }
    showFlash('已是最新');
  };

  stripReloadParam();
  void refresh();
  timer = window.setInterval(() => {
    void refresh();
  }, POLL_MS);

  return {
    getState: snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    checkUpdate,
    applyUpdate,
    dispose: () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
      if (flashTimer) {
        window.clearTimeout(flashTimer);
        flashTimer = 0;
      }
      listeners.clear();
    },
  };
}
