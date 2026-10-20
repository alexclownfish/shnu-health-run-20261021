const crypto = require('node:crypto')

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/
const point = (value) => typeof value === 'string' && /^\d{3}$/.test(value)
const timestamp = (value) => Number.isSafeInteger(value) && value > 0
const reject = (reasonCode) => ({ ok: false, reasonCode })

function checkConfig(config) {
  if (!config || !['test', 'production'].includes(config.mode) ||
    !ID_PATTERN.test(config.activityId || '') || !ID_PATTERN.test(config.routeVersion || '') ||
    typeof config.environmentId !== 'string' || !config.environmentId ||
    !/^wx[A-Za-z0-9]+$/.test(config.appId || '') ||
    typeof config.title !== 'string' || !config.title.trim() || config.title.length > 100 ||
    !Array.isArray(config.requiredPoints) || !config.requiredPoints.length ||
    config.requiredPoints.length > 100 || !config.requiredPoints.every(point) ||
    new Set(config.requiredPoints).size !== config.requiredPoints.length ||
    !point(config.startPointCode) || !point(config.finishPointCode) ||
    config.startPointCode === config.finishPointCode ||
    config.requiredPoints.includes(config.startPointCode) || config.requiredPoints.includes(config.finishPointCode) ||
    !timestamp(config.startsAt) || !timestamp(config.endsAt) || !timestamp(config.reportingClosesAt) ||
    config.endsAt <= config.startsAt || config.reportingClosesAt < config.endsAt ||
    !Array.isArray(config.excludedOpenIds) ||
    !config.excludedOpenIds.every((id) => typeof id === 'string' && id.length > 0) ||
    (config.mode === 'production' && config.excludedOpenIds.length === 0)) return reject('CONFIG_INVALID')
  try { new Intl.DateTimeFormat('en', { timeZone: config.timeZone || 'Asia/Shanghai' }) } catch (error) {
    return reject('CONFIG_INVALID')
  }
  return { ok: true }
}

function recordId(activityId, openId) {
  return crypto.createHash('sha256').update(JSON.stringify([activityId, openId])).digest('hex')
}

function validatePayload(value, config, now) {
  const payload = value && typeof value === 'object' ? value : {}
  if (payload.activityId !== config.activityId || payload.routeVersion !== config.routeVersion) {
    return reject('ACTIVITY_NOT_ALLOWED')
  }
  const expectedVersions = config.mode === 'production' ? ['release'] : ['develop', 'trial']
  if (!expectedVersions.includes(payload.clientEnvVersion)) return reject('BUILD_NOT_ALLOWED')
  if (typeof payload.nickName !== 'string' || !payload.nickName.trim() || payload.nickName.length > 80 ||
    !timestamp(payload.startedAt) || !timestamp(payload.completedAt) ||
    payload.completedAt < payload.startedAt ||
    payload.startedAt < config.startsAt || payload.completedAt > config.endsAt ||
    payload.completedAt > now + 30000 ||
    payload.startPointCode !== config.startPointCode || payload.finishPointCode !== config.finishPointCode ||
    !Array.isArray(payload.completedPointCodes) ||
    payload.completedPointCodes.length !== config.requiredPoints.length ||
    !payload.completedPointCodes.every((code, index) => code === config.requiredPoints[index])) {
    return reject('INVALID_PAYLOAD')
  }
  return { ok: true }
}

function prepareRecord(payload, context, config, now = Date.now()) {
  if (!config || config.enabled !== true) return reject('REPORTING_DISABLED')
  const checked = checkConfig(config)
  if (!checked.ok) return checked
  const sources = config.mode === 'production' ? ['wx_client'] : ['wx_client', 'wx_devtools']
  if (!context || typeof context.OPENID !== 'string' || !context.OPENID ||
    context.APPID !== config.appId || !sources.includes(context.SOURCE)) {
    return reject('IDENTITY_REQUIRED')
  }
  if (context.ENV !== config.environmentId) return reject('ENVIRONMENT_NOT_ALLOWED')
  if (config.excludedOpenIds.includes(context.OPENID)) return reject('EXCLUDED_DEVELOPER')
  const validated = validatePayload(payload, config, now)
  if (!validated.ok) return validated
  if (now < config.startsAt || now > config.reportingClosesAt) return reject('REPORTING_CLOSED')
  const id = recordId(config.activityId, context.OPENID)
  return {
    ok: true,
    // Both environments use the same collection name in the new app.
    collection: 'finishers',
    record: {
      _id: id,
      schemaVersion: 1,
      mode: config.mode,
      environmentId: config.environmentId,
      ownerOpenId: context.OPENID,
      participantId: id.slice(0, 16),
      activityId: config.activityId,
      title: config.title,
      routeVersion: config.routeVersion,
      nickName: payload.nickName.trim(),
      clientEnvVersion: payload.clientEnvVersion,
      startedAt: payload.startedAt,
      completedAt: payload.completedAt,
      durationMs: payload.completedAt - payload.startedAt,
      completedPointCodes: payload.completedPointCodes.slice(),
      startPointCode: payload.startPointCode,
      finishPointCode: payload.finishPointCode,
      receivedAt: now,
      assurance: 'CLIENT_REPORTED_COMPLETION'
    }
  }
}

function matchesActivityTitle(title, config) {
  // Preserve existing records when correcting this activity's display name.
  return title === config.title ||
    (config.activityId === 'health-run-2026-event02' &&
      config.title === '步履拾光·健康同行' && title === '步履时光·健康同行')
}

function validStoredRecord(record, config, cutoff) {
  if (!record || record.schemaVersion !== 1 || record.mode !== config.mode ||
    record.environmentId !== config.environmentId || !matchesActivityTitle(record.title, config) ||
    typeof record.ownerOpenId !== 'string' || !record.ownerOpenId ||
    config.excludedOpenIds.includes(record.ownerOpenId) ||
    record._id !== recordId(config.activityId, record.ownerOpenId) ||
    record.participantId !== record._id.slice(0, 16) ||
    record.assurance !== 'CLIENT_REPORTED_COMPLETION' ||
    !timestamp(record.receivedAt) || record.receivedAt < config.startsAt ||
    record.receivedAt > config.reportingClosesAt || record.receivedAt > cutoff ||
    record.durationMs !== record.completedAt - record.startedAt) return false
  return validatePayload(record, config, record.receivedAt).ok
}

module.exports = { checkConfig, recordId, prepareRecord, validStoredRecord }
