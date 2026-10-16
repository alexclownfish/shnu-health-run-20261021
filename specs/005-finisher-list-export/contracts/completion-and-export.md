# Contracts: submitCompletion 与管理员导出

本地代码可部署；用户已验证开发环境体验版摘要写入，导出云读取仍返回 INVALID_ENV，本地文件转换已提供。

## submitCompletion

调用：wx.cloud.callFunction({ name: 'submitCompletion', config: {env: 冻结环境ID}, data: 摘要 })。
入参：activityId、routeVersion、clientEnvVersion、nickName、startedAt、completedAt、completedPointCodes、startPointCode、finishPointCode。
服务端从 getWXContext 取 OPENID/APPID/ENV/SOURCE，不接受客户端指定身份或集合。

接收检查：enabled、合法活动配置、可信账号与环境、来源、开发账号排除、版本、活动/路线/点位完整顺序、时间和补交窗口。
正式只接收 wx_client；测试也允许 wx_devtools，均要求可信 OPENID。本地云函数模拟调用不视为真机请求。
activityId + OPENID 确定 `_id`，原子 add，冲突查询首条，不覆盖首次昵称/时间。

成功：`{ok:true,status:'accepted'|'alreadyAccepted',recordId,receivedAt}`，仅当前账号自己的回执。
失败：`{ok:false,reasonCode}`。

| reasonCode | 客户端处理 |
| --- | --- |
| SERVICE_UNAVAILABLE / REPORTING_DISABLED / CONFIG_INVALID | pending，指数退避，下次启动/前台重试 |
| EXCLUDED_DEVELOPER | 删除待交项，不入名单 |
| IDENTITY_REQUIRED / ENVIRONMENT_NOT_ALLOWED / ACTIVITY_NOT_ALLOWED / BUILD_NOT_ALLOWED / INVALID_PAYLOAD / REPORTING_CLOSED | blocked 留存，待人工排查，不自动高频重试 |

配置失败、断网、blocked 都不阻断本地凭证。无法用摘要证明真实扫码，计时来自手机。

## Admin Export CLI

`npm run export:finishers -- --config production.local.json --output exports/finishers.xlsx`

- config：与云端冻结活动配置一致；凭据只从电脑环境变量提供。
- output：.xlsx，新文件，已存在则拒绝覆盖。
- `--cutoff`：可选 ISO 接收截止时间，默认导出启动时刻，不接受未来时间。
- `--preview`：允许补交窗口未关闭时的阶段性预览，非完整事务快照。
- `--include-test`：只允许测试配置；正式导出不能带此参数。
- `--help`：用法，不访问云资源。
- `--input`：可选本地 JSON/JSONL/NDJSON 文件；指定后不访问云端、不读取管理员凭据，也不加载云访问 SDK。

管理员凭据：TENCENTCLOUD_SECRETID/SECRETKEY，可附 SESSIONTOKEN；或服务端 CLOUDBASE_APIKEY。不能使用可公开客户端 key。
默认正式导出要求补交期限过后至少一分钟。私有集合中按 activityId 和 receivedAt <= cutoff 查询，以 `_id` 升序游标每页 100 行读取。
验证每行环境、活动、路线、结构、唯一身份、排除账号与时间；排除异常行并计数。游标/查询失败整体失败，不以半份名单报成功。
ExcelJS 完整生成内存工作簿后排他写新文件；不提供公开 HTTP 列表或下载 URL。空结果有表头和零计数。
字段见 [data-model.md](../data-model.md)，openid/照片/token 不导出；导出只能包含云端已收到的有效摘要。

## Local Console File Conversion

`bash tools/export-finishers/export-test.sh 控制台导出的JSON文件 [输出.xlsx]`

脚本绑定开发活动配置、--include-test、--preview，默认输出仓库 exports/ 下的时间命名文件，不执行 npm。
通用本地 CLI：`node tools/export-finishers/index.js --input 文件.json --config 活动配置.json --output 名单.xlsx [--include-test] [--preview]`。
支持 JSON 数组、单对象、data 数组封装和 JSON Lines，最大 50 MB；拒绝 CSV/ZIP，压缩包需先解压。
输入字段保留原类型，不将字符串时间或不完整记录自动补成合法记录。格式损坏整体失败，结构/归属不合法的记录排除并计数；重复账号保留输入中最早有效接收摘要。
工作簿增加来源说明，仅表示输入文件内的有效行，不能声称完整包含当前云端名单。源文件不改写，Excel 不包含原 OPENID、照片、token；原始 JSON 自身仍含内部字段，应私有保存。
此路径依赖用户在云控制台的既有权限取得文件，不创建公开接口，也不修复管理员 SDK 的 INVALID_ENV。
