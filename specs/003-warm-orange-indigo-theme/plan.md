# Implementation Plan: 暖橙靛蓝视觉主题

**Branch**: `003-warm-orange-indigo-theme` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-warm-orange-indigo-theme/spec.md`

## Summary

将现有绿色健康工具风格迁移为参考图方向的暖橙靛蓝主题：暖米白作为页面底色，橙色作为活动主视觉，靛蓝作为主要操作色，黄色和珊瑚色表达点位与状态。实施以全局语义 token 为核心，清理页面、原生导航栏、地图自有标记和完赛 Canvas 中的旧绿色硬编码。所有业务逻辑、页面结构、数据、导航路径和状态转换保持不变。

## Technical Context

**Language/Version**: 微信原生小程序 JavaScript、WXML、WXSS；现有 Node.js 静态测试脚本

**Primary Dependencies**: 微信原生运行时、原生 `map` 组件；无新增依赖

**Storage**: N/A；本次不改变现有本地 storage

**Testing**: `tests/run-tests.js` 现有结构检查与业务回归测试；新增主题静态检查；微信开发者工具预览和代表性真机视觉检查

**Target Platform**: 微信小程序开发者工具、Android、HarmonyOS、iOS 微信客户端

**Project Type**: Native WeChat mini-program

**Performance Goals**: 换肤不增加页面首屏资源和运行时网络请求；现有动画、地图和 Canvas 性能保持不变

**Constraints**: 只改视觉呈现；不改变扫码校验、路线顺序、照片保存、完赛生成和本地数据；兼容现有 320px 至主流手机宽度和安全区

**Scale/Scope**: 7 个页面、2 个自有组件、应用导航配置、地图颜色配置和完赛 Canvas 绘制

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- **I. Platform Truth**: PASS. 本次不增加平台能力，不依赖 NFC、相机或系统差异；真实设备只用于验证视觉和导航栏表现。
- **II. Authority Boundaries**: PASS. 不改变当前设备本地数据边界，也不新增服务端或身份声明。
- **III. Fail Closed**: PASS. 扫码失败、错误点位和完成状态的业务规则不变，只更换显示色和辅助图形。
- **IV. Testable State Transitions**: PASS. 现有状态转换不变，补充主题静态检查和关键状态截图检查。
- **V. Minimal, Reversible Delivery**: PASS. 优先修改现有 token 和硬编码颜色，不引入新框架、资源或基础设施；可通过单次样式回滚恢复。

## Research Summary

研究结论详见 [research.md](./research.md)：当前颜色已经有全局变量，但地图 JavaScript、完赛 Canvas、页面 JSON 和少数 WXSS 仍存在独立硬编码。因此只改 `app.wxss` 不足以完成一致换肤。

## Project Structure

### Documentation (this feature)

```text
specs/003-warm-orange-indigo-theme/
├── spec.md
├── visual-direction.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/theme-token-contract.md
├── checklists/requirements.md
├── tasks.md
└── preview/                         # 独立 HTML 配色预览，不属于生产小程序
    ├── index.html
    ├── build-preview.js
    ├── preview.js
    └── theme.css
```

### Source Code (after approval)

```text
miniprogram/
├── app.json                         # 导航栏、TabBar 主题色
├── app.wxss                         # 全局主题 token 与公共组件颜色
├── pages/
│   ├── route/route.wxss              # 路线首页及点位状态
│   ├── checkin/checkin.wxss          # 扫码状态
│   ├── checkin/checkin.wxss        # 扫码状态与错误提示
│   ├── upload/upload.wxss            # 照片区域与保存状态
│   ├── certificate/certificate.wxss # 页面凭证
│   ├── certificate/certificate.js   # Canvas 凭证颜色
│   ├── records/records.wxss         # 记录与日历状态
│   └── profile/profile.wxss         # 个人中心与徽章
├── components/route-map/             # 地图浮层和 marker 颜色
└── utils/route.js                    # 原生地图 marker 颜色
```

**Structure Decision**: 继续使用现有单一原生小程序结构。主题 token 放在 `app.wxss`，页面只引用语义 token；无法使用 WXSS token 的地图 JS、Canvas JS 和 JSON 配置使用同一份明确的颜色映射表，业务 JavaScript 不改。

## Design Decisions

1. **暖米白底色**：使用 `#FFF8F0` 替代冷绿灰页面底色，保留白色卡片表面和现有层级。
2. **橙色品牌、靛蓝操作**：活动主卡和能量表达使用橙色，主按钮和稳定性较高的操作使用靛蓝，避免所有高亮都挤在橙色上。
3. **状态语义固定**：黄色表示当前/提醒，深靛蓝表示完成，珊瑚表示错误/危险，禁用使用中性灰。
4. **结构最小化**：不新增卡片、不重排页面、不更换插画，只重映射现有颜色和少量透明阴影。
5. **无绿色运行时 token**：删除或替换 `green`、`mint`、`lime` 语义 token；地图底图本身不纳入自有 UI 颜色清理范围。

## Complexity Tracking

无宪法偏离，无新增复杂度。

## Post-Design Constitution Check

- Theme-only scope remains explicit: PASS.
- Existing local-only data and platform boundaries remain unchanged: PASS.
- All design outputs are reversible and require owner approval before source edits: PASS.
