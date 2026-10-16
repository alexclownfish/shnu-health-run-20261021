# Implementation Plan: 二维码使用提示

**Branch**: `theme/warm-orange-indigo` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

## Summary

在现有扫码流程上增加固定中文提示，兼容旧单行码；生成新图片、逐张解码，并更新现场制作说明。

## Technical Context

- 原生小程序JavaScript，现有wx.scanCode和本机storage。
- qr-tags.js导出QR_USAGE_HINT、新payload与legacyPayload，所有五项身份保持原值。
- qr-validation.js规范化CRLF，仅拆除固定前缀，然后严格解析和匹配legacyPayload。
- 开发工具依赖qrcode@1.5.4、jsqr@1.4.0、pngjs@7.0.0，使用pnpm锁文件。
- 现有Node测试加真实PNG解码、五点新旧码、恶意包装和页面扫码回归。
- 不新增运行时请求、云函数或数据库变更。

## Constitution Check

- 平台真实性：沿用现有API；外部显示行为和现场三平台验收单独记录。
- 权威边界：本地精确匹配公开、可复制的活动码，完赛摘要规则保持原样。
- 失败关闭：只接受完整约定格式、唯一登记、当前点位。
- 可测试：规格要求纯逻辑与实际PNG解码测试。
- 最小交付：本地格式修改，用户已批准方案及实施；没有新增硬件能力或待确认的资质。
- 设计完成后二次检查通过，无需例外。

## Project Structure

```text
miniprogram/utils/qr-tags.js
miniprogram/utils/qr-validation.js
tools/generate-qr-tags.js
assets/qr-checkpoints/                # 五张PNG和对应原文
tests/run-tests.js
tests/qr-image-tests.js
specs/008-qr-usage-guidance/           # 规格、设计、任务与发布指引
specs/004-start-finish-qr-timing/qr-payloads.md
```

## Verification & Release

先复现新格式不能识别，再修改解析规则。生成后用独立解码器核对五张PNG，验证10种新旧点位身份与换行、错误点位和额外内容；执行现有全部回归。先上传支持新格式的小程序，再替换现场标牌。旧二维码仍可在新版中使用。

固定environmentId=cloud1-d1g886bht0f7cbf69、activityId=health-run-2026-event02、routeVersion=route-20261011-v1、routeId=route-20261011。云函数submitCompletion和ACTIVITY_CONFIG无需更改或重新部署。
