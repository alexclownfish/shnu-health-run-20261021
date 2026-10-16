# Contract: 新版打印原文和扫码兼容

## 新版

```text
请在微信小程序「悠湃体育」内点击“扫码打卡”使用。
HRQ1|001|QR-001-A|ced81f9f7eb9a66ad9e5bcd07d732613
```

固定提示、一个LF或CRLF换行、一个原HRQ1数据行。示例为任务点1，另外四项同样包装自己的原文。

## 兼容

仅有原HRQ1数据行也可接受。去除固定包装后的完整数据必须精确匹配唯一启用的legacyPayload，且符合当前起点、任务点或终点阶段。

## 拒绝

修改提示、提示与数据在同一行、重复提示、插入空白行、额外数据行、两张码拼接、未知token、URL、禁用项、错误点位；重复登记返回QR_CONFIG_DUPLICATE。

## 制作工具

`npm run generate:qr-tags`生成assets/qr-checkpoints/中的五张PNG、五份UTF-8文本及specs/004-start-finish-qr-timing/qr-payloads.md。默认位置相对于仓库根目录，允许显式传入另一个输出目录供测试；生成前检查清单有效性。
