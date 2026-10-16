# Research: 当前路线实现审计

以下Decision 1–6为2026-10-09实施前审计。2026-10-11实施结果：独立route-20261011.js保存357点及分段与精确标注；route.js/原生地图/H5共用资料；站距和标题不再重复写死；本机按routeId分键，开发活动独立。当前配置以data-model.md、quickstart.md为准，真机与云端验收待完成。

## Decision 1: 区分真机地图与 H5 绘图

**Evidence**: `miniprogram/components/route-map/route-map.wxml` 使用原生 map，绑定 markers、polyline 和 include-points；`specs/003-warm-orange-indigo-theme/preview/preview.js` 的 drawMaps 用 Canvas 画示意背景和折线。
**Decision**: 以真机地图验收实际位置，H5 用于审阅视觉。
**Rationale**: 同一批坐标，不同底图；H5 的位置与距离标尺不适合作地理校验。

## Decision 2: 轨迹与点位不是一份配置

**Evidence**: route.js 内置 243 个点；TASK_TRACK_INDEX 为 [135,151,159]；首末点为起终点。stations.js 使用原参考标注 0/3/4，名称和照片点位不包含独立地理坐标。route.js 的 callout 和 getTaskMarkers 也独立写有 0/3/4。
**Decision**: 同时维护几何索引、点位文字和二维码身份，不能只改 stations.js。
**Rationale**: 修改名称不会移动 marker；修改 marker 不会改变二维码。
**Alternatives considered**: 集中配置更适合长期维护，但本轮仅说明，不实施结构改造。

## Decision 3: 距离为预设值

**Evidence**: TASK_DISTANCE_KM = [0.35484,0.865,1.06608]；源轨迹 Distance 元数据为 1.659015 公里，活动对外总里程通过 source.activityDistanceMeters 配置为 3.50 公里；stations.js 有距离文字，首页、记录页和完赛凭证读取共享总里程。
**Decision**: 保留源轨迹和任务点顺序，活动总里程单独配置并同步所有参加者展示和统计来源。
**Rationale**: 更新轨迹数组不会自动重算距离。BOUNDS/REFERENCE_FRAME 是旧像素投影参数，不参与当前原生地图和 H5 Canvas 的定位；相关导出和测试仍需检查，不把它们误认为地图经纬度设置。

## Decision 4: 当前固定三个任务点

**Evidence**: progress.js 上限与终点条件为 3，qr-tags.js 要求五张码、任务索引 0–2、终点 checkpointIndex=3；route-map 只处理 marker 1–3；路线页、凭证、统计与 tests/run-tests.js 存在固定数量。
**Decision**: 移动或替换三个点可维护配置；增加第四点需要业务改造。

## Decision 5: 换路线需要处理旧进度与名单

**Evidence**: 本机存储键 patchwalk-progress-v3，routeId 默认 route-01；readProgress 不比较当前 routeVersion。云端 recordId 由 activityId + OPENID 生成，不含路线版本；云函数从 ACTIVITY_CONFIG 环境变量读配置。
**Decision**: 开发测试前重置本次路线；新独立活动使用新 activityId。客户端、云函数实际配置和导出配置同步路线版本。
**Rationale**: 仅改 routeVersion 不会清本机进度，且复用旧 activityId 可能与同一用户旧名单记录冲突，返回 SERVICE_UNAVAILABLE。旧上报队列会因目标不同而不发送，但并未自动删除。

## Decision 6: 地图不参与到场验证

**Evidence**: qr-validation.js 校验完整 payload 和当前检查点，没有地理坐标判断；map 的 show-location=false，当前打卡流程未调用 getLocation。
**Decision**: 地图位置更换不等于二维码作废。全新活动建议换二维码身份/token，并替换现场标牌。
**Rationale**: 同一逻辑点迁移可复用二维码；不同活动隔离则需明确换码。静态二维码与旧小程序包无法提供强制远程撤销，扫码副本也不代表现场到达。

## Scope

原方法阶段没有更换代码。现已收到完整KMZ且用户授权实施，按plan.md落地，仍未执行真机或现场测试。保留标准KML WGS84假设并记录其现场校验要求；没有新增定位权限或后台打卡校验。
