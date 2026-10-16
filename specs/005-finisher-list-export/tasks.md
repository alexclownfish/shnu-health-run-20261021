# Tasks: 完赛人员名单 MVP

**Input**: spec.md、plan.md、research.md、data-model.md、contracts/。
**Scope**: 用户批准本地 MVP；实际环境配置、部署与真机验收另列上线项。

## Phase 1: Setup

- [X] T001 核实 SDK 官方用法与测试数据边界，更新 specs/005-finisher-list-export/research.md。
- [X] T002 配置 cloudfunctionRoot、依赖及本地导出忽略规则于 project.config.json、package.json、.gitignore。

## Phase 2: Foundation

- [X] T003 增加默认关闭的双环境活动配置于 miniprogram/utils/config.js，开发/体验共用测试环境，正式使用另一环境。
- [X] T004 增加云端活动校验、窗口和排除开发账号规则于 cloudfunctions/submitCompletion/policy.js。

## Phase 3: US1 完赛摘要

Goal: 只有绑定新活动的终点成功才上报。
Independent test: 两账号完赛、重复提交和开发账号排除均符合名单口径。

- [X] T005 [US1] 为起点绑定 frozen reportingContext，更新 miniprogram/utils/progress.js 和 pages/checkin/checkin.js。
- [X] T006 [US1] 实现可信身份与原子重复保护于 cloudfunctions/submitCompletion/index.js、service.js。
- [X] T007 [US1] 增加摘要结构及环境/时间拒绝测试于 tests/completion-tests.js。

## Phase 4: US2 管理员导出

Goal: 管理员电脑按需取得无开发测试数据的 .xlsx。
Independent test: 跨页、重复、错误活动、公式昵称均正确，统计排除行。

- [X] T008 [US2] 实现管理员云凭据分页导出工具于 tools/export-finishers/index.js、export.js。
- [X] T009 [US2] 生成与读取样本 .xlsx 验证文本及时间于 tests/completion-tests.js。

## Phase 5: US3 网络恢复

Goal: 上传不阻断凭证，队列跨重进与路线重置保留。
Independent test: 网络失败、响应丢失、切换环境与历史记录无回填。

- [X] T010 [US3] 实现 completion-report.js 本地冻结摘要、隔离队列、限频重试。
- [X] T011 [US3] 接入 app.js 初始化/onShow、终点回调，更新隐私文案。
- [X] T012 [US3] 增加生命周期与离线重试测试于 tests/completion-tests.js，调整 tests/run-tests.js 的旧纯前端断言。

## Phase 6: Validation and Handoff

- [X] T013 完成部署/权限/索引/导出操作说明于 specs/005-finisher-list-export/deployment.md、quickstart.md、README.md。
- [X] T014 本地所有测试与差异检查，通过后更新本 tasks.md。
- [ ] T015 验证开发环境客户端权限、真机补报与 Excel 云读取；用户已通过体验版测试确认摘要写入 finishers，剩余项仍待实际验收。
- [X] T016 按本轮要求增加 test/production 独立启用开关，启用开发/体验，验证正式版不能初始化或上报。
- [X] T017 填好开发测试窗口与补交期限，补充 development-setup.md 完整 JSON、部署和重复测试步骤。
- [ ] T018 正式活动参数、排除账号、正式云部署与三平台验收（用户明确延后）。
- [X] T019 针对用户导出失败增加安全的失败阶段/错误码提示、输出文件预检查、明确凭据优先级及回归测试。
- [X] T020 增加 --input 本地 JSON/JSON Lines 转换与 export-test.sh，无需 npm/密钥，保留异常、重复过滤和来源说明，完成端到端 XLSX 读回测试。

## Dependencies and Parallel Opportunities

T001-T004 先完成；US1 与 US3 集成连续执行。云端 policy 与管理员 export 在契约固定后可独立开发。
MVP 包括三个故事；T015 是本轮开发云部署验收，不能以模拟测试替代。T018 正式环境由用户要求延后。

## Local Validation

2026-10-09：现有 29 项 + 名单 39 项，共 68 项通过；新服务/导出代码语法与 shell 检查通过，git diff --check 通过。
使用本机提供的 Node.js 及 pnpm 执行 package.json 两份测试脚本；pnpm 关闭了运行前自动重装依赖。当前工具运行环境没有 npm，未通过 npm 启动测试。
导出 --help 检查通过；SDK 实际凭据、集合权限与真实云端分页待 T015。

## Environment Configuration

用户提供开发环境 cloud1-d1g886bht0f7cbf69、正式环境 shnu-health-run-20261021-dc2d3ff，已填写 miniprogram/utils/config.js 与对应 ACTIVITY_CONFIG 模板。
测试与正式目标均已配置，活动窗口为 2026-10-09 00:00 至 2026-11-09 00:00，补交至 2026-11-10 00:00（Asia/Shanghai）；正式云端部署和发布验收仍待执行。
官方 CLI 的 islogin 检查返回 IDE service port disabled，电脑控制工具返回权限未授予，因此尚未部署云函数或验收 T015；没有管理员凭据可用于直接云访问。未创建集合、修改云权限或触碰正式环境。

新环境配置已写入代码，但本代理未直接部署或验收云函数；T015 的权限、补报、导出验收仍未完成。
用户电脑导出返回旧版通用错误；修复本地工具后需在用户持有管理员凭据的终端重跑以取得错误码。当前代理执行环境没有凭据，未对真实数据库发起读取或生成正式云数据 Excel。
用户重跑得到 INVALID_ENV。新增控制台完整 JSON 到 Excel 的本地 shell 路径；其无云 SDK、无凭据转换已经使用合法样本实测，但用户真实控制台文件尚未提供，T015 的实际名单转换仍待操作验证。
