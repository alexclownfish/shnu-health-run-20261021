# Tasks: 最新 KMZ 路线实施

**Date**: 2026-10-11
**Input**: spec.md、plan.md、latest-route-review.md

## Setup

- [x] T001 核验 KMZ、补充需求和原进度边界，记录于 specs/007-route-maintenance/plan.md。
- [x] T002 保存源 KMZ 到 specs/007-route-maintenance/source/route-20261011.kmz，生成 miniprogram/utils/route-20261011.js。

## US1: 新路线地图 (P1)

**Independent Test**: 完整轨迹、分段、五点原坐标转换正确，距离和照片打卡点一致。

- [x] T003 [US1] 更新 miniprogram/utils/route.js 和 components/route-map/route-map.js，按两段绘图，使用标注精确坐标和正确顺序。
- [x] T004 [US1] 更新 miniprogram/utils/stations.js 位置与距离，保持三个照片打卡点，路线首页使用共享总里程。
- [x] T005 [US1] 更新 specs/003-warm-orange-indigo-theme/preview/build-preview.js 和 preview.js，共享分段和点位资料后重建 index.html。
- [x] T006 [US1] 更新 tests/run-tests.js 路线断言并新增原坐标、分段和里程检查。

## US2: 旧记录隔离 (P1)

**Independent Test**: 旧进度不算入新路线且保持原样；新活动不重标旧上报。

- [x] T007 [US2] 更新 miniprogram/utils/progress.js 和 app.js，使用路线独立存储与统一 routeId，增加 tests/run-tests.js 旧数据保留回归。
- [x] T008 [US2] 更新 miniprogram/utils/config.js 与 cloudfunctions/submitCompletion/activity.example.json 的新开发目标，同步测试/正式配置；验证 tests/completion-tests.js。

## Verification

- [x] T009 更新 README.md、specs/007-route-maintenance/data-model.md 和 quickstart.md 的实际替换结果及开发环境部署步骤。
- [x] T010 跑业务与云汇总/导出测试，核对 KMZ 与 JSON 一致、二维码未变化并检查 diff；记录到 specs/007-route-maintenance/tasks.md。

## Execution

T001 → T002 → T003/T004 → T005/T006 → T007/T008 → T009/T010。共10项：地图4项、旧数据2项、准备2项、核验2项。T003 与 T004 分属不同文件但共享资料，因此先完成数据再处理。MVP 是新地图；本轮同时完成旧进度隔离。不执行正式部署或仓库推送。

## Release Validation

体验版核对地图落位、S/F 标签、现场扫码顺序和开发云新配置；不以自动测试替代现场验收。

## 本地验证结果（2026-10-11）

- T001–T010全部完成。requirements.md为6/6通过，未改变需求检查状态。
- tests/run-tests.js：31项通过，覆盖小程序结构、轨迹/标记、扫码顺序、照片上传、起终点计时及旧记录保留。
- tests/completion-tests.js：39项通过，覆盖新开发模板与客户端一致、旧摘要目标隔离、云校验/名单去重、过滤与真实Excel生成。
- 独立源数据审计：归档与用户源KMZ字节哈希一致；全部357坐标、分段[0,67]、三站精确标注、分段累计距离、源Distance及KML哈希一致。
- 生成H5数据与小程序一致；Canvas调用检查验证620×380、360×240及0–3进度下的67/290点独立路径、五个标记和标签在画布内。此检查不是浏览器截图或真机验收。
- 二维码配置与HEAD一致；JavaScript语法与git diff --check通过。
- 未发布小程序、未推送仓库、未更改云端ACTIVITY_CONFIG。真实地图落位、S/F标签效果、现场扫码及开发云新活动仍按quickstart.md验收。

## 白屏修复跟进

- [x] T011 根据开发者工具日志复现JSON require被解析为.json.js的启动失败；将原数据完整移至JavaScript导出模块，并同步维护文档。
- [x] T012 新增JS-only模块加载回归，修复前复现同一缺失模块错误，修复后验证App启动及路线首页初始化；移除凭证页日志中两个无效配置项。
- [x] T013 重新运行小程序32项与汇总/导出39项，共71项通过；H5重建，路线数据与源KMZ再次核对一致。

未使用开发者工具实际渲染自动验收：电脑控制权限未就绪。以用户提供的错误日志定位，本地受限加载器回归通过；用户需重新编译查看模拟器页面。

## 完赛上报补发修复

- [x] T014 将ACTIVITY_NOT_ALLOWED视为活动配置错位的可重试错误；云配置修正后，已保存的冻结完赛摘要可在下次前台进入时补发。
- [x] T015 增加配置错位→等待→成功补发回归测试；不改变生产关闭开关和云端校验规则。

## 参与者编号补发核验（2026-10-12）

- [x] T016 核验云端 accepted/alreadyAccepted 均返回 participantId，客户端保存编号，终点上报后及凭证重新打开时刷新显示。
- [x] T017 覆盖成功响应缺少编号时保留待上传记录及后续补回编号；更新并发、配置恢复测试的成功响应，符合编号返回约定。
- [x] T018 补充 quickstart.md 的固定配置与双端更新步骤；小程序32项、上报/导出44项全部通过，git diff --check通过。

用户提供的 ACTIVITY_CONFIG 与开发模板一致，本轮未修改配置标识、二维码或正式开关。未操作云部署或上传体验版；手机编号显示仍待最新双端版本验收。

## 编号显示时序修复（2026-10-12）

- [x] T019 根据数据库截图确认该记录已入库且有 participantId；复现后台上报正在进行时，凭证页第二次调用提前返回、刷新早于编号保存的问题。
- [x] T020 将并发上报调用改为等待同一请求完成，不重复发送；保留新入队记录与原重试策略。
- [x] T021 增加实际凭证页面脚本回归：App先上报、页面随后打开、alreadyAccepted返回编号后自动刷新。小程序32项、上报/导出45项通过。

本轮仅修改客户端上报等待逻辑及测试/文档，不改云函数、ACTIVITY_CONFIG或固定标识。需要重新上传体验版；若上轮返回编号的云函数已部署，本轮不需要再部署。截图证明数据库中存在编号，但不能证明线上云函数已返回该字段；真机验收仍待执行。

## 参与者编号位置调整（2026-10-12）

- [x] T022 按用户标注将编号从凭证标题区移至完成时间/总用时下方的分隔线之后，替换底部英文状态；同步小程序页面、保存图片和H5预览并重建index.html。
- 验证：小程序32项、上报/导出45项通过，git diff --check通过。浏览器工具因本地file协议限制未能进行截图验收；页面视觉与真机效果待查看。
- 本次为UI调整，云函数和环境变量均无需更新；手机体验版需重新上传。
