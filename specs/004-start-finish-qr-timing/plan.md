# Implementation Plan

## Constitution Check

保持明确本地权威、失败不放行、最小存储、可测试状态转移和原生小程序实现。不新增平台能力；相机集成真机检查仍为发布门槛。

## Architecture

1. `qr-tags.js` 定义五个码：`checkpointType` 为 start/station/finish；只有 station 带 `stationIndex`。
2. `progress.getCurrentCheckpoint()` 是下一检查点来源：未起点 -> start，任务 0-2 -> station，任务 3 -> finish，完赛 -> null。
3. QR 校验按预期类型和任务下标精确匹配唯一清单项，回调提交前重新检查当前进度，拒绝过期上下文。
4. `startCheckIn`、`finishCheckIn` 仅接受绑定的本地验证元数据，分别保存最小证据和只写一次的时间戳。
5. `checkInStation` 不启动计时，`completeStation` 不结束计时；第三任务点保存后去终点扫码页。
6. 起点成功返回路线页，任务点成功进入照片上传页，终点成功进入凭证页；终点前不解锁凭证和完整路线徽章。
7. 活动进度键为 `patchwalk-progress-v3`，v2 不修改。不存二维码 token、原始扫码结果或设备类型。

## Verification

自动化覆盖二维码清单、顺序、状态转移、时间差、幂等、过期回调、扫码 hide/unload、照片上传回归和凭证生成限制。
真机按 quickstart 执行，不声称已经验证未实际测试的设备。
