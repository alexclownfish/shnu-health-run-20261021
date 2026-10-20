# 云函数建立与 Excel 导出操作说明

本地 MVP 已实现；开发、正式两个云环境 ID 已填入配置。测试版/体验版和正式版分别指向独立云环境；客户端权限、补报和管理员 Excel 云读取仍需验收。
用户要求先完成开发环境，本轮优先按 [development-setup.md](development-setup.md) 的现成配置和步骤联调。本文的正式环境步骤留待后续。
需要一个云函数 `submitCompletion`，分别部署到两个独立环境；不需要自己购买服务器或建立小程序管理页。
使用云开发数据库后，这部分是后端服务；扫码、照片、计时、凭证继续在本机工作。

## 1. 打开项目并开通云开发

在微信开发者工具中导入本仓库根目录（包含 project.config.json 的悠湃体育项目），用有该小程序权限的微信账号登录。
确认 AppID 为 `wx9d16b2e04851fc36`，不是游客 AppID。打开工具的“云开发”，按实际账号提示开通。
资格、环境数量、费用和资源配额以实际控制台为准；本方案不承诺免费。

本项目沿用用户已创建的开发环境和正式环境，无需再建立第三个测试环境；开发环境对应代码中的 test。
当前已填写以下两个不同 ID。它们是环境 ID，不是显示名称；此记录不代表已通过管理员 SDK 验证云端访问。

| 环境 | 环境 ID | 使用版本 | 数据集合 |
| --- | --- | --- | --- |
| 开发环境（test） | cloud1-d1g886bht0f7cbf69 | 开发版 develop、体验版 trial | finishers |
| 正式环境（production） | shnu-health-run-20261021-dc2d3ff | 正式版 release | finishers |

## 2. 建立数据库集合与权限

在测试环境数据库新建 `finishers`；正式环境新建 `finishers`。
集合“权限设置”使用自定义规则，禁止小程序客户端直接读取和写入：

```json
{"read": false, "write": false}
```

规则范本也在 `cloudfunctions/submitCompletion/database.rules.json`。这个文件不会随云函数部署自动应用，必须在控制台设置并保存。
云函数服务端及授权管理员通过其权限访问；普通客户端只能调用云函数提交本人的摘要，不能直接取得名单。
用普通参与者账号实测直接 `.get()` 和 `.add()` 都失败，然后用云函数实测能写入。

导出查询包含 activityId 等值、receivedAt 截止范围、_id 游标和升序排序。先在测试集合实际运行导出；若控制台提示缺索引，按该查询的提示建立复合索引并等到“可用”，正式集合也设置对应索引。
不要把单字段索引建好就视为所有分页查询已验证；使用超过 100 条测试记录验收实际 SDK 查询。

## 3. 上传云函数代码

项目已配置 `cloudfunctionRoot: "cloudfunctions/"`。在开发者工具文件树找到 `cloudfunctions/submitCompletion`。
先将 cloudfunctions 的当前云环境选为测试环境；右键 submitCompletion，选择“上传并部署：云端安装依赖”（具体名称随工具版本略有不同）。
无需在控制台手动复制每个文件，也不要只上传 index.js；policy.js、service.js、package.json 必须一起部署。

检查云函数名称 `submitCompletion`、入口 `index.main`，选择平台当前支持且兼容 node:crypto 的 Node.js 运行时（例如控制台可用的 Node.js 18 或更新版）。
将执行超时设为 10 秒或更短，并验证足以正常写库。最终导出一分钟等待规则基于这一短超时，不应随意改成超过一分钟。
函数依赖为 `wx-server-sdk@3.0.4`，通过云端安装。客户端调用函数无需持有管理员 SecretKey。

本轮先完成测试环境部署与验证。后续用户启用正式活动时，再将目标切换正式环境部署；本轮不执行正式部署。

## 4. 配置云函数 ACTIVITY_CONFIG

打开对应环境 submitCompletion 的“配置/环境变量”。新增变量名 `ACTIVITY_CONFIG`，值是完整 JSON 字符串。
开发环境使用 `cloudfunctions/submitCompletion/activity.example.json`，正式环境使用 `activity.production.example.json`；两份配置均已填写新 AppID、活动编号、环境 ID、活动名称和时间窗口。
这些 JSON 文件供粘贴到 ACTIVITY_CONFIG，上传文件本身不会自动设置云函数环境变量。开发和正式配置的窗口均为 2026-10-09 至 2026-11-09，补交至 11-10（Asia/Shanghai）。
保存后按控制台要求使配置生效。两个环境分别配置，不要共用正式 JSON。

本轮开发配置（联调超过窗口时需要更新）：

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

时间必须是毫秒整数，可在开发者工具控制台求值，例如 `Date.parse('2026-10-09T08:00:00+08:00')`。不要填秒、日期字符串或 0。
startsAt/endsAt 限制手机起止时间；reportingClosesAt 限制服务器接收时间，可设结束后一天补交，具体由活动组织者决定。

正式配置使用 mode=production、正式环境 ID、health-run-2026-event02、步履拾光·健康同行、正式活动时间和开发账号 excludedOpenIds。当前测试和正式环境按用户要求使用同一活动编号，但数据仍由不同云环境隔离。保留两份与云端完全一致的电脑配置 `test.local.json`、`production.local.json` 用于导出，`.local.json` 已被 Git 忽略。
活动开始后冻结名称、版本、点位和窗口；下一次活动使用新 activityId。路线更改时同步小程序清单与云端配置，不能只改地图后沿用旧版本。

2026-10-17 名称错字更正为“步履拾光·健康同行”：测试、正式两个环境均先部署本次兼容版 `submitCompletion`，再将各自 `ACTIVITY_CONFIG.title` 改为新名称，并同步电脑导出配置。当前活动的旧名称记录仍可用于重复上报回查与名单导出，Excel 统一显示新名称；历史数据库记录无需改写，活动编号和路线版本保持不变。页面、分享标题和保存凭证的更正需重新上传、发布小程序后生效。

## 5. 取得开发/测试账号并设置排除名单

先让所有开发人员和用于现场测试的微信账号，在测试环境体验版跑一次完整流程。
在测试数据库 finishers 中查看他们对应记录的 `ownerOpenId`，这是云函数可信微信上下文写入的账号标识。
同一 AppID 的这些账号用于正式环境排除，将其填入正式 ACTIVITY_CONFIG 的 excludedOpenIds，例如 `["真实开发账号openid", "真实现场测试账号openid"]`。
没有测试完赛记录时，先核对客户端、时间窗口和函数配置；不需要为查身份增加公开查询接口。

正式配置若排除列表为空，服务会拒绝接收，避免忘记排除开发者。测试配置允许为空，否则难以验证收集。
所有测试账号都应列入，不能填随意占位符就认为实现了隔离。
若临时补加排除账号，后续导出配置也要同步；已误写入的排除账号会从导出中剔除，数据库原记录仍保留到管理员清理。

正常账号在正式活动时间内使用正式版完成测试，与参加活动无法自动区分：测试请用排除账号或体验版。
微信服务端上下文没有可信 envVersion；客户端版本分流防误操作，不应宣称能抵抗伪造调用或二维码作弊。

## 6. 填写小程序配置并启用

`miniprogram/utils/config.js` 的两个环境 ID、活动编号和路线版本已填写，总开关和 test/production 两个目标均为 true：

```js
completionReporting: {
  enabled: true,
  functionName: 'submitCompletion',
  targets: {
    test: {
      enabled: true,
      envId: 'cloud1-d1g886bht0f7cbf69',
      activityId: 'health-run-2026-event02',
      routeVersion: 'route-20261011-v1'
    },
    production: {
      enabled: true,
      envId: 'shnu-health-run-20261021-dc2d3ff',
      activityId: 'health-run-2026-event02',
      routeVersion: 'route-20261011-v1'
    }
  }
}
```

这里不填 OPENID、管理员密钥、名单地址。配置中的活动/版本必须与对应云端一致。
编译并上传体验版，使用新一轮起点开始测试；旧测试凭证不会因打开或升级自动上传，开始时未启用的旧进度也不回填。正式版发布后从新一轮起点开始，才会绑定正式收集。
开发版/体验版只能得到测试名单；正式活动必须审核发布正式版，正式版新起点才绑定正式收集。
测试中进行到第三点不产生摘要，成功终点才上报；旧测试进度在升级后需要重置并重新从起点开始。
上报不会增加可见导出入口，失败不影响本地凭证或照片。

2026-10-20 资料前置校验更新：需重新上传并发布小程序，并在测试、正式环境分别部署新版 `submitCompletion`。本次不修改 `ACTIVITY_CONFIG` 或数据库集合。打开小程序时不弹出资料框；点击扫码后填写非空参与者姓名即可继续，头像不再作为前置条件；空白姓名仍不能扫码。已有本地完赛但未上报的空姓名摘要补齐姓名后可重试，云端已有空白姓名记录需管理员另行核实补录，本次不会自动修改。

## 7. 数据说明和保留

页面数据说明已更新为照片留本机、开启收集时将手动填写的姓名和完赛摘要交给组织者。
上线前在微信后台用户隐私保护指引及活动通知中如实描述用途、字段、接收方与期限，按平台实际要求处理授权。
名单人员名称为用户手动填写的姓名，未经实名核验。若需要工号或报名信息关联，应另行设计。
明确一个保留期限，到期由管理员删除数据库活动记录和本地导出副本；MVP 没有自动定期删除作业。

## 8. 管理员准备电脑导出

在本仓库根目录安装 Node.js（建议本机 Node.js 20 或更新兼容版），安装依赖并运行测试：

```bash
npm install
npm test
```

也可使用仓库 pnpm-lock.yaml 对应 pnpm 安装。云函数依赖已单独在云端安装，电脑依赖用于测试和导出。
准备第四步的 production.local.json，配置与正式函数保持一致。关闭 enabled 后仍可导出，活动字段不要删除或改写。

使用具有该云环境数据库读取权限的管理员/专用云账号凭据，通过终端环境变量提供：

- TENCENTCLOUD_SECRETID、TENCENTCLOUD_SECRETKEY；临时凭据另附 TENCENTCLOUD_SESSIONTOKEN。
- 或平台支持的服务端 CLOUDBASE_APIKEY（不是可公开客户端 key）。

建议使用只授予所需读取权限的专用账号或短期凭据，先实测其能分页读取目标环境。
凭据不放到小程序、JSON 活动配置、代码仓库或截图中；不要让公开名单链接代替管理员权限。

## 9. 按需导出 Excel

管理员 SDK 当前得到 INVALID_ENV 时，可优先在已登录云控制台选择集合，导出 JSON（字段项留空），然后执行 `bash tools/export-finishers/export-test.sh "$HOME/Downloads/finishers.json"` 本地转换。该脚本无需 npm 或密钥；完整步骤见 [development-setup.md](development-setup.md) 第 5 节。
本地模式支持 --input，不访问云数据库，只转换文件内有效记录，工作簿注明来源；直接 SDK 方案如下。

在仓库根目录，补交窗口结束并至少等待一分钟后执行：

```bash
npm run export:finishers -- --config production.local.json --output exports/finishers.xlsx
```

活动尚在进行中要查看阶段性名单：

```bash
npm run export:finishers -- --config production.local.json --output exports/finishers-preview.xlsx --preview
```

测试导出必须显式选择：

```bash
npm run export:finishers -- --config test.local.json --output exports/test-finishers.xlsx --include-test --preview
```

可用 `--cutoff "2026-10-09T20:00:00+08:00"` 指定接收截止时间，不接受未来时间。
文件已有则不覆盖，用新的文件名再次导出。exports/ 已被 Git 忽略。
工作簿含“完赛名单”（测试为“测试名单”）与“导出说明”，显示有效人数、排除异常数、时区和截止时刻。
包含昵称、参与者编号、起点/完成时间、总用时及活动字段；没有照片、二维码 token、原 OPENID 或排名。
序号只是行号。进行中预览不是事务快照，最后再导出一次；最终导出期间不要人工往集合补写历史时间记录。

## 10. 联调与排查

- 无云记录但本地凭证正常：先看云函数是否有调用、ACTIVITY_CONFIG 是否生效、两个环境 ID/活动版本是否一致，检查 startsAt/endsAt/reportingClosesAt 毫秒值。
- 控制台测试没有身份：后台“测试函数”可能没有 wx_client/OPENID，IDENTITY_REQUIRED 是预期；使用小程序账号实际调用。开发者工具来源只允许测试环境，本地云函数调试 ENV=local 不接收。
- 网络或 SERVICE_UNAVAILABLE：outbox 留存；首次退避 1 分钟，随后 2/4/8 分钟，最多 1 小时。到期后再次启动/回到前台补报，不能保证小程序关闭后上传。
- EXCLUDED_DEVELOPER：不入表，队列项删除；体验版测试时应使用测试配置而非正式排除规则。
- INVALID_PAYLOAD/ACTIVITY_NOT_ALLOWED/BUILD_NOT_ALLOWED/REPORTING_CLOSED 等：保留 blocked 项，避免反复错误提交。管理员在设备调试 storage 的 health-run-completion-outbox-v1 查看 reasonCode。先修正配置并确认原活动归属，需要补交时另行处理 blocked；重进不会自动解除，也不要把测试项改成正式项。
- 导出失败：新版工具显示失败阶段和安全错误码，按提示检查管理员凭据与读权限、索引或本地文件；已有文件不覆盖。同时设置两种凭据时 SecretId/SecretKey 优先；不要通过开放客户端读权限来解决管理员凭据问题。npm 更新通知与导出失败无关。
- Excel 人数不足：仅包含已接收且有效的完赛摘要。长期离线、未再次打开、清除数据、补交超时的人员可能不在名单内；管理员无法远程恢复其手机存储。

按 [quickstart.md](quickstart.md) 完成 T015：两个账号、真实云端重复并发、权限拒绝、多页导出、三平台真机与离线补交。
用户已验证一次体验版摘要写入；其他线上项目仍待验收，68 项本地测试不能替代它们。
