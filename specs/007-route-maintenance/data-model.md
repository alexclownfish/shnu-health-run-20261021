# Data Model: 当前映射关系

| 顺序 | 名称 | 二维码 pointCode | stationIndex | marker ID | 当前 TRACK 数组索引 |
| --- | --- | --- | --- | --- | --- |
| 起点 | 起点 | 000 | 无 | 0 | 0 |
| 任务 1 | 肩颈舒展 | 001 | 0 | 1 | 70 |
| 任务 2 | 手腕放松 | 002 | 1 | 2 | 180 |
| 任务 3 | 腰背激活 | 003 | 2 | 3 | 227 |
| 终点 | 终点 | 999 | 无 | 4 | 356 |

新标注打卡点1/2/3对应任务1/2/3。TASK_TRACK_INDEX仅用于阶段与累计距离，地图标记使用独立标注坐标。第三站选返程阶段，不选相同道路的去程索引135。

## 路线资料

- 源资料：specs/007-route-maintenance/source/route-20261011.kmz；小程序只打包规范化的 utils/route-20261011.js，不打包照片。
- 轨迹：每个点为 [记录序号,纬度,经度]，357个点；segmentStarts=[0,67]，两段分别绘制，记录间隙不补线。
- 坐标来源：当前预期 WGS84，地图输出 GCJ-02；从腾讯/高德等选取坐标需确认坐标系，不能重复转换。
- 起终点：目前使用数组首尾点，无独立端点坐标字段。
- 距离：任务阶段按路线数据计算；活动对外总里程由 source.activityDistanceMeters 配置为3.50公里。stations距离文字读取共享路线，首页、记录页和完赛凭证读取共享活动总里程。

## 点位资料

stations.js 的 id、title、location、distance、sourceMarker、tag、success。任务点不再保存动作图示、动作说明或动作等待计时字段；扫码成功后直接进入照片上传。

## 二维码资料

qr-tags.js 的 pointCode、checkpointType、checkpointIndex、stationIndex、qrId、qrToken、payloadVersion、enabled、payload。
当前实际格式为 `HRQ1|点位编号|二维码编号|token`，不是旧 NFC 的 HR1 格式或页面链接。完整 payload 是二维码内容。

## 进度与活动

本机routeId=route-20261011，存储键patchwalk-progress-v4-route-20261011。旧patchwalk-progress-v3记录不删除、不迁移，新路线从起点开始；旧资料仍在存储但新页面不展示。

routeVersion=route-20261011-v1；测试 activityId=health-run-2026-event02，测试环境为 cloud1-d1g886bht0f7cbf69，正式环境为 shnu-health-run-20261021-dc2d3ff。云端以activityId + 用户去重，routeVersion用于版本校验与导出过滤。旧待上报摘要保留原目标，不重标或发送至新活动。
