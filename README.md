# 土豆削削乐（Potato Please 移动端改编）

微信小游戏原生 Canvas 2D 项目：竖屏拇指削土豆，削净率 / 浪费率双指标评级，军需订单 + 装备成长 + 离线收益，接入微信流量主广告（激励视频 / 插屏 / Banner）。

灵感来自 Steam 上的《Potato Please》（第一人称物理削土豆、军需配额、黑色幽默家书）。本项目把它改造成适合手机单手操作的小游戏：不用瞄准、不用转视角，按住土豆来回滑动即可削皮，把“削得干净、削得薄”做成核心技巧。

## 玩法

- **削皮**：按住土豆来回滑动，擦掉表皮；同一点反复刮会削掉果肉，产生“浪费”。
- **交单**：每颗土豆削净率达到订单目标后，点「完成这颗」；一单有多颗土豆，全部完成才结算。
- **评级**：按平均浪费率给 S / A / B / C，评级影响金币倍率；整单无 B/C 额外 +12%。
- **限时**：订单有倒计时，超时可看激励视频加时 15 秒，或重新挑战。
- **成长**：军需商店升级削皮刀（削皮更宽）、防割手套（浪费判定更宽容）、军需木桶（收益加成）、自动削皮机（离线产出）、加时沙漏。
- **日常**：每日 7 天补给、每日任务、免费补给箱、离线收益、金土豆订单。

## 变现设计（微信广告）

配置入口：[src/config.js](src/config.js) 的 `ads` 字段。

| 场景 | 广告类型 | 触发点 | 备注 |
| --- | --- | --- | --- |
| 结算翻倍 | 激励视频 | 结算卡「看视频 · 金币翻倍」 | 每单一次 |
| 失败加时 | 激励视频 | 超时弹层「看视频 · 加时 15 秒」 | 每单一次 |
| 每日翻倍 | 激励视频 | 每日补给领取后「看视频再翻倍」 | 每天一次 |
| 免费补给箱 | 激励视频 | 商店「免费补给箱」 | 3 小时冷却 |
| 离线收益翻倍 | 激励视频 | 大厅离线收益条 | 有离线收益时 |
| 插屏 | 插屏广告 | 完成订单后点「下一单 / 回大厅」 | 每 3 单一次，间隔 ≥90 秒，前 2 单不打扰 |
| Banner | Banner 广告 | 大厅、商店底部 | 进入玩法自动隐藏 |

- 未配置广告位时（`ads.enabled=false` 或广告位 ID 为空），自动使用内置**演示广告**，完整走完“播放 → 倒计时 → 领取奖励”的链路，方便评审和真机联调。
- 所有广告请求 / 成功 / 失败都会通过 `Platform.reportEvent` 打点，便于接微信数据分析。

上线前把 `src/config.js` 中：

```js
ads: {
  enabled: true,
  rewardedAdUnitId: 'adunit-xxxxxxxxxxxxxxxx',
  interstitialAdUnitId: 'adunit-xxxxxxxxxxxxxxxx',
  bannerAdUnitId: 'adunit-xxxxxxxxxxxxxxxx',
  demoAds: false
}
```

## 目录结构

```
minigame/            微信小游戏运行目录（构建产物）
  game.js            单文件 IIFE bundle（由 scripts/build.js 生成）
  game.json          小游戏配置（竖屏）
src/                 源码（CommonJS，零依赖）
  main.js            启动、主循环、场景切换、演示广告、插屏策略
  config.js          数值、广告位、文案（主要调参入口）
  platform.js        微信 / 浏览器适配层（canvas、触摸、存储、震动、广告、分享）
  potato.js          削皮核心：不规则轮廓、网格削净统计、皮肤离屏擦除、浪费判定
  economy.js         订单、评级、升级、每日、任务、离线、宝箱、存档
  ads.js             激励视频 / 插屏 / Banner 封装 + 演示广告兜底
  ui.js              主题色、按钮、图标、进度条等绘制工具
  audio.js           WebAudio 合成音效
  storage.js         存档读写与默认值合并
  fx.js              皮屑、星光、飘字
  scenes/            menu / play / shop / daily / settings
scripts/
  build.js           零依赖打包器：src → minigame/game.js
  serve.js           本地静态服务器（默认 5173，打印局域网地址）
index.html           浏览器预览页（同一份 bundle，手机全屏）
project.config.json  微信开发者工具项目配置
```

## 本地开发 / 预览

需要 Node.js 18+，无第三方依赖。

```bash
npm run build   # 打包 src → minigame/game.js
npm run serve   # 启动本地预览 http://localhost:5173
npm run dev     # 打包并启动
```

浏览器打开后按手机尺寸查看；同一局域网内可用终端打印的局域网地址在手机上玩。

## 导入微信开发者工具

1. 用微信开发者工具「导入项目」，目录选择本仓库根目录（`project.config.json` 已配置 `compileType: game`、`miniprogramRoot: minigame/`）。
2. 把 `project.config.json` 里的 `appid` 换成你自己的小游戏 AppID（当前为 `touristappid`）。
3. 编译后即可在模拟器 / 真机预览；发布前在微信公众平台开通流量主，创建广告位并填入 `src/config.js`。
4. 每次改完源码执行 `npm run build`，再在开发者工具里点「编译」。

## 数值与调参

主要数值都在 [src/config.js](src/config.js)：

- `order`：每单土豆数、基础收益、限时、金土豆频率
- `play`：画笔宽度、削皮步进、浪费深度阈值、目标削净率
- `grades`：浪费率区间与金币倍率
- `upgrades`：5 条成长线的价格与成长曲线
- `dailyRewards` / `quests` / `chest` / `idle`：日常与离线收益

## 存档与数据

- 存档键：`potato_please_save_v1`，使用 `wx.setStorageSync`（浏览器为 `localStorage`）。
- 关键埋点：`order_start_peel`、`order_complete`、`order_fail`、`result_show`、`ad_request`、`ad_reward`、`ad_fail`、`ad_show_demo`、`share_click`。
- 清空存档：设置 → 清空存档（二次确认）。

## 合规说明

- 无内购、无支付、无用户隐私信息采集；仅使用微信广告能力变现。
- 所有美术均由 Canvas 代码绘制，无外部图片 / 字体资源，包体小。
- 广告奖励均为“加速 / 翻倍 / 补时”类增益，不设置强制观看门槛。

## 后续可做

- 更多刀具 / 皮肤与土豆品种（紫薯、红薯）
- 周榜 / 好友比拼（开放数据域）
- 军需官剧情与家书收集
- 关卡化订单与特殊土豆（发芽、冻伤）

## License

MIT
