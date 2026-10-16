# Data Model: 二维码使用提示

| 数据 | 约定 |
| --- | --- |
| QR_USAGE_HINT | 请在微信小程序「悠湃体育」内点击“扫码打卡”使用。 |
| legacyPayload | 原HRQ1单行数据，由原pointCode、qrId、qrToken计算 |
| payload | QR_USAGE_HINT + LF + legacyPayload，作为新版打印原文 |
| pointCode / qrId / qrToken | 五项原值不变 |
| payloadVersion | 原HRQ数据版本1不变；提示为展示包装 |
| 校验输出 | 原qrId、pointCode、checkpointType/Index、assurance、observedAt，不保存提示或token |

LF/CRLF均接受，首尾空白处理沿用原规则。只移除一次完整固定提示行；未知或重复配置不成功。成功元数据和本地进度无需迁移。
