# Research: 完赛名单与测试数据隔离

**Date**: 2026-10-09
**Scope**: 第一方 API 文档、安装 SDK 源码、本地自动测试；没有真实云部署。

## Decisions

| 问题 | 选择与理由 |
| --- | --- |
| 获取不同手机的人员名单 | 云开发仅收完赛摘要，完全纯前端无法集中取得各手机 storage |
| 保持现有打卡体验 | 终点成功后异步上报，照片与凭证继续本机生成 |
| 开发测试隔离 | 两个云环境 + 测试/正式集合 + 云端活动窗口 + 开发账号排除 |
| 防旧测试误入 | 起点绑定活动/环境，旧缓存不自动回填；测试上下文不能升级为正式 |
| 谁可导出 | 管理员电脑持私有云账号凭据；小程序无名单接口或管理页 |
| 姓名来源 | 用户在扫码前手动填写的参与者姓名与参与者编号；当前代码没有工号或报名表关联 |
| 重复/响应丢失 | 确定 `_id` 原子新增，首条已接收记录保持不变 |
| 断网 | 独立 outbox 与重进补报，1 分钟起退避至 1 小时；不保证关闭后上传 |
| Excel | ExcelJS 字符串单元格，昵称类似公式也只是文本；用时允许超过 24 小时 |
| 导出一致性 | keyset 分页，进行中标为预览；最终在补交窗口关闭至少一分钟后 |

## First-Party Evidence

- [微信云函数 getWXContext](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/utils/Cloud.getWXContext.html)：可信字段 OPENID、APPID、ENV、SOURCE；SOURCE 区分 wx_client、wx_devtools、wx_localdebug、wx_http 等。官方契约没有可信 envVersion；本地调试 ENV 可为 local。
- [CloudBase 服务端初始化](https://docs.cloudbase.net/api-reference/server/node-sdk/initialization)：管理员 SDK 通过环境 ID 与 SecretId/SecretKey/SessionToken 或服务端 API Key 初始化。凭据不能进入小程序；可公开客户端 key 不适用管理员导出。
- [服务端数据库 add](https://docs.cloudbase.net/api-reference/server/node-sdk/database/add)：管理员 SDK 直接传入文档数据；微信云函数 SDK 使用 add({ data }) 包装，不能混用。
- [微信数据库导出](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database/export.html)：控制台支持 CSV/JSON；JSON 字段项留空默认导出全部字段。[导入文件格式](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database/import.html) 说明 JSON Lines 记录以换行分隔，使用 UTF-8。
- 本地安装的 wx-server-sdk 源码验证其 add({data}) 转发行为，doc().get() 结果兼容对象/数组。
- 使用 wx-server-sdk 3.0.4、@cloudbase/node-sdk 3.18.3、exceljs 4.4.0 固定依赖；本地能加载并完成测试。云端 `_id` 重复冲突与权限仍需实际验证。

## Dirty Data Boundary

服务端不相信客户端 isTest、openid、管理员标记；mode 和集合由部署配置确定。
客户端 release/develop/trial 是防开发误操作路由，不能证明请求未被篡改。
正常账号在正式活动时间用正式版跑完整测试，与真实参与者的摘要相同，无法自动判断，应先加入 excludedOpenIds。
活动窗口、路线与点位校验只排除明显错误；不证明扫码现场、真实照片或未改过手机时间。
管理员人工插入的结构完全相同的伪记录也无法仅凭导出程序判断，应限制写权限和操作。

## Validation Limits

本地共 68 项测试通过，包含开发独立启用、正式目标拒绝初始化/上报、205 人分页、异常行过滤、XLSX 读回、离线、并发模型、安全错误诊断和无凭据 JSON/shell 本地转换。
用户截图证实体验版摘要写入开发环境 finishers；这不证明管理员电脑的密钥有相同环境的读取权限。重跑新版工具取得 INVALID_ENV，表明当前 SDK 访问失败，不足以证明具体是账号、环境归属或环境状态问题。
本轮选择控制台文件 + 本地转换作为可用替代，避开电脑 SDK 云访问；没有用户实际 JSON，端到端验证使用构造的合法测试摘要，不宣称已转换真实人员数据。
尚未验证该 AppID 的云开发资格、环境数量限制、配额、计费、云端索引、真实 SDK 上下文和三平台真机。
本地测试不证明云端数据库权限或并发机制已经上线可用；见 tasks.md 的 T015。
名单仅代表已接收记录。用户长期离线、关闭后不重进、清除数据或错过补交期限，可能永远不在名单里。
