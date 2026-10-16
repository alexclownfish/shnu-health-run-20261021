# Feature Specification: 全平台二维码打卡

**Feature Branch**: `002-in-app-nfc-checkin`

**Created**: 2026-09-26

**Updated**: 2026-09-30

**Status**: Implemented for QR-only flow

**Input**: 用户先手动打开小程序打卡页，再扫描点位二维码完成打卡。所有设备走同一流程，不区分 Android、HarmonyOS 和 iOS，不使用 NFC 感应、UID、NDEF 文本或平台判断。

**Supersedes**: `specs/001-nfc-checkin-validation` 及本目录早期的 Android/HarmonyOS NFC、iOS QR 混合方案。旧文件保留用于追溯。

**2026-10-13 extension**: 最新制作格式见[二维码使用提示](../008-qr-usage-guidance/spec.md)。在原HRQ1数据前加入固定“悠湃体育”使用提示，新版仍兼容单行旧码；下文原始格式是校验的数据行。本次不改点位身份和原打卡业务。

## User Scenarios & Testing

### User Story 1: 当前点位扫码

用户从路线页打开当前待完成点位，点击 `扫码打卡`，扫描现场二维码。只有二维码内容与当前本地点位及发布包清单精确匹配时，才进入照片上传页。

**Acceptance scenarios**:

1. 当前点位二维码匹配时，写入一次 `LOCAL_QR_MATCH` 并进入照片上传页。
2. 其他点位、普通网址、格式错误、未知或重复配置二维码均拒绝，进度不变化。
3. 页面打开但用户未点击按钮时，不启动相机，也不产生打卡记录。

### User Story 2: 扫码异常恢复

用户取消扫码、拒绝相机权限、扫码失败或从原生扫码页返回时，看到明确状态，可以重新尝试。

**Acceptance scenarios**:

1. 取消、权限拒绝和启动失败显示可恢复错误。
2. 页面临时隐藏后返回的成功回调仍可处理。
3. 页面卸载后的迟到回调被忽略；一次尝试最多产生一次打卡和一次导航。

### User Story 3: 继续本地活动流程

扫码成功后直接进入拍照上传，继续点位顺序、记录和完赛凭证流程。运行时不请求后端、云函数或远程校验服务。

**Acceptance scenarios**:

1. 二维码成功后进入照片上传页并完成照片要求。
2. 清除数据、重装或更换设备不承诺恢复本地进度。
3. 离线情况下，已加载的小程序仍可完成二维码解析和本地流程。

## Requirements

- **FR-001**: 用户 MUST 先进入当前点位打卡页，再通过明确按钮启动 `wx.scanCode`。
- **FR-002**: Android、HarmonyOS、iOS MUST 使用相同的二维码入口和校验规则。
- **FR-003**: 当前 `progress.completed` MUST 是预期点位的唯一来源；二维码不得改变路线顺序。
- **FR-004**: 每个点位二维码 MUST 使用 `HRQ1|<point>|<qr-id>|<token>` 格式，并在发布包中唯一登记。
- **FR-005**: 成功 MUST 同时满足格式有效、精确匹配唯一启用配置、绑定点位等于当前本地点位。
- **FR-006**: 普通网址、旧 NFC 文本、未知、格式错误、错误点位、取消和相机失败 MUST 不改变进度。
- **FR-007**: 运行时 MUST 不调用 `wx.getNFCAdapter`、NFC discovery、UID 校验或平台识别来决定打卡路径。
- **FR-008**: 成功 MUST 以 `LOCAL_QR_MATCH` 写入最小化本地证据，不保存二维码 token。
- **FR-009**: 每次扫码只能产生一个终态、一次本地打卡和一次导航。
- **FR-010**: 方案 MUST 保持纯前端、本机 storage 和低风险单日活动边界，不宣称可信考勤或防复制能力。
- **FR-011**: 普通文本二维码不能自动拉起小程序；用户必须使用小程序内的 `扫码打卡` 按钮。

## QR Inventory

**2026-10-01 extension**: 起終点独立扫码计时的最新规则见 `../004-start-finish-qr-timing/spec.md`。当前清单有五项；下文“三个”是原任务点，不含起終点。

当前五个二维码定义位于 `miniprogram/utils/qr-tags.js`，编号为 `000`（起点）、`001`、`002`、`003`、`999`（终点）。其中三个任务点二维码内容保持原值；二维码内容是公开、可复制的活动标识，只用于本地防误点位和流程控制。起终点计时的详细规格见 `specs/004-start-finish-qr-timing/`。

## Out of Scope

- NFC 感应、NTAG215 UID 或 NDEF 文本打卡。
- Android、HarmonyOS、iOS 的打卡分支或硬件兼容白名单。
- NFC Scheme、AAR、自动拉起微信或小程序。
- 后端、云函数、中央打卡数据库、可信身份和远程撤销。

## Success Criteria

- **SC-001**: 三个平台对当前二维码使用相同页面、按钮、校验结果和后续流程。
- **SC-002**: 自动化测试 100% 拒绝未知、错误点位、普通网址和格式异常二维码。
- **SC-003**: 每次扫码最多写入一次本地打卡和触发一次导航。
- **SC-004**: 现有照片、点位顺序、记录和完赛流程回归测试通过。
- **SC-005**: 最新体验版在 Android、HarmonyOS、iOS 各至少一台代表设备完成当前二维码、错误二维码、取消和相机权限测试。
