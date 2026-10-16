# Visual Direction: Warm Orange / Indigo

## 1. Design Positioning

关键词：暖阳、行动感、轻运动、可靠、可读。

整体从“绿色健康工具”转为“橙色活动品牌 + 靛蓝行动系统”。暖米白负责承载内容，橙色负责表达活动和能量，靛蓝负责主要操作与稳定感，珊瑚和黄色负责错误、提醒与点位区分。

参考图中保留的气质：

- 暖米白大背景和白色内容面
- 橙色到亮橙色的活动主卡
- 靛蓝色底部主按钮和扫码主体
- 黄色、粉色、珊瑚色的点位和状态区分
- 细边框、少量圆角、轻阴影，不增加新的卡片层级

## 2. Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--ink` | `#2B2330` | 主文字、插画描边、深色数字 |
| `--deep` | `#3F4B9F` | 深靛蓝、深色主卡、已完成状态 |
| `--primary` | `#5664C2` | 主按钮、主操作、当前焦点 |
| `--orange` | `#F76B2B` | 活动主视觉、主要强调、能量表达 |
| `--orange-bright` | `#FF922E` | 高亮橙、渐变替代色、装饰几何 |
| `--yellow` | `#FFD34E` | 当前点位、提醒、进度亮点 |
| `--coral` | `#F15B68` | 错误、第三点位、危险提醒 |
| `--lavender` | `#E9EBFF` | 靛蓝浅背景、扫码区域、辅助底色 |
| `--peach` | `#FFF0E4` | 暖橙浅背景、安全提示、照片区域 |
| `--paper` | `#FFF8F0` | 页面背景、导航栏背景 |
| `--white` | `#FFFFFF` | 卡片和弹层表面 |
| `--line` | `#F0D9C8` | 边框、分隔线 |
| `--muted` | `#887983` | 次要文字、说明文本 |
| `--disabled` | `#D9D5D7` | 禁用背景或不可操作状态 |

### Semantic Rules

- 主按钮固定使用 `--primary`，不使用橙色作为所有按钮的唯一颜色。
- 活动主卡使用 `--orange`，必要时使用 `--orange-bright` 做现有装饰层，不改变结构。
- 完成状态优先使用 `--deep` 或 `--yellow`，错误状态固定使用 `--coral`。
- 点位 1 使用 `--yellow`，点位 2 使用 `--primary`，点位 3 使用 `--coral`；已完成状态统一叠加 `--deep`。
- 浅色表面上的正文必须使用 `--ink` 或 `--muted`，不使用橙色、黄色作为长段正文。
- 主题中不定义 `--green`、`--mint`、`--lime` 作为运行时语义 token；旧 token 必须被替换或删除。

## 3. Page Application

| Area | Main surface | Primary emphasis | State accents |
| --- | --- | --- | --- |
| 路线首页 | `--paper` + `--white` | `--orange` challenge card, `--primary` CTA | yellow/current, deep/done, coral/third point |
| 扫码打卡 | `--paper` + `--lavender` reader | `--primary` scanner phone | deep/success, coral/error, yellow active |
| 扫码打卡 | `--paper` + `--peach` reader card | `--deep` header, `--primary` CTA | coral error |
| 照片上传 | `--paper` + `--peach` photo stage | `--orange` illustration, `--primary` CTA | yellow selection, deep saved |
| 运动记录 | `--paper` + `--white` | `--deep` summary card | orange energy, yellow active day |
| 个人中心 | `--paper` + `--white` | `--deep` profile hero | yellow/orange badges, coral warning |
| 完赛凭证 | `--paper` + `--white` | `--orange` certificate top, `--primary` CTA | deep completion, yellow station dots |

## 4. What Does Not Change

- 页面结构、组件层级、布局尺寸、文案、字体层级和圆角原则不因换肤重做。
- 扫码、点位校验、路线顺序、照片保存和 Canvas 生成逻辑不变。
- 地图坐标、路线折线、点位点击事件和本地进度数据不变。
- 不新增图片资源作为第一版主题的前置条件。

## 5. Review Checklist

- 首屏是否一眼看到橙色活动主视觉和靛蓝主操作？
- 绿色是否从页面自有色彩、地图自有标记、Canvas 和导航配置中清除？
- 成功、错误、锁定、禁用是否可以在不依靠颜色的情况下通过图形、文案或状态结构识别？
- 参考图的暖米白是否在小程序页面、原生导航栏、底部 TabBar 和保存凭证中保持一致？
- 真机浅色模式与开发者工具预览是否没有白字低对比、底部按钮被遮挡和状态误读？
