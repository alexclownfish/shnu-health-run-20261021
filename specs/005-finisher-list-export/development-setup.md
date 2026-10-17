# 开发环境联调

测试版/体验版使用独立测试环境，正式版使用独立正式环境；两端配置都已写入代码，正式发布前仍需完成云端部署和真机验收。
客户端与开发活动配置已完成；用户截图曾验证原活动体验版摘要写入开发集合。2026-10-11新路线使用独立开发活动与版本，需重新同步ACTIVITY_CONFIG并完整测试，详见 [新路线联调](../007-route-maintenance/quickstart.md)。管理员Excel云读取、客户端权限与其余真机场景仍需验收。本地控制台文件转换可用，不依赖电脑云环境访问。

## 当前配置

| 项目 | 当前值 |
| --- | --- |
| 开发环境 ID | cloud1-d1g886bht0f7cbf69 |
| 小程序 AppID | wx9d16b2e04851fc36 |
| 云函数 | submitCompletion |
| 集合 | finishers |
| 活动编号 | health-run-2026-event02 |
| 路线版本 | route-20261011-v1 |
| 点位 | 起点 000，任务 001/002/003，终点 999 |
| 测试时间 | 2026-10-09 00:00:00 至 2026-11-09 00:00:00（Asia/Shanghai） |
| 补交截止 | 2026-11-10 00:00:00（Asia/Shanghai） |

这是方便本轮联调的测试窗口，不是正式活动时间。超出该窗口时按实际测试安排更新开发配置。
配置文件为 cloudfunctions/submitCompletion/activity.example.json；其中时间已是毫秒整数，enabled=true，排除账号为空，开发账号可以入测试表。

## 1. 建立测试集合

在微信开发者工具“云开发”中选择 cloud1-d1g886bht0f7cbf69，进入数据库，新建 finishers。
集合权限选择自定义规则并保存：

```json
{"read": false, "write": false}
```

不要选择所有用户可读写。数据库规则文件不会随云函数上传自动应用，必须在控制台设置。
云函数和有相应读取权限的管理员使用服务端访问；小程序客户端直接读写应失败。

## 2. 部署开发云函数

在开发者工具文件树找到 cloudfunctions，选择开发环境 cloud1-d1g886bht0f7cbf69。
右键 submitCompletion，选择“上传并部署：云端安装依赖”，将 index.js、policy.js、service.js、package.json 一起部署。
函数名称为 submitCompletion，入口 index.main，运行时使用平台支持且兼容 node:crypto 的 Node.js，超时设为 10 秒或更短并验证足够正常写库。

若通过本机官方 CLI 部署，需要先在微信开发者工具“设置 → 安全设置”开启服务端口，并登录有该 AppID 云开发权限的账号。
本轮检查时 CLI 返回 IDE service port disabled；电脑控制工具也返回权限未授予，因此未完成自动部署。无需为了此步骤把管理员 SecretKey 发到聊天中。

服务端口可用后，官方 CLI 的开发部署命令为：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy --env cloud1-d1g886bht0f7cbf69 --names submitCompletion --remote-npm-install --project /Users/yangwenzhe/project/shnu-health-run-20261021
```

这条命令仅上传开发环境云函数，不发布小程序、不创建集合，也不会自动设置 ACTIVITY_CONFIG。

## 3. 设置活动环境变量

在开发环境 submitCompletion 的配置/环境变量中新增 ACTIVITY_CONFIG。
值使用 cloudfunctions/submitCompletion/activity.example.json 的完整 JSON 内容（环境、活动和测试时间都已填好），保存使其生效。
变量值必须是 JSON，不是文件路径；把模板上传到云端不等于配置了环境变量。

当前完整值：

```json
{
  "enabled": true,
  "mode": "test",
  "environmentId": "cloud1-d1g886bht0f7cbf69",
  "appId": "wx9d16b2e04851fc36",
  "activityId": "health-run-2026-event02",
  "title": "步履拾光·健康同行",
  "routeVersion": "route-20261011-v1",
  "requiredPoints": ["001", "002", "003"],
  "startPointCode": "000",
  "finishPointCode": "999",
  "startsAt": 1791475200000,
  "endsAt": 1794153600000,
  "reportingClosesAt": 1794240000000,
  "excludedOpenIds": [],
  "timeZone": "Asia/Shanghai"
}
```

## 4. 体验版完整流程验收

重新编译本地代码或上传体验版，从新一轮起点开始。旧凭证、启用前已开始的路线没有活动上下文，不会自动补录。
起点扫码 -> 三个任务点依次扫码、拍照上传 -> 终点扫码。
第三个任务点不提交摘要，成功终点才提交；finishers 应出现一条对应账号记录，本机凭证继续显示固定起止时间。
打开凭证或重复提交不会增加行数；另一个微信账号完成后才增加另一条人员记录。
字段包括 ownerOpenId、昵称、activityId、routeVersion、起止时间、durationMs 和 receivedAt；没有照片、头像和二维码 token。

断网完成仍有本地凭证。恢复网络后等待首次退避 1 分钟，再返回前台/重进，检查收到且只有一条。
微信开发者工具的普通小程序调用可用于测试，但仍需要可信 OPENID；云函数控制台直接模拟调用可能返回 IDENTITY_REQUIRED，这不代表真机失败。
本地云函数调试 ENV=local 不被接受，测试请调用实际云环境函数。

## 5. 导出测试 Excel

### 推荐：控制台 JSON + 本地 shell 脚本

用户已实测电脑云访问返回 INVALID_ENV。换成直接云读取的 shell 或 HTTP 接口仍需处理云环境/身份问题；本轮采用已登录控制台获取文件、本地离线转换，不开放新的网络导出接口。

1. 在云开发控制台选择开发环境 cloud1-d1g886bht0f7cbf69 → 数据库 → finishers。
2. 点击“导出”，格式选 JSON，字段项留空以导出全部字段；不要只导出昵称和时间，缺少 schemaVersion/身份/活动字段的行无法校验。
3. 下载 JSON 文件，例如保存为 Downloads/finishers.json。若取得压缩包，先解压得到 JSON。
4. 在仓库根目录运行以下命令，替换实际下载文件名：

```bash
cd /Users/yangwenzhe/project/health-run/health-run
bash tools/export-finishers/export-test.sh "$HOME/Downloads/finishers.json"
```

脚本不调用 npm、不要求 SecretId/SecretKey、不访问云端，使用当前电脑已安装的 Node.js 与项目现有 ExcelJS。
默认生成 exports/test-finishers-日期时间.xlsx，避免覆盖旧名单；也可传第二个参数指定新的 .xlsx 输出路径。
脚本自动携带 --include-test 和 --preview，只读取文件中与当前开发活动配置匹配的有效记录，表格名称为“测试名单”。
支持 JSON 数组、单个对象、data 数组封装、一行一条对象的 JSON Lines、UTF-8 BOM 和 CRLF；不支持 CSV，选择 JSON 导出。单文件最多 50 MB。

仍检查活动、环境、路线、身份、点位与时间，并排除异常/重复行、显示数量。Excel 不含原 OPENID、照片或二维码 token；原始 JSON 不会被改写，其中包含 OPENID，应保存在私有位置（若放仓库请放 Git 已忽略的 exports/）。
“导出说明”注明来自本地文件；文件之外、后续新增或控制台未包含的记录不会自动出现。再次取得最新 JSON 才能更新名单。
JSON 有损坏行会整体停止并提示行号，不把半份名单报为成功；已存在输出文件拒绝覆盖。
控制台权限仍由登录账号控制，这条路径不修复 INVALID_ENV，也不把原始 JSON 当作可信防伪凭据。

### 可选：管理员 SDK 直接读取

管理员电脑配置具有该开发环境数据库读取权限的凭据，方式见 deployment.md 第 8 节。默认不读取测试数据，测试导出显式带 --include-test：

```bash
npm run export:finishers -- --config cloudfunctions/submitCompletion/activity.example.json --output exports/test-finishers.xlsx --include-test --preview
```

活动尚在测试窗口内，需要 --preview；文件已有时使用新名字。表头显示“测试名单”，不可作为正式人员名单。
先验收实际数据库查询；如提示缺索引，按查询提示建立索引，并用超过 100 条数据验证分页。
导出所需私有凭据不能放在小程序；没有管理员凭据时，先通过云控制台查看测试记录，不声称 Excel 的云读取已验证。

若导出失败，更新后的工具会显示“阶段”和“错误码”，区分配置、云端连接/读取、生成或保存文件。
错误提示只显示固定排查建议与安全错误码，不输出 SDK 原始消息、堆栈或凭据。把新的阶段/错误码提供给开发者即可，不需要提供密钥。
同时设置两种凭据时，完整的 TENCENTCLOUD_SECRETID/SECRETKEY 优先于 CLOUDBASE_APIKEY，避免终端遗留 API Key 覆盖当前设置。
云端鉴权/权限错误需核对密钥所属腾讯云账号与开发环境归属；微信开发者工具已登录、体验版能写入，不代表电脑持有的腾讯云密钥也能读取该环境。
npm 的版本更新通知与导出是否成功无关，排查时不需要升级 npm。

## 反复测试与排查

每个活动每个账号保留首条记录，重置小程序路线不会覆盖这条时间或昵称。当前活动固定使用 health-run-2026-event02 和 route-20261011-v1；普通重新测试不要修改它们。只有明确要创建独立测试活动时，才由开发者同时修改客户端、云函数 ACTIVITY_CONFIG 和导出配置，并提前记录新值。
旧测试数据留在测试环境，不会迁移到正式名单；不要为重复测试清除正式数据或自动重标测试记录。

若无记录，检查函数是否有调用、ACTIVITY_CONFIG 是否生效、集合名称/权限及设备时间。
网络/配置临时错误保留 pending，退避后回前台重试；永久错误保留 blocked，查看 health-run-completion-outbox-v1 的 reasonCode，修复活动配置后再决定如何补交。
参见 quickstart.md 的真机验收要求；本地模拟通过不等于真实云部署、权限或现场流程已通过。
