const config = require('./config')
const progressStore = require('./progress')
const userStore = require('./user')
const { QR_TAGS } = require('./qr-tags')

const OUTBOX_KEY = 'health-run-completion-outbox-v1'
const RETRYABLE = ['SERVICE_UNAVAILABLE', 'REPORTING_DISABLED', 'CONFIG_INVALID', 'ACTIVITY_NOT_ALLOWED', 'RESPONSE_INCOMPLETE']

function createReporter(options = {}) {
  const getWx = options.getWx || (() => typeof wx === 'undefined' ? null : wx)
  const getConfig = options.getConfig || (() => config.completionReporting)
  const getProgress = options.getProgress || progressStore.readProgress
  const getUser = options.getUser || userStore.readUser
  const finished = options.isFinished || progressStore.isFinished
  const saveParticipantId = options.saveParticipantId || progressStore.saveParticipantId
  const now = options.now || Date.now
  let inFlight = null
  let initializedEnv = ''

  function context() {
    const settings = getConfig()
    const api = getWx()
    if (!settings || !settings.enabled || !api || typeof api.getAccountInfoSync !== 'function') return null
    let version
    try { version = api.getAccountInfoSync().miniProgram.envVersion } catch (error) { return null }
    if (!['develop', 'trial', 'release'].includes(version)) return null
    const mode = version === 'release' ? 'production' : 'test'
    const target = settings.targets && settings.targets[mode]
    const other = settings.targets && settings.targets[mode === 'test' ? 'production' : 'test']
    if (!target || target.enabled !== true || !target.envId || !other || !other.envId || target.envId === other.envId ||
      !target.activityId || !target.routeVersion) return null
    return {
      mode,
      envId: target.envId,
      activityId: target.activityId,
      routeVersion: target.routeVersion,
      clientEnvVersion: version
    }
  }

  function queue() {
    try {
      const entries = getWx().getStorageSync(OUTBOX_KEY)
      return Array.isArray(entries) ? entries : []
    } catch (error) { return [] }
  }

  function save(entries) { getWx().setStorageSync(OUTBOX_KEY, entries) }

  function sameTarget(left, right) {
    return left && right && ['mode', 'envId', 'activityId', 'routeVersion'].every((key) => left[key] === right[key])
  }

  function enqueue(value = getProgress()) {
    const active = context()
    const bound = value && value.reportingContext
    if (!active || !sameTarget(active, bound) || !finished(value)) return false
    // Never relabel an old develop/trial run as a production run after upgrading.
    if ((bound.clientEnvVersion === 'release') !== (active.clientEnvVersion === 'release')) return false
    const points = QR_TAGS.filter((item) => item.checkpointType === 'station').sort((a, b) => a.stationIndex - b.stationIndex)
    if (!points.every((item) => {
      const checkin = value.checkins && value.checkins[String(item.stationIndex)]
      return checkin && checkin.pointCode === item.pointCode && checkin.qrId === item.qrId &&
        value.photos && value.photos[String(item.stationIndex)]
    })) return false
    const key = JSON.stringify([bound.envId, bound.activityId, bound.routeVersion, value.startedAt])
    const entries = queue()
    if (entries.some((entry) => entry.key === key)) return true
    entries.push({
      key,
      target: { ...bound },
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
      payload: {
        activityId: bound.activityId,
        routeVersion: bound.routeVersion,
        clientEnvVersion: bound.clientEnvVersion,
        nickName: (getUser().nickName || '').slice(0, 80),
        startedAt: value.startedAt,
        completedAt: value.completedAt,
        completedPointCodes: points.map((item) => item.pointCode),
        startPointCode: value.startCheckIn.pointCode,
        finishPointCode: value.finishCheckIn.pointCode
      }
    })
    save(entries)
    return true
  }

  async function flush() {
    // App startup and the certificate page must await the same upload receipt.
    if (inFlight) return inFlight
    const active = context()
    const api = getWx()
    if (!active || !api.cloud || typeof api.cloud.callFunction !== 'function') return
    inFlight = Promise.resolve().then(() => send(active, api)).finally(() => { inFlight = null })
    return inFlight
  }

  async function send(active, api) {
    try {
      if (initializedEnv !== active.envId) {
        api.cloud.init({ env: active.envId, traceUser: false })
        initializedEnv = active.envId
      }
      // A stale cloud ACTIVITY_CONFIG can reject a valid new-route record. Once the
      // operator aligns the cloud config, allow that frozen record to be sent again.
      const entriesBeforeFlush = queue()
      let recovered = false
      entriesBeforeFlush.forEach((entry) => {
        if (entry && sameTarget(entry.target, active) && entry.status === 'blocked' &&
          entry.reasonCode === 'ACTIVITY_NOT_ALLOWED') {
          entry.status = 'pending'
          entry.nextAttemptAt = 0
          recovered = true
        }
      })
      if (recovered) save(entriesBeforeFlush)

      // Select one immutable item at a time; reload before saving to preserve newly queued finishes.
      const eligible = queue().filter((entry) => entry && sameTarget(entry.target, active) &&
        entry.status === 'pending' && entry.nextAttemptAt <= now())
      for (const entry of eligible) {
        let result
        try {
          result = (await api.cloud.callFunction({
            name: getConfig().functionName || 'submitCompletion',
            config: { env: active.envId },
            data: entry.payload
          })).result
        } catch (error) { result = { ok: false, reasonCode: 'SERVICE_UNAVAILABLE' } }
        const entries = queue()
        const current = entries.find((item) => item.key === entry.key)
        if (!current) continue
        if (result && result.ok === true && ['accepted', 'alreadyAccepted'].includes(result.status)) {
          if (typeof result.participantId === 'string' && result.participantId) {
            try { saveParticipantId(result.participantId) } catch (error) { /* Keep upload success independent of local display storage. */ }
            save(entries.filter((item) => item.key !== entry.key))
          } else {
            current.attempts += 1
            current.reasonCode = 'RESPONSE_INCOMPLETE'
            current.status = 'pending'
            current.nextAttemptAt = now()
            save(entries)
          }
        } else if (result && result.reasonCode === 'EXCLUDED_DEVELOPER') {
          save(entries.filter((item) => item.key !== entry.key))
        } else {
          current.attempts += 1
          current.reasonCode = result && result.reasonCode || 'SERVICE_UNAVAILABLE'
          current.status = RETRYABLE.includes(current.reasonCode) ? 'pending' : 'blocked'
          current.nextAttemptAt = now() + Math.min(3600000, 60000 * Math.pow(2, Math.min(current.attempts - 1, 6)))
          save(entries)
        }
      }
    } catch (error) { /* Cloud setup failures must not block the local route. */ }
  }

  function report(value) {
    try { enqueue(value) } catch (error) { /* Local certificate remains available if storage is full. */ }
    return flush()
  }

  return { captureContext: context, enqueue, flush, report }
}

module.exports = { ...createReporter(), createReporter, OUTBOX_KEY }
