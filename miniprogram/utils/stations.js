const routeData = require('./route')

function distanceLabel(index) {
  const km = routeData.TASK_DISTANCE_KM[index]
  return km < 1 ? `约 ${Math.round(km * 1000 / 10) * 10} m` : `约 ${km.toFixed(2)} km`
}

const stations = [
  {
    id: 1,
    title: '起步站：托球平衡挑战',
    location: routeData.CHECKPOINTS[0].name,
    distance: distanceLabel(0),
    sourceMarker: '1',
    tag: '起步站',
    success: '起步站已完成，继续沿路线前往途中站。'
  },
  {
    id: 2,
    title: '途中站：快乐燃动锤',
    location: routeData.CHECKPOINTS[1].name,
    distance: distanceLabel(1),
    sourceMarker: '2',
    tag: '途中站',
    success: '途中站已完成，继续前往终点站。'
  },
  {
    id: 3,
    title: '终点站：趣味翻翻乐',
    location: routeData.CHECKPOINTS[2].name,
    distance: distanceLabel(2),
    sourceMarker: '3',
    tag: '终点站',
    success: '终点站任务已完成，继续前往终点扫码结束计时。'
  }
]

module.exports = stations
