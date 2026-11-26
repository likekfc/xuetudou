// esbuild 打包入口（仅构建时使用，不会被游戏运行时 require）
// 把 platformized three + 两个平台适配器打成一个自包含 CJS 模块，供小游戏与浏览器共用。
import * as THREE from 'three-platformize';
import { WechatGamePlatform } from 'three-platformize/src/WechatGamePlatform';
import { BrowserPlatform } from 'three-platformize/src/BrowserPlatform';

export { THREE, WechatGamePlatform, BrowserPlatform };
