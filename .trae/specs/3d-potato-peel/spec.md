# 土豆削削乐 - 3D 土豆 + 可切换削皮工具 - 产品需求文档

## Overview
- **Summary**: 将游戏中的土豆从当前的 2D 平面绘制升级为 Three.js/WebGL 渲染的真实 3D 土豆（可旋转、有光照立体感），削皮时显示一把跟随手指的可见工具，并支持多种工具切换。
- **Purpose**: 提升画面表现力与削皮沉浸感，增强产品差异化与上线竞争力。
- **Target Users**: 微信小游戏玩家（中低端真机为主）。

## Goals
- 土豆以真实 3D 网格呈现，可见旋转与立体光照。
- 削皮时有可见工具跟随触点，带刮削动效与皮屑反馈。
- 提供至少 2 种可切换工具，影响削皮宽度与浪费。
- 不破坏现有 2D UI、玩法循环、存档、广告、隐私授权等已工作功能。

## Non-Goals
- 不重写现有 2D UI 层为 Three.js 精灵（保留 2D 画布 UI）。
- 不做高精度网格布尔/体素雕刻（削皮采用纹理擦除方案）。
- 不引入真实 3D 模型加载（.glTF）；土豆用程序生成的球体/椭球体网格。
- 不改变经济系统、订单、升级、存档结构。

## Background & Context
- 项目路径：`D:\xuetudou`（原 `d:\x削土豆` 已重命名）。
- 现状：主循环 `main.js` 用 2D canvas 绘制；`potato.js` 把土豆画成带凸起的圆，削皮靠离屏 skin canvas 的 `destination-out` 擦除并统计 `peeledCells`/`wasteCells`。
- 平台约束（已查证）：**微信小游戏只有一个上屏画布**，不能叠加第二个上屏 2D 画布（参考微信开放社区《微信3D小游戏下HUD绘制的经验分享》）。因此不能把主画布切 WebGL 后再叠 2D UI 画布。
- **用户决策（OQ-1）**：选择「全部 UI 也迁到 Three.js」，即 Three.js 拥有唯一上屏画布。
- **选定策略（Three.js 全屏 + 离屏 2D UI 纹理合成）**：
  - 主画布 = WebGL，由 Three.js 持有（首个 `wx.createCanvas()` 为上屏画布，给 Three.js 渲染器）。
  - 新建一个**离屏 2D 画布**（第二个 `wx.createCanvas()`），**现有全部 UI/场景绘制代码原样重定向到这个离屏 2D 上下文**（即把 `Main` 的 `this.ctx` 换成离屏 2D 画布的 context，场景/ui/fx/ads/privacy 代码几乎零改动）。
  - 每帧：Three.js 先渲染 3D 土豆（背景层）→ 再把离屏 2D 画布作为全屏纹理（正交相机 quad）叠加在最上层 → 呈现到上屏 WebGL 画布。
  - 削皮：触摸坐标 → 在 3D 场景中 Raycaster 命中土豆 → 取交点 UV → 在土豆表皮纹理的对应 UV 处擦除 → `texture.needsUpdate`。
  - 触摸事件在小游戏中是全局的，坐标与屏幕一致，UI 命中检测逻辑无需改动。
- 此架构满足「Three.js 拥有整个屏幕」，同时最大化保留现有 2D UI 代码、降低回归风险。**若用户实际意图是「把每个 UI 元素都重写成 Three.js 3D 精灵」，需在批准前明确指出——那是更大的工作量，本 spec 不默认包含。**
- 适配器选型（已查证）：旧包 `threejs-miniprogram`（v0.0.8，6 年未更新）已弃用；现行维护的是 `three-platformize`（支持微信小游戏、可 tree-shaking）或 `@minisheep/three-platform-adapter/wechat-game`。实现阶段先做 spike 验证其中一个可在本项目编译运行。浏览器端（index.html 预览）不需要适配器，直接用原生 three + 浏览器 canvas。
- 集成方式：`package.json` 增加 `three` 与适配器依赖；开发者工具执行「构建 npm」生成 `minigame/miniprogram_npm/`；业务代码 `require('three')` 由微信运行时解析（现有 `build.js` 会原样保留外部 `require`，不内联 node_modules）。适配器仅在 `typeof wx !== 'undefined'` 时加载，避免影响浏览器预览。

## Functional Requirements
- **FR-1**: 土豆由 Three.js 渲染为带光照的 3D 椭球体网格，贴有程序生成的土豆表皮纹理。
- **FR-2**: 土豆会自动缓慢自转；玩家可在土豆区域外拖动来手动旋转（或双指旋转），旋转时削皮进度保持（在 3D 表面连续）。
- **FR-3**: 手指触摸时，一把可见的削皮工具（刨皮刀）图形跟随触点；移动时有刮削高光与皮屑粒子，停住时工具静止。
- **FR-4**: 提供工具切换入口（至少 2 种：刨皮刀、钢丝球）；不同工具有不同削皮宽度与浪费系数，并在 UI 上显示当前工具。
- **FR-5**: 削皮在 3D 表面生效：射线命中 → 擦除对应 UV 区域表皮；削皮完成度、浪费、评级、达标判定与现行规则一致。
- **FR-6**: 现有 2D UI（主菜单、商店、每日、设置、结算、HUD、广告遮罩、隐私弹窗、toast）全部保留且正常显示与交互。
- **FR-7**: 旧存档升级后不丢失进度，经济/订单数据结构不变。

## Non-Functional Requirements
- **NFR-1**: 微信开发者工具编译通过，模拟器可启动并进入主菜单。
- **NFR-2**: 真机中端机（如骁龙 7 系）游戏内 ≥ 30fps。
- **NFR-3**: 主包体积 ≤ 4MB（three.js 控制在合理体积，启用压缩）。
- **NFR-4**: 低端机若 WebGL 性能不足，可降级回原 2D 土豆渲染（保留开关），保证不闪退。

## Constraints
- **Technical**: 微信小游戏单上屏画布；WebGL 与 2D context 不能共存于同一 canvas；基础库 ≥ 2.7.0 支持 webgl type（项目 libVersion 3.7.1 满足）。
- **Business**: 不破坏已上线准备流程（广告、隐私、构建产物 `minigame/`）。
- **Dependencies**: `three` 及微信小游戏适配器 npm 包；需开发者工具「构建 npm」。

## Assumptions
- 小游戏可创建多个 canvas：首个为上屏（WebGL，给 Three.js），第二个为离屏 2D（画 UI）；离屏 2D canvas 可作为 `THREE.CanvasTexture` 上传并由 Three.js 绘制为全屏 quad —— 在 spike 任务中验证。
- Raycaster 从屏幕坐标命中 3D 土豆并取交点 UV 可行 —— 在 spike 中验证。
- 浏览器预览（index.html）走原生 three，不加载微信适配器 —— 在实现中用 `typeof wx` 分支处理。
- 用户已确认采用「Three.js 全屏 + 离屏 2D UI 纹理合成」架构（OQ-1），而非把每个 UI 元素重写为 3D 精灵。

## Acceptance Criteria

### AC-1: 编译与启动不回退
- **Type**: `rule`
- **Given**: 完成改造后在微信开发者工具打开 `D:\xuetudou`
- **When**: 点击「编译」
- **Then**: 编译无报错，模拟器进入主菜单，无 JS 异常
- **Pass Condition**: 控制台无红色错误，主菜单正常显示
- **Evidence**: 编译日志 + 控制台截图

### AC-2: 土豆为真实 3D 渲染
- **Type**: `rule`
- **Given**: 进入任意一关出现土豆
- **When**: 观察土豆画面
- **Then**: 土豆呈现立体椭球、有光照高光与阴影、随时间可见旋转，不是平面圆
- **Pass Condition**: 可观察到 3D 体积感与旋转
- **Evidence**: 模拟器/真机截图或录屏

### AC-3: 旋转后可继续削皮
- **Type**: `rule`
- **Given**: 土豆旋转到一个新角度
- **When**: 在新角度的表面刮削
- **Then**: 表皮在该角度被擦除，累计削皮进度上升，可削到土豆各面
- **Pass Condition**: 旋转后刮削仍生效，能完成整颗土豆
- **Evidence**: 操作录屏

### AC-4: 可见削皮工具与反馈
- **Type**: `rule`
- **Given**: 手指触摸并在土豆上移动
- **When**: 移动过程中
- **Then**: 一把工具图形跟随触点，伴随刮削高光与皮屑粒子；手指停住时工具静止
- **Pass Condition**: 工具可见且随动，有动效反馈
- **Evidence**: 截图/录屏

### AC-5: 工具可切换且影响数值
- **Type**: `rule`
- **Given**: 游戏内存在工具切换入口
- **When**: 切换到不同工具并削皮
- **Then**: 至少 2 种工具，削皮宽度或浪费系数不同，UI 显示当前工具
- **Pass Condition**: 切换生效，数值差异可观察
- **Evidence**: 截图 + 数值对比

### AC-6: 削皮统计与判定一致
- **Type**: `rule`
- **Given**: 使用 3D 削皮完成一单
- **When**: 结算
- **Then**: 削皮完成度、浪费、评级、金币计算与改造前规则一致
- **Pass Condition**: 评级/金币逻辑不变，达标可过关
- **Evidence**: 结算截图对比

### AC-7: 现有 2D UI 全部保留
- **Type**: `rule`
- **Given**: 改造完成
- **When**: 浏览主菜单、商店、每日、设置、结算、HUD、广告、隐私弹窗
- **Then**: 所有界面与交互正常，无缺失或错位
- **Pass Condition**: 各界面功能与改造前一致
- **Evidence**: 逐界面截图

### AC-8: 真机流畅度
- **Type**: `rubric`
- **Dimension**: 中端真机游戏内帧率稳定性
- **Scale**: 1-5
- **Anchors**: 1 = 明显卡顿 <20fps; 3 = 偶有掉帧 20-30fps; 5 = 稳定 ≥30fps 流畅
- **Pass Threshold**: >= 4
- **Evidence**: 真机性能面板或录屏

### AC-9: 包体积合规
- **Type**: `rule`
- **Given**: 构建 npm 并打包后
- **When**: 查看主包体积
- **Then**: 主包 ≤ 4MB
- **Pass Condition**: 上传时无体积超限提示
- **Evidence**: 开发者工具详情页体积

### AC-10: 存档兼容
- **Type**: `rule`
- **Given**: 已有旧存档的设备升级
- **When**: 启动游戏
- **Then**: 金币、订单、升级等进度保留，不报错
- **Pass Condition**: 存档读取无异常，进度一致
- **Evidence**: 升级前后存档对比

### AC-11: 低端机可降级
- **Type**: `rule`
- **Given**: WebGL 不可用或性能不足（如降级开关打开）
- **When**: 启动
- **Then**: 回退到原 2D 土豆渲染，游戏可正常进行
- **Pass Condition**: 降级后不闪退，可削皮
- **Evidence**: 降级路径测试

## Open Questions
- [x] **OQ-1（方案确认）**: 用户选择「全部 UI 也迁到 Three.js」。落地为「Three.js 全屏 + 离屏 2D UI 纹理合成」架构（Three.js 拥有唯一上屏画布，现有 UI 绘制代码重定向到离屏 2D 画布后作为纹理叠加）。**若实际意图是把每个 UI 元素重写为 Three.js 3D 精灵，请在批准前指出，本 spec 不默认包含。**
- [x] **OQ-2（旋转交互）**: 采用「自动缓慢自转 + 土豆区域外单指拖动旋转」。
- [x] **OQ-3（工具种类）**: 做 3 种工具：刨皮刀（中等宽度/中等浪费）、钢丝球（宽/高浪费）、精准刀（窄/低浪费）。
