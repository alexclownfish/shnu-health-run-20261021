# Data Model

## Checkpoint

| Type | Point | checkpointIndex | stationIndex | Task |
| --- | --- | --- | --- | --- |
| start | 000 | -1 | absent | Start timing only |
| station | 001/002/003 | 0/1/2 | 0/1/2 | Action and photo |
| finish | 999 | 3 | absent | End timing only |

QR ID、token、version、enabled、完整 payload 沿用 HRQ1 协议。全清单要求五项且点位、ID、token、payload、checkpointIndex 唯一。

## Progress

- `completed`: 已完成照片上传的任务点数量，0-3。
- `startedAt`: 起点成功时间，未开始为 0。
- `completedAt`: 终点成功时间，未完赛为 0。
- `startCheckIn` / `finishCheckIn`: null 或 `{ at, source: 'qr-code', qrId, pointCode, assurance: 'LOCAL_QR_MATCH' }`。
- `checkins`, `actions`, `photos`, `history`: 原三个任务点结构不变。
- 完赛需要三个任务点、正值开始时间、有效起終点证据且结束不早于开始。时间仍然是本机非可信数据。
