# Tasks: 二维码使用提示

**Input**: spec.md、plan.md、research.md、data-model.md、contracts/qr-content.md

## Phase 1: Setup

- [x] T001 核验现有扫码与清单，记录授权范围及外部软件限制到specs/008-qr-usage-guidance/spec.md和research.md。

## Phase 2: Foundational

- [x] T002 在package.json及pnpm-lock.yaml增加电脑端生成/解码依赖。

## Phase 3: US1 外部使用提示 (P1)

**Independent Test**: 独立解码五张PNG，确认指定提示及原点位数据。

- [x] T003 [US1] 在miniprogram/utils/qr-tags.js定义固定提示、legacyPayload及新版payload，保留五点原身份。
- [x] T004 [US1] 实现tools/generate-qr-tags.js生成assets/qr-checkpoints/五张PNG和原文，更新specs/004-start-finish-qr-timing/qr-payloads.md。
- [x] T005 [US1] 新建tests/qr-image-tests.js，逐张独立解码实际PNG并核对UTF-8和点位对应关系。

## Phase 4: US2 新旧码兼容 (P1)

**Independent Test**: 五点新旧格式、LF/CRLF、错误点位及额外内容的成功/拒绝符合原流程。

- [x] T006 [US2] 先在tests/run-tests.js复现带提示格式不支持，覆盖新旧码、CRLF及严格格式边界。
- [x] T007 [US2] 更新miniprogram/utils/qr-validation.js，只移除完整固定提示，再精确匹配legacyPayload。
- [x] T008 [US2] 验证tests/run-tests.js的页面生命周期、起终点计时，以及tests/completion-tests.js的完赛上报不受影响。

## Phase 5: Polish

- [x] T009 更新README.md、specs/002-in-app-nfc-checkin/spec.md与quickstart.md、specs/004-start-finish-qr-timing/quickstart.md和specs/007-route-maintenance/quickstart.md，解释新版制作及先更新小程序再换码。
- [x] T010 执行npm test及git diff --check，记录结果到specs/008-qr-usage-guidance/tasks.md并提供五张新码打包下载。

## Dependencies & Parallel Opportunities

T001→T002；T006在修改解析前复现。T003→T004→T005；T003→T007→T008。T009在格式确定后可以与生成工具工作并行，T010最后完成。

## Implementation Strategy

最小交付为本地新旧码兼容加五张新图片，一次完成两故事，不在US1后发布不兼容码。不操作云端、不变更固定活动标识，现场与外部软件展示由新版体验版验收。

## Validation Results（2026-10-13）

- 规格质量清单16/16通过。T001-T010完成，无扩展hook。
- 修复前，指定提示加原数据返回QR_INVALID；新增测试在实现前复现失败。
- npm test：小程序34项、上报/导出45项、实际图片及生成器2项，共81项通过。
- 五张交付PNG和临时重新生成的五张PNG均独立解码正确；UTF-8提示、换行、五项原身份与配套文本一致。任务点1图片视觉核查黑白码区和完整白边。
- 五个预期点位与五个输入点位在新LF、新CRLF和旧单行三种格式下全部通过匹配/拒绝检查；错误提示、未知token、禁用、重复及拼接输入拒绝。
- 图片和UTF-8原文打包为exports/悠湃体育-打卡二维码.zip，中文文件名已核对。exports为本地交付目录，生成的原文件位于assets/qr-checkpoints/。
- JavaScript语法及git diff --check通过；未部署云函数、未上传体验版。真机现场读码和各外部扫码软件的展示仍待组织者验收。
