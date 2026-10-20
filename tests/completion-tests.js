const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const ExcelJS = require('exceljs')
const { checkConfig, prepareRecord, recordId } = require('../cloudfunctions/submitCompletion/policy')
const { submit } = require('../cloudfunctions/submitCompletion/service')
const { createReporter, OUTBOX_KEY } = require('../miniprogram/utils/completion-report')
const progressStore = require('../miniprogram/utils/progress')
const { QR_TAGS } = require('../miniprogram/utils/qr-tags')
const { collectRows, createWorkbook, duration } = require('../tools/export-finishers/export')
const { parseRecords, readRecords, collectLocalRows } = require('../tools/export-finishers/local')
const { main, argumentsFrom, credentialsFrom, describeError, ExportOperationError } = require('../tools/export-finishers')

const START = Date.parse('2026-10-09T08:00:00+08:00')
const NOW = START + 3600000
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const tests = []
const test = (label, callback) => tests.push({ label, callback })
function activity(overrides = {}) {
  return {
    enabled: true, mode: 'production', environmentId: 'prod-env', appId: 'wx9d16b2e04851fc36',
    activityId: 'walk-2026', title: '健康漫步', routeVersion: 'route-01-v1',
    requiredPoints: ['001', '002', '003'], startPointCode: '000', finishPointCode: '999',
    startsAt: START, endsAt: START + 86400000 * 3, reportingClosesAt: START + 86400000 * 4,
    excludedOpenIds: ['developer'], timeZone: 'Asia/Shanghai', ...overrides
  }
}
function payload(overrides = {}) {
  return {
    activityId: 'walk-2026', routeVersion: 'route-01-v1', clientEnvVersion: 'release', nickName: '参与者',
    startedAt: START + 60000, completedAt: NOW - 60000,
    completedPointCodes: ['001', '002', '003'], startPointCode: '000', finishPointCode: '999', ...overrides
  }
}
function identity(overrides = {}) {
  return { OPENID: 'participant', APPID: 'wx9d16b2e04851fc36', ENV: 'prod-env', SOURCE: 'wx_client', ...overrides }
}
function stored(openId = 'participant', changes = {}, config = activity()) {
  return { ...prepareRecord(payload({
    activityId: config.activityId, routeVersion: config.routeVersion,
    clientEnvVersion: config.mode === 'production' ? 'release' : 'trial'
  }), identity({ OPENID: openId, ENV: config.environmentId }), config, NOW).record, ...changes }
}
function memoryRepository() {
  const records = new Map()
  return {
    records,
    async create(collection, record) {
      const key = `${collection}/${record._id}`
      if (records.has(key)) throw new Error('duplicate')
      records.set(key, clone(record))
    },
    async find(collection, id) { return clone(records.get(`${collection}/${id}`)) }
  }
}
function device(version = 'release', existingStorage = {}) {
  const state = {
    version, time: NOW, storage: existingStorage, calls: [], savedParticipantIds: [],
    settings: { enabled: true, functionName: 'submitCompletion', targets: {
      test: { enabled: true, envId: 'test-env', activityId: 'walk-test', routeVersion: 'route-01-v1' },
      production: { enabled: true, envId: 'prod-env', activityId: 'walk-2026', routeVersion: 'route-01-v1' }
    } },
    user: { nickName: '原昵称', avatarUrl: 'private-avatar.jpg' },
    response: async () => ({
      result: {
        ok: true,
        status: 'accepted',
        participantId: recordId('walk-2026', 'participant').slice(0, 16)
      }
    })
  }
  state.api = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: state.version } }),
    getStorageSync: (key) => clone(state.storage[key]),
    setStorageSync: (key, value) => { state.storage[key] = clone(value) },
    cloud: {
      init: (options) => { state.initialized = options },
      callFunction: async (options) => { state.calls.push(clone(options)); return state.response(options) }
    }
  }
  state.reporter = () => createReporter({
    getWx: () => state.api, getConfig: () => state.settings, getUser: () => state.user,
    getProgress: () => state.progress, now: () => state.time,
    saveParticipantId: (value) => state.savedParticipantIds.push(value)
  })
  state.client = state.reporter()
  state.progress = finishedProgress(state.client.captureContext())
  return state
}
function finishedProgress(context) {
  const value = {
    completed: 3, startedAt: START + 60000, completedAt: NOW - 60000,
    reportingContext: context, checkins: {}, photos: {},
    startCheckIn: { ...QR_TAGS[0], assurance: 'LOCAL_QR_MATCH' },
    finishCheckIn: { ...QR_TAGS[4], assurance: 'LOCAL_QR_MATCH' }
  }
  for (const point of QR_TAGS.filter((item) => item.checkpointType === 'station')) {
    value.checkins[point.stationIndex] = { ...point, assurance: 'LOCAL_QR_MATCH' }
    value.photos[point.stationIndex] = 'private-photo.jpg'
  }
  return value
}
function fetcher(records) {
  const ordered = records.slice().sort((a, b) => a._id.localeCompare(b._id))
  return async ({ cursor, limit }) => ordered.filter((row) => row._id > cursor).slice(0, limit)
}

test('server fails closed with absent, disabled, invalid or ambiguous configuration', () => {
  assert.equal(prepareRecord(payload(), identity(), null, NOW).reasonCode, 'REPORTING_DISABLED')
  assert.equal(prepareRecord(payload(), identity(), activity({ enabled: false }), NOW).reasonCode, 'REPORTING_DISABLED')
  for (const changes of [
    { excludedOpenIds: [] }, { requiredPoints: ['001', '001'] }, { startsAt: 0 },
    { reportingClosesAt: START }, { finishPointCode: '001' }, { timeZone: 'Invalid/Zone' }, { mode: 'unknown' }
  ]) assert.equal(checkConfig(activity(changes)).ok, false)
})
test('trusted identity, app and actual cloud environment are required', () => {
  for (const changes of [{ OPENID: '' }, { OPENID: 123 }, { APPID: 'wxother' }, { SOURCE: 'wx_http' }, { SOURCE: 'wx_devtools' }]) {
    assert.equal(prepareRecord(payload(), identity(changes), activity(), NOW).reasonCode, 'IDENTITY_REQUIRED')
  }
  assert.equal(prepareRecord(payload(), identity({ ENV: 'test-env' }), activity(), NOW).reasonCode, 'ENVIRONMENT_NOT_ALLOWED')
  assert.equal(prepareRecord(payload({ ownerOpenId: 'developer' }), identity(), activity(), NOW).record.ownerOpenId, 'participant')
})
test('test environment permits DevTools only with a trusted account and test build', () => {
  const config = activity({ mode: 'test', environmentId: 'test-env', excludedOpenIds: [] })
  const context = identity({ ENV: 'test-env', SOURCE: 'wx_devtools' })
  const result = prepareRecord(payload({ clientEnvVersion: 'trial' }), context, config, NOW)
  assert.equal(result.collection, 'finishers')
  assert.equal(prepareRecord(payload(), context, config, NOW).reasonCode, 'BUILD_NOT_ALLOWED')
  assert.equal(prepareRecord(payload({ clientEnvVersion: 'develop' }), { ...context, ENV: 'local' }, config, NOW).ok, false)
})
test('developer exclusion wins even when using a released build', () => {
  assert.equal(prepareRecord(payload(), identity({ OPENID: 'developer' }), activity(), NOW).reasonCode, 'EXCLUDED_DEVELOPER')
})
test('production rejects test builds, wrong activity, route or point sequence', () => {
  for (const changes of [
    { clientEnvVersion: 'develop' }, { clientEnvVersion: 'trial' }, { activityId: 'walk-test' },
    { routeVersion: 'route-02-v1' }, { completedPointCodes: ['003', '002', '001'] },
    { completedPointCodes: ['001', '002'] }, { startPointCode: '001' }, { nickName: 'x'.repeat(81) }
  ]) assert.equal(prepareRecord(payload(changes), identity(), activity(), NOW).ok, false)
})
test('server refuses absent, empty or whitespace nicknames before storing a finisher', async () => {
  for (const nickName of [undefined, null, 123, '', ' \t\n ', '\u3000']) {
    const repository = memoryRepository()
    const result = await submit(payload({ nickName }), identity(), activity(), repository, NOW)
    assert.equal(result.reasonCode, 'INVALID_PAYLOAD')
    assert.equal(repository.records.size, 0)
  }
})
test('event bounds, future clock and reporting deadline reject invalid times', () => {
  for (const changes of [
    { startedAt: START - 1 }, { completedAt: START }, { completedAt: NOW + 30001 },
    { completedAt: activity().endsAt + 1 }, { startedAt: 1.5 }, { completedAt: NaN }
  ]) assert.equal(prepareRecord(payload(changes), identity(), activity(), NOW).ok, false)
  assert.equal(prepareRecord(payload(), identity(), activity(), activity().reportingClosesAt + 1).reasonCode, 'REPORTING_CLOSED')
})
test('summary recomputes duration, strips private fields and derives server participant id', () => {
  const result = prepareRecord(payload({ durationMs: 1, photos: ['secret'], openid: 'spoofed', nickName: '  小王  ' }), identity(), activity(), NOW)
  assert.equal(result.record.durationMs, NOW - START - 120000)
  assert.equal(result.record.nickName, '小王')
  assert.equal(result.record.participantId, recordId('walk-2026', 'participant').slice(0, 16))
  assert.equal(result.record.photos, undefined)
  assert.equal(result.record.openid, undefined)
})
test('accepted completion returns the stable participant id', async () => {
  const repository = memoryRepository()
  const result = await submit(payload(), identity(), activity(), repository, NOW)
  assert.equal(result.participantId, recordId('walk-2026', 'participant').slice(0, 16))
  const duplicate = await submit(payload({ nickName: 'changed' }), identity(), activity(), repository, NOW + 1)
  assert.equal(duplicate.participantId, result.participantId)
})
test('successful client upload stores the returned participant id for the certificate', async () => {
  const state = device()
  await state.client.report(state.progress)
  assert.deepEqual(state.savedParticipantIds, [recordId('walk-2026', 'participant').slice(0, 16)])
  assert.equal(state.storage[OUTBOX_KEY].length, 0)
})
test('activity title correction preserves the existing completion receipt without rewriting it', async () => {
  const previous = activity({ activityId: 'health-run-2026-event02', title: '步履时光·健康同行' })
  const corrected = { ...previous, title: '步履拾光·健康同行' }
  const value = payload({ activityId: previous.activityId })
  const repository = memoryRepository()
  const first = await submit(value, identity(), previous, repository, NOW)
  const originalRecords = clone([...repository.records.values()])
  const retry = await submit(value, identity(), corrected, repository, NOW + 1)
  assert.equal(retry.status, 'alreadyAccepted')
  assert.equal(retry.participantId, first.participantId)
  assert.equal(retry.receivedAt, first.receivedAt)
  assert.deepEqual([...repository.records.values()], originalRecords)
})
test('successful response without participant id stays queued for a later cloud retry', async () => {
  const state = device()
  state.response = async () => ({ result: { ok: true, status: 'accepted' } })
  await state.client.report(state.progress)
  assert.equal(state.storage[OUTBOX_KEY][0].status, 'pending')
  assert.equal(state.storage[OUTBOX_KEY][0].reasonCode, 'RESPONSE_INCOMPLETE')
  state.response = async () => ({ result: { ok: true, status: 'alreadyAccepted', participantId: 'stable-123' } })
  await state.client.flush()
  assert.deepEqual(state.savedParticipantIds, ['stable-123'])
  assert.equal(state.storage[OUTBOX_KEY].length, 0)
})
test('certificate refresh waits for an upload already started by the app', async () => {
  const state = device('trial')
  let resolve
  state.response = () => new Promise((done) => { resolve = done })
  const uploading = state.client.report(state.progress)
  await Promise.resolve()
  let page
  const dependencies = {
    '../../utils/stations': require('../miniprogram/utils/stations'),
    '../../utils/format': require('../miniprogram/utils/format'),
    '../../utils/progress': {
      isFinished: progressStore.isFinished,
      deriveStats: progressStore.deriveStats,
      readProgress: () => ({ ...state.progress, participantId: state.savedParticipantIds[0] || '' })
    },
    '../../utils/user': { readUser: () => state.user },
    '../../utils/completion-report': state.client
  }
  const source = await fs.readFile(path.join(__dirname, '../miniprogram/pages/certificate/certificate.js'), 'utf8')
  vm.runInNewContext(source, {
    Page: (value) => { page = value },
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected page dependency: ${name}`)
      return dependencies[name]
    }
  })
  page.setData = (value) => Object.assign(page.data, value)
  page.onLoad()
  page.onShow()
  assert.equal(page.data.participantId, '')
  assert.equal(state.calls.length, 1)
  resolve({ result: { ok: true, status: 'alreadyAccepted', participantId: 'cbc14e2ed13361c6' } })
  await uploading
  await state.client.flush()
  assert.equal(page.data.participantId, 'cbc14e2ed13361c6')
  assert.equal(state.calls.length, 1)
  assert.equal(state.storage[OUTBOX_KEY].length, 0)
})
test('concurrent requests keep one first-received immutable record', async () => {
  const repository = memoryRepository()
  const results = await Promise.all([
    submit(payload(), identity(), activity(), repository, NOW),
    submit(payload({ nickName: 'changed', completedAt: NOW }), identity(), activity(), repository, NOW + 1)
  ])
  assert.equal(repository.records.size, 1)
  assert.deepEqual(results.map((result) => result.status).sort(), ['accepted', 'alreadyAccepted'])
  assert.equal([...repository.records.values()][0].nickName, '参与者')
  assert.equal(results[0].receivedAt, results[1].receivedAt)
})
test('response loss after insert recovers through lookup; database failures remain retryable', async () => {
  const repository = memoryRepository()
  const create = repository.create
  repository.create = async (...args) => { await create(...args); throw new Error('response lost') }
  assert.equal((await submit(payload(), identity(), activity(), repository, NOW)).status, 'alreadyAccepted')
  assert.equal((await submit(payload(), identity(), activity(), {
    create: async () => { throw new Error('offline') }, find: async () => null
  }, NOW)).reasonCode, 'SERVICE_UNAVAILABLE')
  const corrupt = memoryRepository()
  await corrupt.create('finishers', stored('participant', { schemaVersion: 0 }))
  assert.equal((await submit(payload(), identity(), activity(), corrupt, NOW)).reasonCode, 'SERVICE_UNAVAILABLE')
})
test('each activity/account is separate despite identical nicknames', async () => {
  const repository = memoryRepository()
  for (const user of ['one', 'two']) await submit(payload(), identity({ OPENID: user }), activity(), repository, NOW)
  await submit(payload({ activityId: 'walk-next' }), identity({ OPENID: 'one' }), activity({ activityId: 'walk-next' }), repository, NOW)
  assert.equal(repository.records.size, 3)
})
test('client master switch and target switch fail closed and enforce distinct environments', () => {
  const state = device()
  state.settings.enabled = false
  assert.equal(state.client.captureContext(), null)
  state.settings.enabled = true
  state.settings.targets.production.enabled = false
  assert.equal(state.client.captureContext(), null)
  state.settings.targets.production.enabled = true
  delete state.settings.targets.production.enabled
  assert.equal(state.client.captureContext(), null)
  state.settings.targets.production.enabled = true
  state.settings.targets.test.envId = ''
  assert.equal(state.client.captureContext(), null)
  state.settings.targets.test.envId = 'prod-env'
  assert.equal(state.client.captureContext(), null)
})
test('bundled settings enable test and production reporting independently', async () => {
  const settings = clone(require('../miniprogram/utils/config').completionReporting)
  assert.equal(settings.enabled, true)
  for (const version of ['develop', 'trial']) {
    const state = device(version)
    state.settings = clone(settings)
    const context = state.client.captureContext()
    if (!settings.targets.test.enabled) {
      assert.equal(context, null)
      continue
    }
    state.progress = finishedProgress(context)
    await state.client.report(state.progress)
    assert.equal(state.calls.length, 1)
    assert.equal(state.calls[0].config.env, 'cloud1-d1g886bht0f7cbf69')
  }
  const state = device('release')
  state.settings = clone(settings)
  const context = state.client.captureContext()
  if (!settings.targets.production.enabled) {
    assert.equal(context, null)
    return
  }
  state.progress = finishedProgress(context)
  assert.equal(context.envId, 'shnu-health-run-20261021-dc2d3ff')
  await state.client.report(state.progress)
  assert.equal(state.calls.length, 1)
  assert.equal(state.calls[0].config.env, 'shnu-health-run-20261021-dc2d3ff')
})
test('development template matches bundled client and accepts only its test environment', () => {
  const config = require('../cloudfunctions/submitCompletion/activity.example.json')
  const settings = require('../miniprogram/utils/config').completionReporting
  assert.equal(checkConfig(config).ok, true)
  assert.equal(config.enabled, true)
  assert.equal(config.environmentId, settings.targets.test.envId)
  assert.equal(config.activityId, settings.targets.test.activityId)
  assert.equal(config.routeVersion, settings.targets.test.routeVersion)
  const result = prepareRecord(payload({ activityId: config.activityId, routeVersion: config.routeVersion, clientEnvVersion: 'trial' }),
    identity({ ENV: config.environmentId }), config, NOW)
  assert.equal(result.collection, 'finishers')
  assert.equal(result.ok, true)
  assert.equal(prepareRecord(payload({ activityId: config.activityId, routeVersion: config.routeVersion, clientEnvVersion: 'trial' }),
    identity({ ENV: settings.targets.production.envId }), config, NOW).reasonCode, 'ENVIRONMENT_NOT_ALLOWED')
})
test('develop/trial route to test and release routes to production', () => {
  for (const version of ['develop', 'trial', 'release']) {
    const state = device(version)
    assert.equal(state.client.captureContext().envId, version === 'release' ? 'prod-env' : 'test-env')
  }
  assert.equal(device('unknown').client.captureContext(), null)
})
test('old certificates and incomplete task/photo evidence never enqueue', async () => {
  const state = device()
  for (const mutate of [
    (p) => { p.reportingContext = null }, (p) => { p.completed = 2 },
    (p) => { p.finishCheckIn = null }, (p) => { delete p.checkins[1] },
    (p) => { delete p.photos[2] }, (p) => { p.checkins[0].qrId = 'wrong' }
  ]) {
    const value = clone(state.progress)
    mutate(value)
    assert.equal(state.client.enqueue(value), false)
  }
  await state.client.flush()
  assert.equal(state.calls.length, 0)
})
test('new completion requires a normalized nickname but not an avatar before queueing or cloud upload', async () => {
  for (const user of [null, {}, { nickName: '' }, { nickName: ' \t ' },
    { nickName: ' \n\u3000 ', avatarUrl: 'avatar.jpg' }]) {
    const state = device()
    state.user = user
    assert.equal(state.client.enqueue(), false)
    await state.client.report(state.progress)
    assert.equal(state.storage[OUTBOX_KEY], undefined)
    assert.equal(state.calls.length, 0)
  }
  const state = device()
  state.user = { nickName: '仅姓名', avatarUrl: '' }
  assert.equal(state.client.enqueue(), true)
  await state.client.flush()
  assert.equal(state.calls[0].data.nickName, '仅姓名')
})
test('client normalizes and limits the frozen nickname without uploading the avatar', async () => {
  const state = device()
  state.user = { nickName: `  ${'小'.repeat(81)}  `, avatarUrl: 'private-avatar.jpg' }
  assert.equal(state.client.enqueue(), true)
  const frozen = clone(state.storage[OUTBOX_KEY][0])
  assert.equal(frozen.payload.nickName, '小'.repeat(80))
  state.user = { nickName: '稍后修改', avatarUrl: 'another-avatar.jpg' }
  assert.equal(state.client.enqueue(), true)
  assert.deepEqual(state.storage[OUTBOX_KEY][0], frozen)
  await state.client.flush()
  assert.equal(state.calls[0].data.nickName, '小'.repeat(80))
  assert.deepEqual(Object.keys(state.calls[0].data).sort(), Object.keys(payload()).sort())
  assert.ok(!JSON.stringify(state.calls[0]).includes('avatar'))
})
test('legacy blank-name pending and invalid-payload queues repair only the name', async () => {
  for (const status of ['pending', 'blocked']) {
    const state = device()
    state.client.enqueue()
    const entry = state.storage[OUTBOX_KEY][0]
    entry.payload.nickName = ' \t\n '
    entry.status = status
    entry.attempts = 3
    if (status === 'blocked') {
      entry.reasonCode = 'INVALID_PAYLOAD'
      entry.nextAttemptAt = NOW + 3600000
    }
    const frozen = clone(entry)
    state.user = { nickName: ' \t ', avatarUrl: '' }
    await state.client.flush()
    assert.equal(state.calls.length, 0)
    assert.deepEqual(state.storage[OUTBOX_KEY][0], frozen)
    state.user = { nickName: '  补齐的昵称  ', avatarUrl: '' }
    state.response = async () => {
      const repaired = state.storage[OUTBOX_KEY][0]
      assert.deepEqual(repaired.target, frozen.target)
      assert.equal(repaired.attempts, frozen.attempts)
      assert.equal(repaired.status, 'pending')
      return { result: { ok: true, status: 'accepted', participantId: 'repaired-finisher' } }
    }
    await state.client.flush()
    assert.equal(state.calls.length, 1)
    assert.deepEqual(state.calls[0].data, { ...frozen.payload, nickName: '补齐的昵称' })
    assert.equal(state.calls[0].config.env, frozen.target.envId)
    assert.equal(state.storage[OUTBOX_KEY].length, 0)
  }
})
test('report can repair a legacy blank nickname for the same completed run without creating a duplicate', async () => {
  const state = device()
  state.client.enqueue()
  const entry = state.storage[OUTBOX_KEY][0]
  entry.payload.nickName = ''
  entry.status = 'blocked'
  entry.reasonCode = 'INVALID_PAYLOAD'
  const frozenPayload = clone(entry.payload)
  state.user = { nickName: '  完整资料  ', avatarUrl: 'avatar.jpg' }
  assert.equal(state.client.enqueue(), true)
  assert.equal(state.storage[OUTBOX_KEY].length, 1)
  assert.deepEqual(state.storage[OUTBOX_KEY][0].payload, { ...frozenPayload, nickName: '完整资料' })
  assert.equal(state.storage[OUTBOX_KEY][0].status, 'pending')
  await state.client.flush()
  assert.equal(state.calls.length, 1)
})
test('legacy blank-name queues remain intact when the current finish no longer matches', async () => {
  for (const changed of [
    () => progressStore.defaultProgress(),
    (value) => ({ ...value, startedAt: value.startedAt + 1000 })
  ]) {
    const state = device()
    state.client.enqueue()
    state.storage[OUTBOX_KEY][0].payload.nickName = ''
    const frozen = clone(state.storage[OUTBOX_KEY][0])
    state.progress = changed(state.progress)
    await state.client.flush()
    assert.equal(state.calls.length, 0)
    assert.deepEqual(state.storage[OUTBOX_KEY][0], frozen)
  }
})
test('valid frozen completion still uploads after the current profile has been cleared', async () => {
  const state = device()
  state.client.enqueue()
  state.user = { nickName: '', avatarUrl: '' }
  state.progress = progressStore.defaultProgress()
  await state.client.flush()
  assert.equal(state.calls.length, 1)
  assert.equal(state.calls[0].data.nickName, '原昵称')
  assert.equal(state.storage[OUTBOX_KEY].length, 0)
})
test('client freezes minimal summary once, including original nickname and times', () => {
  const state = device()
  assert.equal(state.client.enqueue(), true)
  state.user.nickName = '新昵称'
  assert.equal(state.client.enqueue(), true)
  const entries = state.storage[OUTBOX_KEY]
  assert.equal(entries.length, 1)
  assert.equal(entries[0].payload.nickName, '原昵称')
  assert.deepEqual(Object.keys(entries[0].payload).sort(), Object.keys(payload()).sort())
  const serialized = JSON.stringify(entries)
  assert.ok(!serialized.includes('private-photo') && !serialized.includes('private-avatar'))
  assert.ok(!serialized.includes(QR_TAGS[1].qrToken))
})
test('successful upload specifies frozen environment and removes only acknowledged item', async () => {
  const state = device()
  await state.client.report(state.progress)
  assert.equal(state.calls[0].config.env, 'prod-env')
  assert.deepEqual(state.initialized, { env: 'prod-env', traceUser: false })
  assert.equal(state.storage[OUTBOX_KEY].length, 0)
})
test('offline retry survives reopening and route reset with exponential backoff', async () => {
  const state = device()
  state.response = async () => { throw new Error('network') }
  await state.client.report(state.progress)
  assert.equal(state.storage[OUTBOX_KEY][0].status, 'pending')
  assert.equal(state.storage[OUTBOX_KEY][0].nextAttemptAt, NOW + 60000)
  state.progress = progressStore.defaultProgress()
  state.client = state.reporter()
  await state.client.flush()
  assert.equal(state.calls.length, 1)
  state.time += 60000
  await state.client.flush()
  assert.equal(state.storage[OUTBOX_KEY][0].nextAttemptAt, NOW + 60000 + 120000)
  state.time += 120000
  state.response = async () => ({ result: {
    ok: true,
    status: 'alreadyAccepted',
    participantId: recordId('walk-2026', 'participant').slice(0, 16)
  } })
  await state.client.flush()
  assert.equal(state.storage[OUTBOX_KEY].length, 0)
})
test('test runs cannot be relabeled or uploaded when switching to release', async () => {
  const state = device('trial')
  state.client.enqueue()
  state.version = 'release'
  assert.equal(state.client.enqueue(), false)
  await state.client.flush()
  assert.equal(state.calls.length, 0)
  state.version = 'trial'
  await state.client.flush()
  assert.equal(state.calls[0].config.env, 'test-env')
})
test('route/activity changes keep an old frozen run from becoming a new event', async () => {
  const state = device()
  state.client.enqueue()
  state.settings.targets.production.activityId = 'new-event'
  assert.equal(state.client.enqueue(), false)
  await state.client.flush()
  assert.equal(state.calls.length, 0)
  assert.equal(state.storage[OUTBOX_KEY][0].payload.activityId, 'walk-2026')
})
test('in-flight flush neither duplicates calls nor loses newly enqueued completion', async () => {
  const state = device()
  let resolve
  state.response = () => new Promise((done) => { resolve = done })
  state.client.enqueue()
  const sending = state.client.flush()
  let certificateRefreshed = false
  const certificateWaiting = state.client.flush().then(() => {
    assert.equal(state.savedParticipantIds.length, 1)
    certificateRefreshed = true
  })
  await Promise.resolve()
  assert.equal(state.calls.length, 1)
  assert.equal(certificateRefreshed, false)
  state.client.enqueue({ ...state.progress, startedAt: state.progress.startedAt + 1000 })
  resolve({ result: {
    ok: true,
    status: 'accepted',
    participantId: recordId('walk-2026', 'participant').slice(0, 16)
  } })
  await sending
  await certificateWaiting
  assert.equal(certificateRefreshed, true)
  assert.equal(state.storage[OUTBOX_KEY].length, 1)
  assert.equal(state.storage[OUTBOX_KEY][0].payload.startedAt, START + 61000)
})
test('permanent errors are retained as blocked; developer exclusions are discarded', async () => {
  const state = device()
  state.response = async () => ({ result: { ok: false, reasonCode: 'INVALID_PAYLOAD' } })
  await state.client.report(state.progress)
  assert.equal(state.storage[OUTBOX_KEY][0].status, 'blocked')
  state.time += 86400000
  await state.client.flush()
  assert.equal(state.calls.length, 1)
  const excluded = device()
  excluded.response = async () => ({ result: { ok: false, reasonCode: 'EXCLUDED_DEVELOPER' } })
  await excluded.client.report(excluded.progress)
  assert.equal(excluded.storage[OUTBOX_KEY].length, 0)
})
test('cloud activity drift retries the frozen completion after config is aligned', async () => {
  const state = device()
  state.response = async () => ({ result: { ok: false, reasonCode: 'ACTIVITY_NOT_ALLOWED' } })
  await state.client.report(state.progress)
  assert.equal(state.storage[OUTBOX_KEY][0].status, 'pending')
  assert.equal(state.storage[OUTBOX_KEY][0].reasonCode, 'ACTIVITY_NOT_ALLOWED')
  state.time += 60000
  state.response = async () => ({ result: {
    ok: true,
    status: 'accepted',
    participantId: recordId('walk-2026', 'participant').slice(0, 16)
  } })
  await state.client.flush()
  assert.equal(state.storage[OUTBOX_KEY].length, 0)
})
test('cloud setup or local storage failure cannot reject the local report operation', async () => {
  const state = device()
  state.api.cloud.init = () => { throw new Error('not supported') }
  await state.client.report(state.progress)
  assert.equal(state.storage[OUTBOX_KEY].length, 1)
  state.api.setStorageSync = () => { throw new Error('full') }
  await state.client.report({ ...state.progress, startedAt: START + 62000 })
})
test('start binding remains frozen through normalizer, duplicate scan and reset', () => {
  const state = device()
  global.wx = state.api
  try {
    progressStore.resetProgress()
    const context = state.client.captureContext()
    progressStore.startCheckIn({ ...QR_TAGS[0], assurance: 'LOCAL_QR_MATCH', reportingContext: context, observedAt: START })
    context.activityId = 'mutated'
    const saved = progressStore.startCheckIn({ ...QR_TAGS[0], assurance: 'LOCAL_QR_MATCH', reportingContext: null })
    assert.equal(saved.reportingContext.activityId, 'walk-2026')
    state.client.enqueue(state.progress)
    progressStore.resetProgress()
    assert.equal(progressStore.readProgress().reportingContext, null)
    assert.equal(state.storage[OUTBOX_KEY].length, 1)
  } finally { delete global.wx }
})
test('export keyset pagination collects over 100 records without truncation', async () => {
  const records = Array.from({ length: 205 }, (_, index) => stored(`user-${index}`))
  const result = await collectRows(fetcher(records), activity(), NOW)
  assert.equal(result.rows.length, 205)
  assert.equal(result.examined, 205)
  assert.equal(result.excluded, 0)
})
test('export excludes wrong environment, developer, schema, route, identity and clock', async () => {
  const changes = [
    { mode: 'test' }, { environmentId: 'test-env' }, { routeVersion: 'old' },
    { schemaVersion: 0 }, { title: 'other' }, { durationMs: 1 }, { clientEnvVersion: 'trial' },
    { receivedAt: NOW + 1 }, { activityId: 'old-event' }, { participantId: 'spoofed' },
    { ownerOpenId: 'developer' }, { assurance: 'VERIFIED' }, { completedPointCodes: ['001'] }
  ]
  const records = changes.map((change, index) => stored(`dirty-${index}`, change))
  records.push(stored('developer', {}, activity({ excludedOpenIds: ['another-developer'] })))
  records.push(stored())
  const result = await collectRows(fetcher(records), activity(), NOW, 3)
  assert.equal(result.rows.length, 1)
  assert.equal(result.excluded, changes.length + 1)
})
test('export refuses unstable/repeated pagination instead of silently omitting people', async () => {
  await assert.rejects(() => collectRows(async () => [stored(), stored()], activity(), NOW, 2), /CURSOR/)
  await assert.rejects(() => collectRows(async () => null, activity(), NOW), /PAGE/)
})
test('corrected activity exports old and new title records using the corrected display name only', async () => {
  const previous = activity({ activityId: 'health-run-2026-event02', title: '步履时光·健康同行' })
  const corrected = { ...previous, title: '步履拾光·健康同行' }
  const legacy = stored('before-correction', {}, previous)
  const records = [legacy, stored('after-correction', {}, corrected),
    stored('unrelated-title', { title: '其他活动' }, corrected)]
  const result = await collectRows(fetcher(records), corrected, NOW)
  assert.equal(result.rows.length, 2)
  assert.equal(result.excluded, 1)
  assert.deepEqual(collectLocalRows(records, corrected, NOW), result)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await createWorkbook(result, corrected, NOW).xlsx.writeBuffer())
  const sheet = workbook.getWorksheet('完赛名单')
  assert.equal(sheet.getCell('B2').value, corrected.title)
  assert.equal(sheet.getCell('B3').value, corrected.title)
  assert.equal(legacy.title, previous.title)

  const anotherActivity = activity({ title: corrected.title })
  assert.equal(collectLocalRows([stored('another-activity', { title: previous.title }, anotherActivity)],
    anotherActivity, NOW).rows.length, 0)
})
test('real XLSX roundtrip keeps formulas as text, Chinese and long duration while excluding missing names', async () => {
  const config = activity()
  const late = START + 25 * 3600000 + 60000
  const records = [
    stored('formula', { nickName: '=HYPERLINK("https://example.com")' }),
    stored('empty', { nickName: '' }),
    prepareRecord(payload({ nickName: '小李', completedAt: late }), identity({ OPENID: 'long' }), config, late).record
  ]
  const result = await collectRows(fetcher(records), config, late)
  const loaded = new ExcelJS.Workbook()
  await loaded.xlsx.load(await createWorkbook(result, config, late).xlsx.writeBuffer())
  const sheet = loaded.getWorksheet('完赛名单')
  assert.equal(result.excluded, 1)
  assert.equal(sheet.rowCount, 3)
  const nicknames = [2, 3].map((row) => sheet.getCell(`F${row}`).value)
  assert.ok(nicknames.includes('小李'))
  assert.ok(!nicknames.includes('未填写姓名'))
  assert.ok(nicknames.includes('=HYPERLINK("https://example.com")'))
  for (const row of [2, 3]) assert.equal(sheet.getCell(`F${row}`).type, ExcelJS.ValueType.String)
  assert.ok([2, 3].some((row) => sheet.getCell(`I${row}`).value === '25:00:00'))
  assert.equal(duration(100 * 3600000), '100:00:00')
  assert.ok(!JSON.stringify(sheet.getSheetValues()).includes('ownerOpenId'))
  assert.equal(loaded.getWorksheet('导出说明').getCell('B5').value, 2)
})
test('empty export still produces headers and test workbook identifies test data', async () => {
  const result = await collectRows(fetcher([]), activity(), NOW)
  const loaded = new ExcelJS.Workbook()
  const config = activity({ mode: 'test', excludedOpenIds: [] })
  await loaded.xlsx.load(await createWorkbook(result, config, NOW, { preview: true }).xlsx.writeBuffer())
  assert.equal(loaded.getWorksheet('测试名单').rowCount, 1)
  assert.equal(loaded.getWorksheet('导出说明').getCell('B5').value, 0)
})
test('CLI requires explicit test export, closed reporting window, valid options and credentials', async () => {
  assert.throws(() => argumentsFrom(['--bad']), /参数无效/)
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'health-run-export-test-'))
  const configFile = path.join(temporary, 'activity.json')
  try {
    await fs.writeFile(configFile, JSON.stringify(activity({ mode: 'test', excludedOpenIds: [] })))
    await assert.rejects(() => main(['--config', configFile, '--output', path.join(temporary, 'x.xlsx')]), /默认不导出测试/)
    const future = Date.now() + 86400000
    await fs.writeFile(configFile, JSON.stringify(activity({ endsAt: future, reportingClosesAt: future + 60000 })))
    await assert.rejects(() => main(['--config', configFile, '--output', path.join(temporary, 'x.xlsx')]), /窗口尚未结束/)
    await assert.rejects(() => main(['--config', configFile, '--output', 'x.csv', '--preview']), /必须为 .xlsx/)
    const result = execFileSync(process.execPath, ['-e', `
      require('./tools/export-finishers').main(process.argv.slice(1)).catch(error => process.stdout.write(error.message))
    `, '--', '--config', configFile, '--output', path.join(temporary, 'x.xlsx'), '--preview'], {
      cwd: path.resolve(__dirname, '..'), env: { PATH: process.env.PATH }, encoding: 'utf8'
    })
    assert.match(result, /未配置管理员凭据/)
  } finally { await fs.rm(temporary, { recursive: true, force: true }) }
})
test('server and export JavaScript passes syntax checks', () => {
  for (const file of ['cloudfunctions/submitCompletion/index.js', 'cloudfunctions/submitCompletion/policy.js',
    'cloudfunctions/submitCompletion/service.js', 'tools/export-finishers/index.js', 'tools/export-finishers/export.js',
    'tools/export-finishers/local.js']) {
    execFileSync(process.execPath, ['--check', path.join(__dirname, '..', file)])
  }
})
test('local reader accepts JSON arrays, data arrays, single records and BOM/CRLF JSON lines', () => {
  const records = [stored('first'), stored('second')]
  for (const source of [JSON.stringify(records), JSON.stringify({ data: records }),
    '\uFEFF' + records.map((record) => JSON.stringify(record)).join('\r\n\r\n')]) {
    assert.deepEqual(parseRecords(source), records)
  }
  assert.deepEqual(parseRecords(JSON.stringify(records[0], null, 2)), [records[0]])
  assert.deepEqual(parseRecords(''), [])
  assert.deepEqual(parseRecords('[]'), [])
})
test('invalid local JSON stops rather than silently discarding a damaged line', () => {
  for (const source of ['[{}', '{"data":{}}', 'null', '[1]', '"a"', '[[{}]]']) {
    assert.throws(() => parseRecords(source), /LOCAL_JSON/)
  }
  assert.throws(() => parseRecords(JSON.stringify(stored()) + '\n\n{broken}'), /LOCAL_JSON_LINE_3/)
})
test('local filtering handles more than one page and excludes duplicates and dirty records', async () => {
  const records = Array.from({ length: 205 }, (_, index) => stored(`local-${index}`))
  const source = [...records, records[0], stored('wrong-mode', { mode: 'test' }),
    stored('wrong-env', { environmentId: 'other' }), stored('wrong-activity', { activityId: 'other' }),
    stored('future', { receivedAt: NOW + 1 }), { _id: 'invalid' }]
  const result = collectLocalRows(parseRecords(source.map((record) => JSON.stringify(record)).join('\n')), activity(), NOW)
  const cloud = await collectRows(fetcher(records), activity(), NOW)
  assert.deepEqual(result.rows, cloud.rows)
  assert.equal(result.examined, 211)
  assert.equal(result.excluded, 6)
  const older = stored('repeat', { receivedAt: NOW - 1, nickName: 'first nickname' })
  const newer = stored('repeat', { nickName: 'later nickname' })
  assert.equal(collectLocalRows([newer, older], activity(), NOW).rows[0].nickName, 'first nickname')
})
test('local CLI produces a real XLSX without credentials or loading the cloud SDK', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'health-run-local-cli-'))
  try {
    const configFile = path.join(temporary, 'test activity.json')
    const sourceFile = path.join(temporary, 'test records.json')
    const outputFile = path.join(temporary, 'test output.xlsx')
    const config = activity({ mode: 'test', environmentId: 'test-env', excludedOpenIds: [] })
    const row = stored('offline-conversion', { nickName: '=1+1', photos: ['private-photo.jpg'] }, config)
    const raw = JSON.stringify(row) + '\n'
    await fs.writeFile(configFile, JSON.stringify(config))
    await fs.writeFile(sourceFile, raw)
    const output = execFileSync(process.execPath, ['-e', `
      const Module = require('node:module')
      const original = Module._load
      Module._load = function (name, ...args) {
        if (name === '@cloudbase/node-sdk') throw new Error('Cloud SDK must not load')
        return original.call(this, name, ...args)
      }
      const { main, describeError } = require('./tools/export-finishers')
      main(process.argv.slice(1)).catch(error => { console.error(describeError(error)); process.exitCode = 1 })
    `, '--', '--input', sourceFile, '--config', configFile, '--output', outputFile, '--include-test', '--preview'], {
      cwd: path.resolve(__dirname, '..'), encoding: 'utf8',
      env: { PATH: process.env.PATH, TENCENTCLOUD_SECRETID: 'unused-incomplete-credentials' }
    })
    assert.match(output, /已导出 1 人/)
    assert.match(output, /未访问云端/)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(outputFile)
    const sheet = workbook.getWorksheet('测试名单')
    assert.equal(sheet.getCell('F2').value, '=1+1')
    assert.equal(sheet.getCell('F2').type, ExcelJS.ValueType.String)
    assert.equal(sheet.rowCount, 2)
    assert.ok(!JSON.stringify(sheet.getSheetValues()).includes('offline-conversion'))
    assert.ok(!JSON.stringify(sheet.getSheetValues()).includes('private-photo'))
    assert.match(workbook.getWorksheet('导出说明').getCell('B12').value, /未查询云端/)
    assert.equal(await fs.readFile(sourceFile, 'utf8'), raw)
    assert.equal((await fs.stat(outputFile)).mode & 0o777, 0o600)
  } finally { await fs.rm(temporary, { recursive: true, force: true }) }
})
test('shell wrapper works from another directory with spaces in paths', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'health-run-local-shell-'))
  try {
    const config = require('../cloudfunctions/submitCompletion/activity.example.json')
    const row = prepareRecord(payload({ activityId: config.activityId, routeVersion: config.routeVersion, clientEnvVersion: 'trial' }),
      identity({ ENV: config.environmentId }), config, NOW).record
    const input = path.join(temporary, 'test records.json')
    const output = path.join(temporary, 'test result.xlsx')
    await fs.writeFile(input, JSON.stringify([row]))
    const result = execFileSync('/bin/bash', [path.resolve(__dirname, '../tools/export-finishers/export-test.sh'), input, output], {
      cwd: temporary, encoding: 'utf8', env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` }
    })
    assert.match(result, /已导出 1 人/)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(output)
    assert.equal(workbook.getWorksheet('测试名单').rowCount, 2)
    const zip = path.join(temporary, 'records.zip')
    await fs.writeFile(zip, 'not-json')
    await assert.rejects(() => readRecords(zip), /LOCAL_FILE_FORMAT/)
    const large = path.join(temporary, 'large.json')
    await fs.writeFile(large, '')
    await fs.truncate(large, 50 * 1024 * 1024 + 1)
    await assert.rejects(() => readRecords(large), /LOCAL_FILE_TOO_LARGE/)
  } finally { await fs.rm(temporary, { recursive: true, force: true }) }
})
test('explicit Tencent credential pair wins over stale API key and requires both values', () => {
  assert.deepEqual(credentialsFrom({ TENCENTCLOUD_SECRETID: 'id', TENCENTCLOUD_SECRETKEY: 'key', CLOUDBASE_APIKEY: 'stale' }),
    { secretId: 'id', secretKey: 'key', sessionToken: undefined })
  assert.deepEqual(credentialsFrom({ CLOUDBASE_APIKEY: 'key' }), { accessKey: 'key' })
  assert.throws(() => credentialsFrom({ TENCENTCLOUD_SECRETID: 'id', CLOUDBASE_APIKEY: 'stale' }), /必须同时配置/)
})
test('export diagnostics explain SDK and file failures without exposing secrets or raw messages', () => {
  const environment = { TENCENTCLOUD_SECRETKEY: 'PRIVATE_KEY', TENCENTCLOUD_SECRETID: 'PRIVATE_ID' }
  for (const [code, message, expected] of [
    ['SIGNATURE_ERROR', 'PRIVATE_KEY', /鉴权失败/],
    ['PERMISSION_DENIED', 'PRIVATE_ID', /权限不足/],
    ['DATABASE_QUERY_ERROR', 'index required PRIVATE_KEY', /索引错误/],
    ['ENV_NOT_FOUND', 'PRIVATE_ID', /云环境/],
    ['ETIMEDOUT', 'PRIVATE_KEY', /网络连接失败/],
    ['EEXIST', 'PRIVATE_KEY', /输出文件已存在/],
    ['PRIVATE_KEY', 'Authorization PRIVATE_ID', /阶段：读取云数据库/],
    ['bad code PRIVATE_ID', 'PRIVATE_KEY', /阶段：读取云数据库/]
  ]) {
    const cause = Object.assign(new Error(message), { code })
    const output = describeError(new ExportOperationError('读取云数据库', cause), environment)
    assert.match(output, expected)
    assert.doesNotMatch(output, /PRIVATE_KEY|PRIVATE_ID|Authorization/)
  }
})
test('export refuses an existing file before connecting and identifies malformed/missing config', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'health-run-export-errors-'))
  try {
    const configFile = path.join(temporary, 'activity.json')
    const outputFile = path.join(temporary, 'existing.xlsx')
    await fs.writeFile(configFile, JSON.stringify(activity({ mode: 'test', excludedOpenIds: [] })))
    await fs.writeFile(outputFile, 'preserve existing file')
    const args = ['--config', configFile, '--output', outputFile, '--include-test', '--preview']
    await assert.rejects(() => main(args), (error) => {
      assert.match(describeError(error), /检查输出文件.*EEXIST/)
      return true
    })
    assert.equal(await fs.readFile(outputFile, 'utf8'), 'preserve existing file')
    await fs.writeFile(configFile, '{')
    await assert.rejects(() => main(args), (error) => {
      assert.match(describeError(error), /不是有效 JSON/)
      return true
    })
    args[1] = path.join(temporary, 'missing.json')
    await assert.rejects(() => main(args), (error) => {
      assert.match(describeError(error), /读取活动配置.*ENOENT/)
      return true
    })
  } finally { await fs.rm(temporary, { recursive: true, force: true }) }
})

async function run() {
  for (const { label, callback } of tests) {
    await callback()
    console.log(`PASS ${label}`)
  }
  console.log(`\n${tests.length} completion/reporting/export tests passed.`)
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
test('current route activity identifiers stay fixed across deployments', () => {
  const route = require('../miniprogram/utils/route')
  const settings = require('../miniprogram/utils/config').completionReporting
  const template = require('../cloudfunctions/submitCompletion/activity.example.json')
  assert.equal(route.ROUTE_ID, 'route-20261011')
  assert.equal(route.ROUTE_VERSION, 'route-20261011-v1')
  assert.equal(settings.targets.test.activityId, 'health-run-2026-event02')
  assert.equal(settings.targets.test.routeVersion, 'route-20261011-v1')
  assert.equal(template.activityId, 'health-run-2026-event02')
  assert.equal(template.routeVersion, 'route-20261011-v1')
})
