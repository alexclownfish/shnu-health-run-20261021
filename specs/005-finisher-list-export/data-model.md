# Data Model: 完赛名单 MVP

## Activity Configuration

ACTIVITY_CONFIG 是每个云环境中 submitCompletion 的 JSON 环境变量，不是客户端提交值。

| Field | Rule |
| --- | --- |
| enabled | 必须为 true 才接收 |
| mode / environmentId / appId | test 或 production；真实云环境与小程序身份必须一致 |
| activityId / title / routeVersion | 活动独立 ID、名称、冻结版本；ID 与版本为 1–80 位字母数字下划线短横线 |
| requiredPoints | 有序且不重复的三位数字任务点；当前 001、002、003 |
| startPointCode / finishPointCode | 不在任务列表内、互不相同；当前 000、999 |
| startsAt / endsAt | 毫秒整数；客户端起止时间必须在此范围内 |
| reportingClosesAt | 不早于 endsAt；按服务端接收时间限制补交 |
| excludedOpenIds | 开发/测试账号；production 必须至少一项 |
| timeZone | 导出时区，默认 Asia/Shanghai |

配置与管理员本地 .local.json 保持一致，活动期间冻结。保留期限由组织者另外确定并在到期后删除，没有自动清理任务。

## Cloud Records

测试环境 finishers，正式环境 finishers。集合客户端 read/write 均为 false。

| Field | Source / Rule |
| --- | --- |
| _id | SHA256(JSON.stringify([activityId, trusted OPENID])) |
| schemaVersion / mode / environmentId | 固定 1 / 服务器配置 |
| ownerOpenId | 服务器调用上下文；不输出到 Excel |
| participantId | _id 前 16 位，为名单编号，不是实名 |
| activityId / title / routeVersion | 部署配置与客户端活动匹配 |
| nickName | 完赛时快照，去边缘空格，最多 80 字符，可为空 |
| clientEnvVersion | 客户端声明；正式 release，测试 develop/trial；非可信防伪凭据 |
| startedAt / completedAt | 手机毫秒时间，结束不早于开始、不超过接收时间 30 秒 |
| durationMs | 服务器计算时间差，不信任独立上传的 duration |
| completedPointCodes | 与 requiredPoints 顺序及长度完全一致 |
| startPointCode / finishPointCode | 与冻结配置一致 |
| receivedAt | 服务器首次处理并保存该记录时的时间，区别于手机完成时间 |
| assurance | CLIENT_REPORTED_COMPLETION，明确为自报摘要 |

不保存头像、照片、二维码 token、扫码原文、设备平台。相同活动/账号只能原子新增首条，后续不覆盖。

## Local Context and Outbox

客户端 completionReporting.enabled 是总开关，targets.test.enabled / targets.production.enabled 独立决定目标是否允许上报；缺失、false 均关闭。当前 test=false、production=true，正式版路由到正式云环境。
关闭目标时不捕获新上下文、不初始化云环境，也不补发该目标已排队记录。两个目标的环境 ID 仍须不同。

起点 `progress.reportingContext`：mode、envId、activityId、routeVersion、clientEnvVersion。
历史缓存没有上下文则不自动绑定当前活动。开始时关闭上报则此次进度不事后补录。

独立 storage key：`health-run-completion-outbox-v1`。每项包含 key、target、status、attempts、nextAttemptAt、payload、最近 reasonCode。
key 由环境、活动、路线和 startedAt 构成；摘要只在成功终点排队，昵称和时间冻结。
status 只有 pending、blocked；发送期间为内存互斥，不把 submitting 持久化，因此进程退出不会卡住。
成功 accepted/alreadyAccepted 删除项，EXCLUDED_DEVELOPER 也删除；服务/配置临时错误保持 pending 并退避；其余错误保留 blocked。
路线上重置不清空 outbox。切换活动/正式版本不会迁移旧项；清除全部 storage 仍可能丢失待交记录。

## Excel

11 列：序号、活动名称、活动编号、路线版本、参与者编号、微信昵称、起点时间、完成时间、总用时、完成任务点数量、接收时间。
按完成时间排序，序号为表格行号，不是排名。时间按活动时区展示，总用时 HH:mm:ss 文本可超过 24 小时。
新完赛摘要必须来自本机已填写头像和非空昵称的资料；头像不随摘要上传。云函数和导出校验拒绝空白昵称，旧空白昵称记录按异常排除，不自动改写。昵称等外部内容是字符串单元格，不生成公式。
第二页“导出说明”包含环境、活动、版本、导出类型、有效/检查/异常数量、截止时间、时区和自报口径。
