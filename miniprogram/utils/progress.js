const { QR_TAGS } = require('./qr-tags')
const routeData = require('./route')
// Each route starts fresh; previous route records remain under their original keys.
const KEY = `patchwalk-progress-v4-${routeData.ROUTE_ID}`
const ROUTE_DISTANCE = routeData.TASK_DISTANCE_KM

function defaultProgress() {
  return {
    completed: 0,
    startedAt: 0,
    completedAt: 0,
    startCheckIn: null,
    finishCheckIn: null,
    participantId: '',
    reportingContext: null,
    checkins: {},
    photos: {},
    history: [],
    routeId: routeData.ROUTE_ID
  }
}

function normalizeProgress(value) {
  const source = value && typeof value === 'object' ? value : {}
  const completed = Number.isFinite(Number(source.completed))
    ? Math.min(Math.max(Math.floor(Number(source.completed)), 0), 3)
    : 0
  return {
    completed,
    startedAt: Number(source.startedAt) || 0,
    completedAt: Number(source.completedAt) || 0,
    startCheckIn: source.startCheckIn && typeof source.startCheckIn === 'object' ? source.startCheckIn : null,
    finishCheckIn: source.finishCheckIn && typeof source.finishCheckIn === 'object' ? source.finishCheckIn : null,
    participantId: typeof source.participantId === 'string' ? source.participantId : '',
    reportingContext: source.reportingContext && typeof source.reportingContext === 'object' ? source.reportingContext : null,
    checkins: source.checkins && typeof source.checkins === 'object' ? source.checkins : {},
    photos: source.photos && typeof source.photos === 'object' ? source.photos : {},
    history: Array.isArray(source.history) ? source.history : [],
    routeId: source.routeId || routeData.ROUTE_ID
  }
}

function readProgress() {
  try {
    return normalizeProgress(wx.getStorageSync(KEY))
  } catch (error) {
    return defaultProgress()
  }
}

function saveProgress(value) {
  const next = normalizeProgress(value)
  wx.setStorageSync(KEY, next)
  return next
}

function ensureProgress() {
  const current = readProgress()
  return saveProgress(current)
}

function matchesCheckpoint(metadata, type, stationIndex) {
  return Boolean(metadata && metadata.assurance === 'LOCAL_QR_MATCH' && QR_TAGS.some((item) => (
    item.enabled !== false && item.checkpointType === type &&
    (type !== 'station' || item.stationIndex === stationIndex) &&
    item.qrId === metadata.qrId && item.pointCode === metadata.pointCode
  )))
}

function checkpointEvidence(metadata, fallbackAt = Date.now()) {
  const evidence = metadata && typeof metadata === 'object' ? metadata : {}
  return {
    at: Number.isFinite(Number(evidence.observedAt)) && Number(evidence.observedAt) > 0
      ? Number(evidence.observedAt) : fallbackAt,
    source: 'qr-code',
    qrId: typeof evidence.qrId === 'string' ? evidence.qrId : '',
    pointCode: typeof evidence.pointCode === 'string' ? evidence.pointCode : '',
    assurance: typeof evidence.assurance === 'string' ? evidence.assurance : 'LOCAL_QR_MATCH'
  }
}

function startCheckIn(metadata = {}) {
  const current = readProgress()
  if (!matchesCheckpoint(metadata, 'start')) return current
  if (current.startedAt || current.completed > 0 || current.completedAt) return current
  const evidence = checkpointEvidence(metadata)
  current.startedAt = evidence.at
  current.startCheckIn = evidence
  current.reportingContext = metadata.reportingContext && typeof metadata.reportingContext === 'object'
    ? { ...metadata.reportingContext } : null
  return saveProgress(current)
}

function checkInStation(index, source = 'qr-code', metadata = {}) {
  const current = readProgress()
  const safeIndex = Number(index)
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex > 2 ||
    source !== 'qr-code' || !matchesCheckpoint(metadata, 'station', safeIndex) ||
    !current.startCheckIn || !current.startedAt || safeIndex !== current.completed || current.completedAt) return current
  const key = String(safeIndex)
  const evidence = checkpointEvidence({ ...metadata, source })
  const existing = current.checkins[key]
  const existingQrVerified = existing && existing.at &&
    existing.source === 'qr-code' &&
    typeof existing.qrId === 'string' && existing.qrId &&
    typeof existing.pointCode === 'string' && existing.pointCode &&
    existing.assurance === 'LOCAL_QR_MATCH'
  if (existingQrVerified && hasValidCheckIn(current, safeIndex)) return current
  current.checkins[key] = {
    at: evidence.at,
    source,
    qrId: typeof evidence.qrId === 'string' ? evidence.qrId : '',
    pointCode: typeof evidence.pointCode === 'string' ? evidence.pointCode : '',
    assurance: typeof evidence.assurance === 'string' ? evidence.assurance : 'LOCAL_QR_MATCH'
  }
  return saveProgress(current)
}

function finishCheckIn(metadata = {}) {
  const current = readProgress()
  if (!matchesCheckpoint(metadata, 'finish') || !current.startCheckIn ||
    !current.startedAt || current.completed !== 3 || current.completedAt) return current
  const evidence = checkpointEvidence(metadata)
  if (evidence.at < current.startedAt) return current
  current.completedAt = evidence.at
  current.finishCheckIn = evidence
  return saveProgress(current)
}

function isFinished(value) {
  const current = normalizeProgress(value)
  return current.completed === 3 && current.startedAt > 0 && current.completedAt >= current.startedAt &&
    matchesCheckpoint(current.startCheckIn, 'start') && matchesCheckpoint(current.finishCheckIn, 'finish')
}

function getCurrentCheckpoint(value) {
  const current = normalizeProgress(value)
  if (!current.startedAt || !matchesCheckpoint(current.startCheckIn, 'start')) return { type: 'start' }
  if (isFinished(current)) return null
  if (current.completed === 3) return { type: 'finish' }
  return { type: 'station', stationIndex: current.completed }
}

function hasValidCheckIn(value, index, ttl = 20 * 60 * 1000) {
  const current = normalizeProgress(value)
  const record = current.checkins[String(index)]
  const elapsed = record ? Date.now() - record.at : -1
  return Boolean(current.startedAt && current.startCheckIn && !current.completedAt &&
    record && record.source === 'qr-code' && matchesCheckpoint(record, 'station', Number(index)) &&
    record.at && elapsed >= 0 && elapsed <= ttl)
}

function canUpload(value, index) {
  const current = normalizeProgress(value)
  return Boolean(current.startedAt && current.startCheckIn && !current.completedAt &&
    Number(index) === current.completed && hasValidCheckIn(current, Number(index)))
}

function completeStation(index, photoPath) {
  const current = readProgress()
  const safeIndex = Math.min(Math.max(Number(index) || 0, 0), 2)
  if (!canUpload(current, safeIndex) || !photoPath) return current
  current.photos[String(safeIndex)] = photoPath
  current.completed += 1
  current.checkins[String(safeIndex)] = { ...current.checkins[String(safeIndex)], completedAt: Date.now() }
  const completedAt = Date.now()
  current.history.push({
    routeId: current.routeId,
    station: safeIndex + 1,
    at: completedAt,
    distance: ROUTE_DISTANCE[safeIndex]
  })
  return saveProgress(current)
}

function resetProgress() {
  const next = defaultProgress()
  return saveProgress(next)
}

function saveParticipantId(value) {
  const current = readProgress()
  current.participantId = typeof value === 'string' ? value : ''
  return saveProgress(current)
}

function deriveStats(value) {
  const current = normalizeProgress(value)
  const distance = current.completed === 0
    ? 0
    : current.completed === 3
      ? routeData.TOTAL_DISTANCE_KM
      : ROUTE_DISTANCE[current.completed - 1]
  const durationMinutes = current.startedAt
    ? Math.max(1, Math.ceil(((current.completedAt || Date.now()) - current.startedAt) / 60000))
    : 0
  return {
    energy: current.completed * 40,
    percent: Math.round(current.completed / 3 * 100),
    distance: distance.toFixed(2),
    calories: Math.round(distance * 65),
    durationMinutes,
    points: current.completed
  }
}

module.exports = {
  KEY,
  ROUTE_DISTANCE,
  defaultProgress,
  normalizeProgress,
  readProgress,
  saveProgress,
  ensureProgress,
  startCheckIn,
  checkInStation,
  finishCheckIn,
  isFinished,
  getCurrentCheckpoint,
  hasValidCheckIn,
  canUpload,
  completeStation,
  resetProgress,
  saveParticipantId,
  deriveStats
}
