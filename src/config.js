/**
 * 全局配置：数值、广告位、文案。
 * 上线前把 ads.enabled 改为 true，并填入微信流量主后台的真实广告位 ID。
 */
var CONFIG = {
  version: '1.0.0',
  title: '土豆削削乐',
  tagline: '拇指削皮 · 越削越上头',
  saveKey: 'potato_please_save_v1',

  // 【上线三步】① 微信公众平台开通「流量主」② 创建广告位拿到 adUnitId ③ enabled 改 true 并填入 ID。
  // 安全降级：enabled=true 但 ID 留空时会自动走演示广告，不会崩溃；真机发布前务必填真实 ID。
  privacy: {
    // 《用户隐私保护指引》需在微信公众平台后台「设置 → 服务内容声明 → 用户隐私保护指引」填写，
    // 这里仅用于画布弹窗文案，名称需与后台指引标题一致。
    agreementName: '《用户隐私保护指引》'
  },

  ads: {
    enabled: false,
    rewardedAdUnitId: '',
    interstitialAdUnitId: '',
    bannerAdUnitId: '',
    // 演示模式：未配置广告位时用内置演示广告，保证变现流程可体验
    demoAds: true,
    demoRewardedSeconds: 5,
    demoInterstitialSeconds: 3,
    // 插屏：每完成 N 单触发一次，且距离上次至少 90 秒；首单不打扰
    interstitialEveryOrders: 3,
    interstitialCooldownMs: 90000,
    firstOrdersWithoutInterstitial: 2
  },

  play: {
    grid: 88,
    stampStep: 2.3,
    baseBrush: 16.5,
    brushPerKnife: 1.05,
    // 同一块果肉被反复刮到的“深度”，超过阈值才算浪费
    wasteDepthBase: 56,
    wasteDepthPerGlove: 2.0,
    targetBase: 0.86,
    targetPerOrder: 0.003,
    targetMax: 0.9,
    completeDelay: 0.18
  },

  order: {
    timeBase: 44,
    timePerPotato: 16,
    timePerHourglass: 6,
    baseCoins: 20,
    coinsPerOrder: 9,
    coinsPerPotato: 4,
    goldenEvery: 5,
    goldenPeel: 0.95,
    maxPotatoes: 7
  },

  grades: [
    { key: 'S', name: '完美', minWaste: 0, maxWaste: 0.02, mul: 1.7, color: '#F2B84B' },
    { key: 'A', name: '优秀', minWaste: 0.02, maxWaste: 0.045, mul: 1.35, color: '#7FB069' },
    { key: 'B', name: '合格', minWaste: 0.045, maxWaste: 0.08, mul: 1.12, color: '#8AA6C0' },
    { key: 'C', name: '勉强', minWaste: 0.08, maxWaste: 1, mul: 0.92, color: '#B08B6E' }
  ],

  upgrades: [
    {
      id: 'knife',
      name: '削皮刀',
      icon: 'knife',
      max: 10,
      start: 1,
      baseCost: 100,
      growth: 1.55,
      brief: '削皮更宽，一刀带走更多皮'
    },
    {
      id: 'gloves',
      name: '防割手套',
      icon: 'gloves',
      max: 8,
      start: 0,
      baseCost: 150,
      growth: 1.62,
      brief: '减少手滑，浪费判定更宽容'
    },
    {
      id: 'bucket',
      name: '军需木桶',
      icon: 'bucket',
      max: 10,
      start: 1,
      baseCost: 130,
      growth: 1.6,
      brief: '每单土豆币收益提升'
    },
    {
      id: 'machine',
      name: '自动削皮机',
      icon: 'machine',
      max: 10,
      start: 0,
      baseCost: 240,
      growth: 1.66,
      brief: '离线也在替你削土豆，持续产出'
    },
    {
      id: 'hourglass',
      name: '加时沙漏',
      icon: 'hourglass',
      max: 5,
      start: 0,
      baseCost: 180,
      growth: 1.72,
      brief: '每张军需订单额外增加时间'
    }
  ],

  dailyRewards: [30, 40, 55, 70, 90, 120, 180],

  quests: [
    { id: 'orders', text: '完成 2 张军需订单', target: 2, reward: 35 },
    { id: 'potatoes', text: '削完 10 个土豆', target: 10, reward: 40 },
    { id: 'sgrade', text: '获得 1 次 S 评级', target: 1, reward: 55 },
    { id: 'waste', text: '单颗浪费低于 1.5%', target: 1, reward: 45 }
  ],

  idle: {
    coinsPerMinutePerLevel: 3,
    maxOfflineHours: 8
  },

  chest: {
    cooldownMs: 3 * 60 * 60 * 1000,
    minCoins: 45,
    maxCoins: 90
  },

  theme: {
    bgTop: '#F9EBCB',
    bgBottom: '#E7CFA3',
    wall: '#F3E2C2',
    wallLine: '#E2CBA4',
    counter: '#C08A50',
    counterDark: '#9A6738',
    ink: '#4A2E19',
    inkSoft: '#7E5A38',
    cream: '#FFF8E8',
    skin: '#B87A42',
    skinDark: '#7E4A20',
    flesh: '#F8E6B4',
    fleshDark: '#E4C07C',
    green: '#6FA85E',
    greenDark: '#4C7E40',
    gold: '#F2B84B',
    goldDark: '#C98B24',
    red: '#D9694F',
    blue: '#6C9FC4',
    white: '#FFFFFF',
    shadow: 'rgba(70,40,15,0.18)'
  },

  // 3D 渲染（Three.js）配置。
  // Task 1 验证期：spike 在微信环境默认开启（开发者工具编译即可看到验证画面）；
  // 浏览器需在 URL 加 ?spike=1 才进入 spike，否则跑正常游戏。验证通过后 spike 关闭。
  render3d: {
    spike: (typeof wx !== 'undefined') ? true : (typeof window !== 'undefined' && /[?&]spike=1/.test(window.location.search))
  }
};

module.exports = CONFIG;
