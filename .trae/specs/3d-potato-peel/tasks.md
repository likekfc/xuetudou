# 土豆削削乐 - 3D 土豆 + 可切换削皮工具 - 实现计划

> 架构（已确认）：主画布 = WebGL / Three.js（拥有唯一上屏画布）；离屏 2D 画布承接现有全部 UI 绘制，作为全屏纹理由 Three.js 叠加在 3D 土豆上层。
> 原则：先做技术 spike 验证（Task 1），通过后再正式改造；保留原 2D 土豆代码作为降级回退（Task 8）。

## Task 1: 技术 Spike — 验证「WebGL 主画布 + 离屏 2D UI 纹理合成」在小游戏可运行
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `package.json` 增加 `three` 与微信小游戏适配器依赖（先试 `three-platformize`，备选 `@minisheep/three-platform-adapter/wechat-game`）。
  - 开发者工具执行「构建 npm」，确认 `minigame/miniprogram_npm/` 生成且 `require('three')` 可解析；浏览器预览（index.html）走原生 three 不加载适配器。
  - 临时验证脚本：首个 `wx.createCanvas()` 给 Three.js 做 WebGL 渲染器（画一个旋转立方体）；第二个 `wx.createCanvas()` 取 2D 上下文，在上面画一些文字/矩形；把离屏 2D 画布作为 `THREE.CanvasTexture` 用正交相机画一个全屏 quad 叠加在立方体上层。
  - 验证：模拟器中可见立方体 + 上层 UI 文字；触摸坐标 → Raycaster 命中立方体 → 控制台打印交点 UV。
- **Acceptance Criteria Addressed**: AC-1（部分）、Assumptions 验证
- **Test Requirements**:
  - `rule` TR-1.1: 开发者工具编译无错误，模拟器出现旋转立方体且上层 2D UI 文字可见；证据：编译日志 + 截图。
  - `rule` TR-1.2: 触摸立方体控制台打印命中 UV；证据：控制台输出。
- **Notes**: 可行性验证，代码临时写在独立文件；若失败，回到 spec 讨论替代方案（raw WebGL / 放弃 3D / 改为混合贴回）。

## Task 2: 搭建渲染管线骨架（主画布 WebGL + 离屏 2D UI 合成）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - 新建 `src/render3d.js`：封装 Three.js 初始化（场景/相机/渲染器绑定到首个上屏 WebGL 画布）、一个全屏正交 quad 用于承载 UI 纹理、每帧 composite 接口。
  - 修改 `main.js` / `platform.js`：把游戏的 `this.ctx` 改为**离屏 2D 画布**的 context（现有场景/ui/fx/ads/privacy 绘制代码不变，目标画布变成离屏）。
  - 主循环每帧：让场景照常画到离屏 2D ctx → 标记 UI 纹理 needsUpdate → Three.js 先渲染 3D 层 → 再渲染 UI 全屏 quad 到上屏。
  - 3D 层先放空场景（或一个占位球），验证整个管线通：UI 正常显示在上层。
- **Acceptance Criteria Addressed**: AC-1, AC-7（管线基础）
- **Test Requirements**:
  - `rule` TR-2.1: 启动后主菜单等 2D UI 正常显示在 WebGL 画布上，点击交互正常；证据：截图。
  - `rule` TR-2.2: `node scripts/build.js` 成功，`node --check minigame/game.js` 通过；证据：命令输出。
- **Notes**: 这是最关键的一步，必须保证现有 UI 零回归；原 2D 土豆代码先保留不删。

## Task 3: 3D 土豆网格与渲染（src/render3d.js 土豆部分）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 在 3D 场景创建椭球体土豆网格（`SphereGeometry` 缩放为椭球，顶点加少量噪声模拟凹凸），生成程序土豆表皮纹理（浅褐色斑点 + 内部颜色层），加环境光 + 平行光。
  - 土豆在 play 场景可见，自动缓慢自转；非 play 场景隐藏 3D 层（或只显示纯色背景）。
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `rule` TR-3.1: 进入关卡可见立体、带光照的椭球土豆并缓慢自转；证据：截图。

## Task 4: 3D 表面削皮（射线 + UV 纹理擦除）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - `render3d.peelAt(screenX, screenY, toolWidth)`：屏幕坐标 → `Raycaster` 命中土豆 → 取交点 UV → 在表皮纹理画布对应 UV 处 `destination-out` 画圆（半径=toolWidth）→ `texture.needsUpdate`。
  - 削皮进度：统计表皮纹理 alpha 被擦除像素占比（降采样网格加速）→ `peeledPercent`。
  - 修改 `play.js`：触摸移动调用 `render3d.peelAt` 替代原 `potato.peelTo` 的视觉擦除；浪费/评级/达标逻辑保持不变（按现有规则适配 3D 的 peelPercent 与 waste）。
  - 处理 UV 接缝（球顶/底）的擦除连续性，避免旋转后出现未削缝隙。
- **Acceptance Criteria Addressed**: AC-3, AC-6
- **Test Requirements**:
  - `rule` TR-4.1: 刮削可见表皮被擦除、露出内部；证据：截图。
  - `rule` TR-4.2: 完成削皮后结算评级/金币与改造前规则一致；证据：结算截图对比。
  - `rubric` TR-4.3: 削皮跟手性；scale 1-5；1=严重延迟; 3=可接受; 5=即时跟手；threshold >= 4；证据：录屏。

## Task 5: 旋转交互（自转 + 土豆外拖动旋转）
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3, Task 4
- **Description**:
  - 自动缓慢自转（y 轴），刮削时暂停、松开恢复。
  - 土豆绘制矩形外的拖动 → 手动旋转土豆（单指）。
  - 旋转后纹理保持，已削区域在 3D 表面连续不丢失。
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `rule` TR-5.1: 旋转到背面后刮削仍生效，能削完整颗土豆；证据：录屏。
  - `rule` TR-5.2: 已削区域旋转后位置正确不漂移；证据：录屏。

## Task 6: 可见削皮工具与刮削反馈
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - 在离屏 2D UI 画布（上层）触点位置绘制当前工具图形，跟随手指。
  - 刮削时生成皮屑粒子（复用/扩展 `fx.js`）+ 一条高光刮痕；手指静止时工具静止、无粒子。
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `rule` TR-6.1: 触摸移动时工具跟随并有皮屑/高光，停住时静止；证据：录屏。

## Task 7: 3 种可切换工具
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 4, Task 6
- **Description**:
  - `config.js` 定义 3 种工具：刨皮刀（中宽/中浪费）、钢丝球（宽/高浪费）、精准刀（窄/低浪费），字段 `id/name/peelWidth/wasteMul/icon`。
  - play 场景 HUD 加工具切换入口，切换后当前工具高亮显示。
  - `render3d.peelAt` 与浪费计算读取当前工具的 `peelWidth`/`wasteMul`。
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TR-7.1: 3 种工具可切换，UI 显示当前工具；证据：截图。
  - `rule` TR-7.2: 不同工具削皮宽度/浪费有可观察差异；证据：数值/截图对比。

## Task 8: 2D UI 全量回归 + 集成联调
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 4, Task 5, Task 6, Task 7
- **Description**:
  - 逐界面确认：主菜单、商店、每日、设置、结算、HUD、广告遮罩、隐私弹窗、toast 在新管线（UI 纹理合成）下全部正常显示与点击。
  - 非 play 场景不渲染土豆网格（只保留必要背景），节省性能；触摸路由无冲突（削皮 vs UI 按钮 vs 旋转拖动）。
  - 修复集成中的层级、坐标、透明度（UI 纹理需支持透明，使 3D 土豆透出）问题。
- **Acceptance Criteria Addressed**: AC-1, AC-7, AC-10
- **Test Requirements**:
  - `rule` TR-8.1: 逐界面功能正常；证据：逐界面截图。
  - `rule` TR-8.2: 旧存档升级后进度保留无报错；证据：升级前后存档对比。
  - `rule` TR-8.3: 非 play 场景不渲染土豆网格；证据：代码检查 + 截图。

## Task 9: 降级开关（回退原 2D 渲染）
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
  - `config.js` 增加 `render3d.enabled`（默认 true）；WebGL 不可用时自动置 false。
  - 开关 false 时：主画布回到 2D（不走 WebGL），play 场景走原 2D 土豆绘制与削皮逻辑（保留的旧代码）。
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `rule` TR-9.1: 关闭 3D 开关后回退 2D 土豆，可正常削皮过关；证据：截图。

## Task 10: 性能与体积优化 + 真机验证
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
  - Three.js tree-shaking 按需引入；纹理/离屏画布分辨率适中；必要时降低网格面数与像素统计频率。
  - 真机中端机帧率 ≥30fps；主包体积 ≤4MB。
- **Acceptance Criteria Addressed**: AC-8, AC-9
- **Test Requirements**:
  - `rubric` TR-10.1: 中端真机游戏内帧率；scale 1-5；1=<20fps; 3=20-30; 5=≥30 稳定；threshold >= 4；证据：真机性能面板/录屏。
  - `rule` TR-10.2: 主包体积 ≤4MB；证据：开发者工具详情页。

## Task 11: 全量构建校验与回归
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10
- **Description**:
  - `node scripts/build.js` 构建；`node --check` 语法校验；所有 JSON 无 BOM 可解析；`minigame/` 产物正确。
  - 完整玩通一局（削皮 → 达标 → 结算 → 金币），覆盖 3 种工具切换与旋转到背面削皮。
- **Acceptance Criteria Addressed**: AC-1, AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-11.1: 构建与语法校验通过、JSON 有效；证据：命令输出。
  - `rule` TR-11.2: 完整一局通关无异常，覆盖工具切换与旋转；证据：录屏/截图。
