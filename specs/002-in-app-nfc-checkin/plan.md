# Implementation Plan: 全平台二维码打卡

**Branch**: `002-in-app-nfc-checkin` | **Updated**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

把原先的 NFC 混合方案收敛为一个平台无关的扫码入口。路线页仍只负责打开当前点位打卡页；打卡页读取本地当前进度，用户点击 `扫码打卡` 后调用 `wx.scanCode`，使用发布包内的 QR 清单做精确匹配。成功结果直接进入照片上传，继续现有本地点位和完赛流程。

## Technical Context

**Language**: Native WeChat mini-program JavaScript

**Runtime dependencies**: `wx.scanCode`, `utils/qr-validation.js`, `utils/qr-tags.js`, `utils/progress.js`, and `utils/stations.js`

**Storage**: Existing device-local `wx` storage

**Platforms**: Android, HarmonyOS, and iOS share the same QR path

**Constraints**: No backend, no platform detection, no NFC API, no automatic launch, static QR values are replayable

## Architecture

1. The route page opens `pages/checkin/checkin` without point or security-sensitive query parameters.
2. The check-in page reads `progress.completed` as the expected station and renders one QR action.
3. `wx.scanCode` returns a plain-text result. `qr-validation.js` requires the exact `HRQ1` shape, one enabled inventory match, and the current station.
4. The accepted result is stored as `LOCAL_QR_MATCH`; the token is never persisted.
5. Attempt IDs, `qrScanActive`, unload guards, and the accepted flag prevent duplicate or late transitions.

## QR Payload

```text
HRQ1|001|QR-001-A|<token>
```

The QR is plain text and does not open the mini-program from WeChat home scanning. It is scanned from inside the mini-program.

## Source Changes

- `miniprogram/pages/checkin/checkin.js`: remove platform/NFC branches; retain one lifecycle-safe QR flow.
- `miniprogram/pages/checkin/checkin.wxml`: render one `扫码打卡` action.
- `miniprogram/pages/upload/upload.wxml`, `profile.js`, `records.wxml`, `route.wxml`: update user-facing QR/photo wording.
- `miniprogram/utils/progress.js`: make new check-ins QR-only and keep existing local workflow.
- `miniprogram/utils/qr-tags.js`, `qr-validation.js`: retain QR inventory and strict validation.
- `tests/run-tests.js`: remove NFC/platform tests and assert no runtime NFC dependency.
- `README.md` and active Spec Kit artifacts: document QR-only preparation and release checks.

## Verification

Run the bundled Node test harness, then test the latest experience build on representative Android, HarmonyOS, and iOS devices. Check current-point success, wrong-point rejection, malformed/ordinary URL rejection, cancel, camera permission denial, native scanner return, offline behavior, and the existing photo/certificate flow.

## Decision Record

The three NTAG215 UIDs remain in the historical provisioning manifest for traceability. They are not application configuration and do not participate in runtime validation. This removes all platform capability uncertainty from the user-facing check-in path at the cost of requiring a printed QR at each point.
