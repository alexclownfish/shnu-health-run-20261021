# Implementation Plan: 管理员完赛名单 MVP

**Branch**: `theme/warm-orange-indigo` | **Date**: 2026-10-09
**Spec**: [spec.md](spec.md)
**Status**: 本地实现与自动验证完成；真实环境部署、权限和真机验收待完成。

## Summary

保留本地扫码、照片与凭证，在成功终点记录后冻结并上报最小完赛摘要。
一个 `submitCompletion` 云函数分别部署到测试、正式两个云环境，写入各自集合。
管理员电脑可凭云账号权限直接读库，或使用已授权控制台导出的 JSON 在本地转换为 `.xlsx`，不增加小程序管理页面。
这是少量云端后端和数据库，不再是完全纯前端；但本地打卡不等待网络。
开发环境 cloud1-d1g886bht0f7cbf69 与正式环境 shnu-health-run-20261021-dc2d3ff 已填入客户端及服务模板；测试与正式活动均使用 health-run-2026-event02，正式配置需在发布前确认排除账号。活动窗口为 2026-10-09 至 2026-11-09，补交至 11-10（Asia/Shanghai）。

## Technical Context

- 原生微信小程序 JavaScript、现有本地 storage；服务与管理员工具 Node.js。
- 云函数 `wx-server-sdk@3.0.4`；管理员 `@cloudbase/node-sdk@3.18.3`、`exceljs@4.4.0`。
- 测试环境 `finishers`，正式环境 `finishers`，活动配置为云函数环境变量 `ACTIVITY_CONFIG`。
- 独立本地 outbox 保留未提交摘要，路线重置不清空；照片不上传。
- 自动测试：现有 29 项 + 名单 39 项，包括 XLSX 读回、开发独立启用、安全错误诊断、JSON Lines 转换与无凭据 shell 端到端测试。
- 不提供排名、实名、可信到场、防作弊、跨设备进度恢复或活动管理后台。
- 人员规模、环境资格、费用、配额由实际云账号确认，本次没有创建云资源。

## Constitution Check

本地手机时间与路线仍是自报来源。服务端身份来自 `getWXContext`，忽略客户端 openid；只收昵称和摘要。
参赛者不能直接读写集合，导出权限属于管理员云账号。SDK 契约引用第一方文档，模拟测试不替代云权限和真机验证。
用户已批准 MVP；本地可部署交付不等于真实活动已上线。

## Dirty Data Controls

1. develop/trial 固定走测试环境；release 固定走正式环境。两环境都必须填写且不能相同。
   各目标 enabled 必须明确为 true 才可初始化或发送；总开关开启不代表正式目标开启。
2. 云端独立限制真实 ENV、APPID、可信 OPENID、调用 SOURCE、活动 ID、路线版本、点位顺序和时间窗口。
3. 正式环境仅接受 wx_client 来源；测试允许 wx_client/wx_devtools。本地云函数调试 ENV=local 不接收。
4. 正式配置必须包含开发账号排除名单；开发账号即使使用正式版也不会入表。
5. 起点冻结活动上下文；旧凭证无上下文不补录，测试进度升级正式版不能重新标为正式活动。
6. 正式导出默认只读正式集合，重新校验活动、环境、版本、结构、时间与身份，异常行排除并计数。
7. 配置未准备好保持关闭；最终导出在补交截止至少一分钟后，进行中只能显式 `--preview`。

官方上下文没有可信 envVersion，客户端版本属于防误操作路由，不是防伪凭据。
普通账号在正式时间内用正式版完成测试不能自动识别，必须加入排除名单；复制二维码/改手机时间也不能由此 MVP 防止。

## Flow and Consistency

起点绑定环境/活动 -> 本地完成三个任务点 -> 终点冻结摘要进入 outbox -> 非阻塞调用云函数。
客户端在终点、启动、回到前台尝试发送，失败限频退避；关闭小程序后不承诺后台上传。
服务计算 `durationMs`，以 SHA256(activityId, OPENID) 为 `_id` 原子 add；重复返回首条，不覆盖时间和昵称。
待发送只进入其冻结环境/活动，变更活动后旧项保留，不自动迁移。成功删除队列项；永久错误保留 blocked，开发账号排除项丢弃。
导出通过 `_id` 游标分页（100 行/页），按接收截止过滤，最后按完成时间整理，无排名。
`--input` 本地模式不加载云 SDK、不取凭据；解析控制台 JSON/JSON Lines 后应用同一 stored-record 校验与重复过滤，工作簿注明文件来源。读取所有文件行，无云端分页限制；坏 JSON 直接停止。
进行中查询不是事务快照，不能保证仍在写入的行已可见；关闭窗口后等待至少一分钟降低在途写入影响，禁止同时人工补写。

## Source and Documents

```text
miniprogram/utils/completion-report.js   # 冻结摘要、环境路由、队列
miniprogram/utils/config.js              # 总开关、独立目标开关、双环境配置
miniprogram/utils/progress.js            # 起点上下文
miniprogram/pages/checkin/checkin.js      # 成功终点触发
miniprogram/app.js                       # 启动、前台补报
cloudfunctions/submitCompletion/         # policy / service / index / 示例配置 / 权限规则
tools/export-finishers/                  # 管理员读取、XLSX
  local.js / export-test.sh             # 控制台 JSON 本地转换
tests/completion-tests.js                # 服务、离线、环境与导出验证
specs/005-finisher-list-export/          # spec / plan / research / model / contracts / tasks / deployment
```

## Deployment Gate

当前按 [development-setup.md](development-setup.md) 联调开发环境。用户已确认体验版写入 finishers；本代理受官方 CLI 服务端口与电脑控制权限限制未执行部署。客户端权限、管理员凭据和 Excel 云读取仍待验证。
正式部署延后，再按 [deployment.md](deployment.md) 验证正式环境。
先用体验版在测试环境验证，然后发布正式版。提供真实活动时间、开发账号排除名单与保留期限。
每次活动/路线变更冻结一份新配置；活动期间不要修改 title、点位清单或版本，避免使既有记录失效。
Android/HarmonyOS/iOS 真机、数据库读取拒绝、云端并发去重、管理员分页查询均属于 T015 线上验收。
