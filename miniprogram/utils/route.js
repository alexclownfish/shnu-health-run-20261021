// Original KML coordinates are kept separately from the GCJ-02 map output.
const routeSource = require('./route-20261011')
const ROUTE_ID = routeSource.routeId
const ROUTE_VERSION = routeSource.routeVersion
const TRACK = routeSource.track
const BOUNDS = routeSource.bounds
const CHECKPOINTS = routeSource.checkpoints
const SEGMENT_STARTS = routeSource.segmentStarts

const REFERENCE_FRAME = {
  width: 1206,
  height: 695,
  minX: 153,
  maxX: 1113,
  minY: 84,
  maxY: 546
}

const TASK_TRACK_INDEX = CHECKPOINTS.map((point) => point.trackIndex)
const TASK_DISTANCE_KM = CHECKPOINTS.map((point) => point.distanceKm)
// The KMZ's measured geometry is retained in source.distanceMeters.  The
// event advertises a 3.5 km route, so all participant-facing totals use the
// explicit activity distance while the original track and checkpoint order
// remain unchanged.
const TOTAL_DISTANCE_KM = (routeSource.source.activityDistanceMeters || routeSource.source.distanceMeters) / 1000
const PI = Math.PI
const AXIS = 6378245.0
const EE = 0.00669342162296594323

function outOfChina(lat, lon) {
  return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  ret += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3
  ret += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3
  return ret
}

function transformLon(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  ret += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3
  ret += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3
  return ret
}

function wgs84ToGcj02(lat, lon) {
  if (outOfChina(lat, lon)) return { latitude: lat, longitude: lon }
  const dLat = transformLat(lon - 105, lat - 35)
  const dLon = transformLon(lon - 105, lat - 35)
  const radLat = lat / 180 * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  return {
    latitude: lat + dLat * 180 / ((AXIS * (1 - EE)) / (magic * sqrtMagic) * PI),
    longitude: lon + dLon * 180 / (AXIS / sqrtMagic * Math.cos(radLat) * PI)
  }
}

function getMapPoints() {
  return TRACK.map(([, lat, lon]) => wgs84ToGcj02(lat, lon))
}

function getMapSegments() {
  const points = getMapPoints()
  return SEGMENT_STARTS.map((start, index) => (
    points.slice(start, SEGMENT_STARTS[index + 1] || points.length)
  ))
}

function getMapCenter() {
  const points = getMapPoints()
  const latitudes = points.map((point) => point.latitude)
  const longitudes = points.map((point) => point.longitude)
  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2
  }
}

function getMapMarkers(completed = 0) {
  const points = getMapPoints()
  const markers = [{
    id: 0,
    ...points[0],
    label: { content: 'S', color: '#ffffff', fontSize: 12, bgColor: '#21b9d2', borderColor: '#ffffff', borderWidth: 2, borderRadius: 24, padding: 7, anchorX: -38, anchorY: -24 }
  }]
  CHECKPOINTS.forEach((checkpoint, index) => {
    const point = wgs84ToGcj02(checkpoint.latitude, checkpoint.longitude)
    const done = index < completed
    const current = index === completed && completed < 3
    markers.push({
      id: index + 1,
      ...point,
      label: {
        content: done ? '✓' : String(index + 1),
        color: done || current ? '#ffffff' : '#073b67',
        fontSize: 12,
        bgColor: done ? '#0058a5' : current ? '#ffd22e' : '#ffffff',
        borderColor: '#ffffff',
        borderWidth: 2,
        borderRadius: 24,
        padding: 7,
        anchorX: -12,
        anchorY: -24
      },
      callout: current ? {
        content: checkpoint.name,
        color: '#0058a5',
        fontSize: 11,
        borderRadius: 8,
        bgColor: '#ffffff',
        padding: 5,
        display: 'ALWAYS'
      } : undefined
    })
  })
  const finishPoint = points[points.length - 1]
  markers.push({
    id: 4,
    ...finishPoint,
    label: {
      content: 'F',
      color: '#ffffff',
      fontSize: 12,
      bgColor: '#0058a5',
      borderColor: '#ffffff',
      borderWidth: 2,
      borderRadius: 24,
      padding: 7,
      anchorX: 8,
      anchorY: -24
    }
  })
  return markers
}

function projectPoint(lat, lon, width = 360, height = 240) {
  return [
    ((REFERENCE_FRAME.minX + (lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon) * (REFERENCE_FRAME.maxX - REFERENCE_FRAME.minX)) / REFERENCE_FRAME.width) * width,
    ((REFERENCE_FRAME.maxY - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat) * (REFERENCE_FRAME.maxY - REFERENCE_FRAME.minY)) / REFERENCE_FRAME.height) * height
  ]
}

function getProjectedTrack(width = 360, height = 240) {
  return TRACK.map(([, lat, lon]) => projectPoint(lat, lon, width, height))
}

function getTaskMarkers(width = 360, height = 240) {
  return CHECKPOINTS.map((point, index) => {
    const [x, y] = projectPoint(point.latitude, point.longitude, width, height)
    return {
      label: String(index + 1),
      sourceLabel: String(index + 1),
      x,
      y
    }
  })
}

module.exports = {
  ROUTE_ID,
  ROUTE_VERSION,
  CHECKPOINTS,
  SEGMENT_STARTS,
  TRACK,
  BOUNDS,
  REFERENCE_FRAME,
  TASK_TRACK_INDEX,
  TASK_DISTANCE_KM,
  TOTAL_DISTANCE_KM,
  projectPoint,
  getProjectedTrack,
  getTaskMarkers,
  wgs84ToGcj02,
  getMapPoints,
  getMapSegments,
  getMapCenter,
  getMapMarkers
}
