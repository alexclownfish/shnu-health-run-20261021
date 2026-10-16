# Implementation Plan: 路线与点位更换方法

**Date**: 2026-10-09 | **Branch**: `theme/warm-orange-indigo` | **Spec**: [spec.md](./spec.md)
**Status**: 2026-10-11 进入实施；用户已明确授权

## Summary

基于完整 KMZ 提取独立路线数据模块，route.js 继续负责坐标转换与原生标记。使用两段 polyline 和准确照片标注坐标，保留扫码后照片上传流程。新路线独立本机存储和开发活动目标；预览重建共享路线资料。

## Technical Context

**Language/Version**: 微信原生 JavaScript、WXML、WXSS；已有 Node.js 预览构建器与测试
**Primary Dependencies**: 微信原生 map；H5 Canvas；扫码使用现有 wx.scanCode
**Storage**: 本机进度与照片；可选开发环境 CloudBase 完赛汇总
**Testing**: 更新轨迹/标记/距离断言，增加原数据一致性、分段和旧进度隔离检查；跑现有业务和汇总/导出测试。真机现场验收另行执行。
**Target Platform**: 微信小程序及独立 H5 设计预览
**Project Type**: 既有应用配置维护
**Performance Goals**: 同数量替换保持现有交互；轨迹点数显著增加时实测地图性能
**Constraints**: 现有流程固定三个任务点；轨迹数据按 WGS84 转换后传给地图
**Scale/Scope**: 357 个点、两段轨迹、起终点和三个任务点；保留五张二维码及照片上传

## Constitution Check

- I: PASS，描述当前实现；新坐标须在真机和现场核对，不承诺仅凭预览准确。
- II: PASS，扫码进度仍为本机状态，云端仅接受完赛汇总；地图不提供到场证明。
- III: PASS，不建议绕过二维码或点位顺序验证。
- IV: PASS，维护验收覆盖起点、三任务点、终点计时及旧数据。
- V: PASS，同数量替换优先修改现有配置；不新增后台和数据库。

## Current Architecture

小程序：route.js 的预置轨迹 → WGS84 转 GCJ-02 → route-map 组件的 polyline、markers、center、include-points → 微信原生地图底图。

H5：build-preview.js读取共享地图点、两段轨迹、精确markers与里程，嵌入index.html；preview.js归一化后画Canvas，显示五个标记。底图网格为示意，不是原生真实地图。

当前无通用轨迹导入界面。本轮结构化解析KMZ并保存原始归档和规范化JavaScript数据模块；不是替换图片或放入GPX就会自动读取。

## Recommended Changes When Implementation Is Requested

1. 保持三个任务点：更新 route.js 轨迹、索引、距离及标注；更新 stations.js 点位资料；根据身份策略决定是否更新 qr-tags.js。
2. 起终点目前取轨迹首尾；不同位置需剪裁/重排正确轨迹，或后续增加显式端点配置。
3. 改变任务数量：单独改造为配置驱动，移除三个任务点上限、完成条件、百分比、marker ID 与 UI 文案中的固定值。
4. 新活动/新路线：安排本机进度隔离、二维码策略、路线版本和云端活动配置同步。
5. 经常维护：后续增加离线 GPX 导入与配置校验工具，集中管理轨迹、点位、二维码、距离和版本。这是建议，当前未实现。

## Project Structure

```text
specs/007-route-maintenance/
  spec.md, plan.md, research.md, data-model.md, quickstart.md
  contracts/route-change.md
  source/route-20261011.kmz
  tasks.md, checklists/requirements.md
miniprogram/utils/
  route-20261011.js, route.js, stations.js, progress.js, config.js
```

## Post-Design Constitution Check

PASS。最新授权允许实施本地代码；不操作云端数据库、不发布小程序。真机与现场验收不能用静态测试代替。

## Implementation Decisions (2026-10-11)

- route-20261011.js 保存源轨迹、分段起始索引 [0,67]、五点坐标、最近正确阶段索引 [70,180,227]、元数据总里程及分段里程；源码 KMZ 放在 specs 中，不打包照片进小程序。
- 地图与 H5 分段绘制，不连接 7 米录制间隙；打卡 marker 用标注坐标，最近轨迹索引用于顺序和累计距离。
- 地图起终点相距约 6 米，使用不同 label 偏移避免覆盖；标记坐标保持原位置。
- ROUTE_ID 为 route-20261011，ROUTE_VERSION 为 route-20261011-v1；本机键使用路线 ID 隔离，旧 v3 数据保持原样。
- 开发活动 ID 为 health-run-2026-event02，云环境 ID 沿用。版本和活动 ID 同步到本地 activity.example.json；用户需更新已部署函数 ACTIVITY_CONFIG 后才能收集新路线名单。
- 正式目标已写入正式环境配置，云函数部署与发布验收仍待完成。二维码 payload 和三个照片打卡点保持不变。

## 白屏兼容性修复

开发者工具3.17.4报module utils/route-20261011.json.js未定义，导致App与首页未注册。JSON require被当成JavaScript路径解析，Node测试不能覆盖此行为。规范化路线已改为route-20261011.js并用module.exports导出，所有357坐标不变。新增JS-only加载器回归，验证App启动、首页初始化，保留真实体验版地图验收要求。
