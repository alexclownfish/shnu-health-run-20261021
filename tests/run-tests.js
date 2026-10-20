const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const miniRoot = path.join(root, 'miniprogram')
const pages = ['route', 'checkin', 'upload', 'certificate', 'records', 'profile']
const components = ['route-map', 'profile-auth']

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function run(label, callback) {
  try {
    callback()
    console.log(`PASS ${label}`)
  } catch (error) {
    console.error(`FAIL ${label}`)
    throw error
  }
}

function createPageRuntime(name) {
  const file = path.join(miniRoot, 'pages', name, `${name}.js`)
  const previous = { wx: global.wx, Page: global.Page, getApp: global.getApp }
  const storage = {}
  const calls = { navigation: [], redirects: [], toasts: [], scans: [], photos: [], saves: [] }
  const app = { globalData: {} }
  let definition
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value },
    navigateTo: (options) => calls.navigation.push(options),
    switchTab: (options) => calls.redirects.push(options),
    redirectTo: (options) => calls.navigation.push(options),
    showToast: (options) => calls.toasts.push(options),
    vibrateShort: () => {},
    scanCode: (options) => calls.scans.push(options),
    chooseMedia: (options) => calls.photos.push(options),
    saveFile: (options) => calls.saves.push(options)
  }
  global.getApp = () => app
  global.Page = (value) => { definition = value }
  delete require.cache[require.resolve(file)]
  require(file)
  const page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(update) { Object.assign(this.data, update) }
  }
  return {
    page, storage, calls, app,
    cleanup() {
      if (typeof page.onUnload === 'function') page.onUnload()
      global.wx = previous.wx
      global.Page = previous.Page
      global.getApp = previous.getApp
      delete require.cache[require.resolve(file)]
    }
  }
}

function prepareCheckpoint(type) {
  const progress = require(path.join(miniRoot, 'utils', 'progress.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const at = Date.now() - 1000
  progress.resetProgress()
  if (type !== 'start') {
    progress.startCheckIn({ ...QR_TAGS[0], assurance: 'LOCAL_QR_MATCH', observedAt: at })
  }
  if (type === 'finish') {
    for (let index = 0; index < 3; index += 1) {
      progress.checkInStation(index, 'qr-code', { ...QR_TAGS[index + 1], assurance: 'LOCAL_QR_MATCH', observedAt: at })
      progress.completeStation(index, `wxfile://point-${index}.jpg`)
    }
  }
  return progress
}

const completeProfile = { nickName: '测试参与者', avatarUrl: 'wxfile://avatar.jpg' }
const incompleteProfiles = [
  undefined,
  {},
  { nickName: '测试参与者' },
  { avatarUrl: 'wxfile://avatar.jpg' },
  { nickName: ' \t ', avatarUrl: 'wxfile://avatar.jpg' },
  { nickName: '测试参与者', avatarUrl: ' \n ' }
]

run('project config points to miniprogram root', () => {
  const config = readJson(path.join(root, 'project.config.json'))
  assert.equal(config.miniprogramRoot, 'miniprogram/')
  assert.equal(config.compileType, 'miniprogram')
  assert.equal(config.appid, 'wx9d16b2e04851fc36')
})

run('app page registry has every page asset', () => {
  const app = readJson(path.join(miniRoot, 'app.json'))
  assert.deepEqual(app.pages.map((page) => page.split('/')[1]), pages)
  for (const page of pages) {
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.ok(fs.existsSync(path.join(miniRoot, 'pages', page, `${page}.${extension}`)), `${page}.${extension}`)
    }
  }
})

run('all app and page javascript parses', () => {
  const files = [
    path.join(miniRoot, 'app.js'),
    ...pages.map((page) => path.join(miniRoot, 'pages', page, `${page}.js`)),
    ...components.map((component) => path.join(miniRoot, 'components', component, `${component}.js`)),
    ...fs.readdirSync(path.join(miniRoot, 'utils')).filter((file) => file.endsWith('.js')).map((file) => path.join(miniRoot, 'utils', file))
  ]
  for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
})

run('app and route page initialize with a JS-only mini-program module loader', () => {
  const cache = new Map()
  const storage = {}
  let app
  let page
  const api = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value }
  }
  // Mirror the reported runtime: JSON requires resolve to .json.js, never Node's JSON loader.
  function loadModule(file) {
    const resolved = file.endsWith('.js') ? file : `${file}.js`
    assert.ok(resolved.startsWith(miniRoot + path.sep), 'modules stay inside the package')
    assert.ok(fs.existsSync(resolved), `mini-program module not found: ${path.relative(miniRoot, resolved)}`)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const context = {
      module, exports: module.exports, wx: api,
      App: (value) => { app = value },
      Page: (value) => { page = value },
      require: (request) => {
        assert.ok(request.startsWith('.'), 'no Node modules in the mini-program runtime')
        return loadModule(path.resolve(path.dirname(resolved), request))
      }
    }
    vm.runInNewContext(fs.readFileSync(resolved, 'utf8'), context, { filename: resolved })
    return module.exports
  }
  loadModule(path.join(miniRoot, 'app.js'))
  assert.ok(app && typeof app.onLaunch === 'function', 'app registered')
  app.onLaunch.call(app)
  assert.equal(app.globalData.routeId, 'route-20261011')
  loadModule(path.join(miniRoot, 'pages', 'route', 'route.js'))
  assert.ok(page && typeof page.onLoad === 'function', 'route page registered')
  page.setData = (value) => Object.assign(page.data, value)
  page.onLoad.call(page)
  assert.equal(page.data.totalDistance, '3.50')
  assert.equal(page.data.stations.length, 3)
  assert.equal(page.data.started, false)
  assert.equal(page.data.profileVisible, true)
})

run('route map and profile authorization components are registered', () => {
  for (const component of components) {
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.ok(fs.existsSync(path.join(miniRoot, 'components', component, `${component}.${extension}`)), `${component}.${extension}`)
    }
    assert.equal(readJson(path.join(miniRoot, 'components', component, `${component}.json`)).component, true)
  }
  const route = readJson(path.join(miniRoot, 'pages', 'route', 'route.json'))
  const profile = readJson(path.join(miniRoot, 'pages', 'profile', 'profile.json'))
  assert.equal(route.usingComponents['route-map'], '/components/route-map/route-map')
  assert.equal(route.usingComponents['profile-auth'], '/components/profile-auth/profile-auth')
  assert.equal(profile.usingComponents['profile-auth'], '/components/profile-auth/profile-auth')
})

run('route map uses the supplied activity diagram', () => {
  const source = fs.readFileSync(path.join(miniRoot, 'components', 'route-map', 'route-map.js'), 'utf8')
  const template = fs.readFileSync(path.join(miniRoot, 'components', 'route-map', 'route-map.wxml'), 'utf8')
  assert.match(source, /Component\(/, 'route map component')
  assert.match(template, /<image/, 'supplied route diagram image')
  assert.match(template, /shnu-route-map\.jpg/, 'activity route image asset')
})

run('KMZ segments and exact photo checkpoints survive map conversion', () => {
  const route = require(path.join(miniRoot, 'utils', 'route.js'))
  const segments = route.getMapSegments()
  assert.deepEqual(segments.map((segment) => segment.length), [67, 290])
  assert.deepEqual(segments.flat(), route.getMapPoints())
  assert.notDeepEqual(segments[0].at(-1), segments[1][0], 'recording gap is not filled')
  const coordinates = [[31.220245, 121.532882], [31.218830, 121.537567], [31.219335, 121.535586]]
  const markers = route.getMapMarkers()
  coordinates.forEach(([lat, lon], index) => {
    const expected = route.wgs84ToGcj02(lat, lon)
    assert.equal(markers[index + 1].latitude, expected.latitude)
    assert.equal(markers[index + 1].longitude, expected.longitude)
    assert.ok(route.TASK_TRACK_INDEX[index] > (route.TASK_TRACK_INDEX[index - 1] || 0))
  })
  assert.equal(markers[0].latitude, route.wgs84ToGcj02(31.221752, 121.531923).latitude)
  assert.equal(markers[4].longitude, route.wgs84ToGcj02(31.221699, 121.531934).longitude)
  assert.notEqual(markers[0].label.anchorX, markers[4].label.anchorX, 'nearby S/F labels are separated')
  route.TRACK.forEach(([, lat, lon]) => {
    assert.ok(Number.isFinite(lat) && lat >= route.BOUNDS.minLat && lat <= route.BOUNDS.maxLat)
    assert.ok(Number.isFinite(lon) && lon >= route.BOUNDS.minLon && lon <= route.BOUNDS.maxLon)
  })
  // The production route component now renders the supplied route diagram image;
  // the KMZ geometry remains covered by the route data assertions above.
  assert.deepEqual(require(path.join(miniRoot, 'utils', 'stations.js')).map((station) => station.distance),
    ['约 350 m', '约 870 m', '约 1.07 km'])
  assert.equal(route.TOTAL_DISTANCE_KM.toFixed(2), '3.50')
})

run('new route progress leaves prior route records intact', () => {
  const route = require(path.join(miniRoot, 'utils', 'route.js'))
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  const legacy = { routeId: 'route-01', completed: 3, startedAt: 1, completedAt: 99, photos: { 0: 'old-photo' } }
  const storage = { 'patchwalk-progress-v3': legacy }
  const original = JSON.stringify(storage)
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value }
  }
  const current = store.ensureProgress()
  assert.equal(current.completed, 0)
  assert.equal(current.startedAt, 0)
  assert.equal(current.routeId, route.ROUTE_ID)
  assert.deepEqual(current.photos, {})
  assert.equal(JSON.stringify({ 'patchwalk-progress-v3': storage['patchwalk-progress-v3'] }), original)
  assert.equal(storage[`patchwalk-progress-v4-${route.ROUTE_ID}`].routeId, route.ROUTE_ID)
  store.resetProgress()
  assert.equal(storage['patchwalk-progress-v3'], legacy)
})

run('tab bar only points to existing pages', () => {
  const app = readJson(path.join(miniRoot, 'app.json'))
  for (const item of app.tabBar.list) assert.ok(app.pages.includes(item.pagePath))
})

run('progress state normalizes and caps safely', () => {
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  assert.equal(store.normalizeProgress({ completed: -3 }).completed, 0)
  assert.equal(store.normalizeProgress({ completed: 7 }).completed, 3)
  assert.equal(store.normalizeProgress({ completed: '2' }).completed, 2)
  assert.equal(store.deriveStats({ completed: 3 }).distance, '3.50')
  assert.equal(store.deriveStats({ completed: 1 }).points, 1)
  assert.equal(store.normalizeProgress({ participantId: 'abc123' }).participantId, 'abc123')
})

run('strict station workflow rejects every skipped step and accepts scan plus photo', () => {
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const storage = {}
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value }
  }
  store.resetProgress()
  const now = Date.now()
  const start = store.startCheckIn({ qrId: 'QR-START-A', pointCode: '000', assurance: 'LOCAL_QR_MATCH', observedAt: now })
  assert.equal(start.startedAt, now)
  assert.equal(store.startCheckIn({ qrId: 'QR-START-A', pointCode: '000', assurance: 'LOCAL_QR_MATCH', observedAt: now + 1000 }).startedAt, now)
  store.checkInStation(1)
  store.completeStation(0, 'photo-a.jpg')
  assert.equal(store.readProgress().completed, 0)
  store.checkInStation(0, 'qr-code', { ...QR_TAGS[1], assurance: 'LOCAL_QR_MATCH', observedAt: now })
  store.completeStation(0, '')
  assert.equal(store.readProgress().completed, 0)
  store.completeStation(0, 'photo-a.jpg')
  assert.equal(store.readProgress().completed, 1)

  store.checkInStation(1, 'qr-code', { ...QR_TAGS[2], assurance: 'LOCAL_QR_MATCH', observedAt: now })
  store.completeStation(1, 'photo-b.jpg')
  assert.equal(store.readProgress().completed, 2)
  store.checkInStation(2, 'qr-code', { ...QR_TAGS[3], assurance: 'LOCAL_QR_MATCH', observedAt: now })
  store.completeStation(2, 'photo-c.jpg')
  assert.equal(store.readProgress().completed, 3)
  assert.equal(store.readProgress().completedAt, 0)
  assert.equal(store.isFinished(store.readProgress()), false)
  const finished = store.finishCheckIn({ qrId: 'QR-FINISH-A', pointCode: '999', assurance: 'LOCAL_QR_MATCH', observedAt: now + 5000 })
  assert.equal(finished.completedAt, now + 5000)
  assert.equal(store.isFinished(finished), true)
  assert.equal(store.readProgress().history.length, 3)
})

run('start and finish checkpoints enforce the route boundaries', () => {
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const storage = {}
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value }
  }
  store.resetProgress()
  assert.equal(store.finishCheckIn({ ...QR_TAGS[4], assurance: 'LOCAL_QR_MATCH', observedAt: 2000 }).completedAt, 0)
  assert.equal(store.checkInStation(0, 'qr-code', { ...QR_TAGS[1], assurance: 'LOCAL_QR_MATCH' }).completed, 0)
  store.startCheckIn({ ...QR_TAGS[0], assurance: 'LOCAL_QR_MATCH', observedAt: 1000 })
  assert.equal(store.startCheckIn({ ...QR_TAGS[0], assurance: 'LOCAL_QR_MATCH', observedAt: 900 }).startedAt, 1000)
  assert.equal(store.finishCheckIn({ ...QR_TAGS[4], assurance: 'LOCAL_QR_MATCH', observedAt: 900 }).completedAt, 0)
  assert.equal(store.isFinished(store.readProgress()), false)
})

run('current checkpoint transitions from start to stations to finish', () => {
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const storage = {}
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value }
  }
  store.resetProgress()
  assert.deepEqual(store.getCurrentCheckpoint(store.readProgress()), { type: 'start' })
  store.startCheckIn({ ...QR_TAGS[0], assurance: 'LOCAL_QR_MATCH', observedAt: Date.now() })
  assert.deepEqual(store.getCurrentCheckpoint(store.readProgress()), { type: 'station', stationIndex: 0 })
  store.saveProgress({ ...store.readProgress(), completed: 3 })
  assert.deepEqual(store.getCurrentCheckpoint(store.readProgress()), { type: 'finish' })
  store.finishCheckIn({ ...QR_TAGS[4], assurance: 'LOCAL_QR_MATCH', observedAt: Date.now() })
  assert.equal(store.getCurrentCheckpoint(store.readProgress()), null)
})

run('expired check-ins cannot upload a point photo', () => {
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  assert.equal(store.hasValidCheckIn({ checkins: { 0: { at: Date.now() - 21 * 60 * 1000 } } }, 0), false)
  assert.equal(store.hasValidCheckIn({
    startedAt: 1,
    startCheckIn: { qrId: 'QR-START-A', pointCode: '000', assurance: 'LOCAL_QR_MATCH' },
    checkins: { 0: { at: Date.now(), source: 'qr-code', qrId: 'QR-001-A', pointCode: '001', assurance: 'LOCAL_QR_MATCH' } }
  }, 0), true)
})

run('production check-in entry is manual and has no local skip', () => {
  const config = require(path.join(miniRoot, 'utils', 'config.js'))
  const routeScript = fs.readFileSync(path.join(miniRoot, 'pages', 'route', 'route.js'), 'utf8')
  const routeTemplate = fs.readFileSync(path.join(miniRoot, 'pages', 'route', 'route.wxml'), 'utf8')
  assert.equal('allowNfcSkip' in config, false)
  assert.doesNotMatch(routeScript, /discoverOnce|checkInStation|nfc-skip/)
  assert.match(routeScript, /wx\.navigateTo\(\{ url: '\/pages\/checkin\/checkin' \}\)/)
  assert.doesNotMatch(routeTemplate, /跳过|自动打开|等待触碰现场标签|无需点击扫描/)
  assert.match(routeTemplate, /扫描起点二维码|扫码打卡/)
})

run('packaged QR inventory is exact, unique, and non-URL', () => {
  const { QR_TAGS, QR_USAGE_HINT, getQrInventoryStatus } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  assert.equal(QR_USAGE_HINT, '请在微信小程序「悠湃体育」内点击“扫码打卡”使用。')
  assert.equal(QR_TAGS.length, 5)
  assert.equal(new Set(QR_TAGS.map((item) => item.qrId)).size, QR_TAGS.length)
  assert.equal(new Set(QR_TAGS.map((item) => item.qrToken)).size, QR_TAGS.length)
  for (const item of QR_TAGS) {
    assert.match(item.qrToken, /^[A-Za-z0-9_-]{22,64}$/)
    assert.equal(item.payloadVersion, 1)
    assert.doesNotMatch(item.payload, /^https?:/i)
    assert.equal(item.legacyPayload, `HRQ1|${item.pointCode}|${item.qrId}|${item.qrToken}`)
    assert.equal(item.payload, `${QR_USAGE_HINT}\n${item.legacyPayload}`)
  }
  assert.deepEqual(QR_TAGS.map((item) => item.checkpointType), ['start', 'station', 'station', 'station', 'finish'])
  assert.deepEqual(QR_TAGS.map((item) => item.pointCode), ['000', '001', '002', '003', '999'])
  assert.equal(getQrInventoryStatus().releaseReady, true)
})

run('five checkpoints accept guided LF and CRLF codes and their original codes only at the matching point', () => {
  const validation = require(path.join(miniRoot, 'utils', 'qr-validation.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  QR_TAGS.forEach((expected) => {
    QR_TAGS.forEach((scanned) => {
      for (const result of [scanned.payload, scanned.payload.replace('\n', '\r\n'), scanned.legacyPayload]) {
        const verdict = validation.validateQrResult({
          expectedCheckpointType: expected.checkpointType,
          expectedStationIndex: expected.stationIndex,
          result: { result },
          qrTags: QR_TAGS
        })
        assert.equal(verdict.ok, expected.qrId === scanned.qrId)
        if (verdict.ok) assert.equal(verdict.qrId, expected.qrId)
        else assert.equal(verdict.reasonCode, 'WRONG_POINT')
      }
    })
  })
})

run('QR guidance cannot conceal altered, unknown, disabled, duplicated, or concatenated input', () => {
  const validation = require(path.join(miniRoot, 'utils', 'qr-validation.js'))
  const { QR_TAGS, QR_USAGE_HINT } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const valid = QR_TAGS[1]
  const check = (result, qrTags = QR_TAGS) => validation.validateQrResult({ expectedStationIndex: 0, result, qrTags })
  for (const result of [
    valid.payload.replace('悠湃体育', '其他小程序'),
    `${QR_USAGE_HINT}${valid.legacyPayload}`,
    `${QR_USAGE_HINT}\n\n${valid.legacyPayload}`,
    `${QR_USAGE_HINT}\n${valid.payload}`,
    `${valid.payload}\n${QR_TAGS[2].legacyPayload}`,
    `${valid.payload}\n额外文字`,
    `${valid.legacyPayload}\n${QR_USAGE_HINT}`,
    `${QR_USAGE_HINT}\nhttps://example.com`,
    `${QR_USAGE_HINT}\nHRQ2|001|QR-001-A|${valid.qrToken}`
  ]) assert.equal(check(result).reasonCode, 'QR_INVALID', result)
  assert.equal(check(`${QR_USAGE_HINT}\nHRQ1|001|QR-001-A|unknown-token-value-1234`).reasonCode, 'QR_UNKNOWN')
  assert.equal(check(valid.payload, [{ ...valid, enabled: false }]).reasonCode, 'QR_UNKNOWN')
  for (const result of [valid.payload, valid.legacyPayload]) {
    assert.equal(check(result, [valid, { ...valid }]).reasonCode, 'QR_CONFIG_DUPLICATE')
  }
})

run('QR validation requires exact HRQ1 inventory and current point', () => {
  const validation = require(path.join(miniRoot, 'utils', 'qr-validation.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const accepted = validation.validateQrResult({ expectedStationIndex: 0, result: QR_TAGS[1].payload, qrTags: QR_TAGS, observedAt: 2 })
  assert.equal(accepted.ok, true)
  assert.equal(accepted.assurance, 'LOCAL_QR_MATCH')
  assert.equal(accepted.qrId, 'QR-001-A')
  assert.equal(validation.validateQrResult({ expectedCheckpointType: 'start', result: QR_TAGS[0].payload, qrTags: QR_TAGS }).ok, true)
  assert.equal(validation.validateQrResult({ expectedCheckpointType: 'finish', result: QR_TAGS[4].payload, qrTags: QR_TAGS }).ok, true)
  assert.equal(validation.validateQrResult({ expectedCheckpointType: 'start', result: QR_TAGS[1].payload, qrTags: QR_TAGS }).reasonCode, 'WRONG_POINT')
  assert.equal(validation.validateQrResult({ expectedCheckpointType: 'finish', result: QR_TAGS[3].payload, qrTags: QR_TAGS }).reasonCode, 'WRONG_POINT')
  assert.equal(validation.validateQrResult({ expectedStationIndex: 0, result: QR_TAGS[2].payload, qrTags: QR_TAGS }).reasonCode, 'WRONG_POINT')
  assert.equal(validation.validateQrResult({ expectedStationIndex: 0, result: 'https://example.com', qrTags: QR_TAGS }).reasonCode, 'QR_INVALID')
  assert.equal(validation.validateQrResult({ expectedStationIndex: 0, result: 'HRQ1|001|QR-001-A|unknown-token-value-1234', qrTags: QR_TAGS }).reasonCode, 'QR_UNKNOWN')
  assert.equal(validation.validateQrResult({ expectedStationIndex: 0, result: QR_TAGS[1].payload, qrTags: [QR_TAGS[1], { ...QR_TAGS[1], qrId: 'QR-DUP' }] }).reasonCode, 'QR_CONFIG_DUPLICATE')
  assert.equal(validation.normalizeScanError({ errMsg: 'scanCode:fail cancel' }).reasonCode, 'QR_CANCELLED')
  assert.equal(validation.normalizeScanError({ errMsg: 'scanCode:fail auth deny' }).reasonCode, 'CAMERA_DENIED')
  assert.equal(validation.normalizeScanError({ errMsg: 'scanCode:fail unavailable' }).reasonCode, 'QR_SCAN_FAILED')
})

run('validated QR metadata is local, minimized, ordered, and not overwritten', () => {
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  const storage = {}
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value }
  }
  store.resetProgress()
  store.startCheckIn({ qrId: 'QR-START-A', pointCode: '000', assurance: 'LOCAL_QR_MATCH', observedAt: 1 })
  store.checkInStation(1, 'qr-code', { qrId: 'FUTURE' })
  assert.equal(store.readProgress().checkins['1'], undefined)
  const qr = store.checkInStation(0, 'qr-code', {
    qrId: 'QR-001-A',
    pointCode: '001',
    assurance: 'LOCAL_QR_MATCH',
    qrToken: 'must-not-be-stored'
  })
  assert.equal(qr.checkins['0'].qrId, 'QR-001-A')
  assert.equal(qr.checkins['0'].assurance, 'LOCAL_QR_MATCH')
  assert.equal(JSON.stringify(qr).includes('must-not-be-stored'), false)
  assert.equal('tagId' in qr.checkins['0'], false)
  assert.equal('uidHint' in qr.checkins['0'], false)
})

run('a QR check-in repairs a legacy NFC-only local record', () => {
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  const storage = {}
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value }
  }
  store.saveProgress({
    completed: 0,
    startedAt: 1,
    startCheckIn: { at: 1, source: 'qr-code', qrId: 'QR-START-A', pointCode: '000', assurance: 'LOCAL_QR_MATCH' },
    checkins: { 0: { at: 2, source: 'nfc' } },
    photos: {},
    history: [],
    routeId: 'route-01'
  })
  const repaired = store.checkInStation(0, 'qr-code', {
    qrId: 'QR-001-A',
    pointCode: '001',
    assurance: 'LOCAL_QR_MATCH'
  })
  assert.equal(repaired.checkins['0'].source, 'qr-code')
  assert.equal(repaired.checkins['0'].qrId, 'QR-001-A')
  assert.equal(repaired.checkins['0'].pointCode, '001')
})

run('check-in page exposes one platform-neutral QR action', () => {
  const script = fs.readFileSync(path.join(miniRoot, 'pages', 'checkin', 'checkin.js'), 'utf8')
  const template = fs.readFileSync(path.join(miniRoot, 'pages', 'checkin', 'checkin.wxml'), 'utf8')
  assert.match(script, /IDLE_QR/)
  assert.match(script, /startQrScan\(\)/)
  assert.match(script, /wx\.scanCode/)
  assert.match(script, /progress\.completed/)
  assert.doesNotMatch(script, /getNFCAdapter|startNfcScan|createDiscoverySession|resolvePlatformMode/)
  assert.match(script, /if \(!this\.pageActive \|\| this\.accepted/)
  assert.doesNotMatch(script, /resolveLaunchOptions|LOCAL_LINK_MATCH|LOCAL_LINK_COMPAT/)
  assert.match(template, /扫码打卡/)
  assert.doesNotMatch(template, /uidCanonical|tagToken|qrToken|raw UID/i)
  assert.match(template, /照片保存在当前设备/)
  assert.match(template, /完赛昵称和起止时间提交给组织者/)
})

run('QR result survives the native scanner temporarily hiding the page', () => {
  const checkinPath = path.join(miniRoot, 'pages', 'checkin', 'checkin.js')
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const storage = { [userStore.KEY]: completeProfile }
  let pageDefinition
  let scanOptions
  global.Page = (definition) => { pageDefinition = definition }
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = value },
    scanCode: (options) => { scanOptions = options },
    vibrateShort: () => {},
    switchTab: () => {},
    redirectTo: () => {}
  }
  delete require.cache[require.resolve(checkinPath)]
  require(checkinPath)
  delete global.Page

  const page = {
    ...pageDefinition,
    data: { ...pageDefinition.data },
    setData(update) {
      this.data = { ...this.data, ...update }
    },
    accepted: false,
    attemptId: 0,
    expectedStationIndex: 0,
    mode: 'QR',
    needsReset: false,
    pageActive: true,
    pageUnloaded: false,
    qrScanActive: false
  }

  page.startQrScan()
  page.onHide()
  assert.equal(page.attemptId, 1)
  assert.equal(page.qrScanActive, true)
  scanOptions.success({ result: QR_TAGS[0].payload })
  assert.equal(page.accepted, true)
  assert.equal(page.data.state, 'ACCEPTED')
  assert.equal(page.qrScanActive, false)
  clearTimeout(page.navigationTimer)
})

run('photo persistence remains completely local at runtime', () => {
  const appScript = fs.readFileSync(path.join(miniRoot, 'app.js'), 'utf8')
  const photoScript = fs.readFileSync(path.join(miniRoot, 'utils', 'photo.js'), 'utf8')
  assert.doesNotMatch(appScript, /uploadFile|cloudPath/)
  assert.doesNotMatch(photoScript, /wx\.cloud|uploadFile|cloudPath/)
  assert.match(photoScript, /wx\.saveFile/)
  assert.match(photoScript, /saveCheckInPhoto/)
  assert.doesNotMatch(photoScript, /local:\/\//)
})

run('photo completion reports device-local storage to the user', () => {
  const uploadScript = fs.readFileSync(path.join(miniRoot, 'pages', 'upload', 'upload.js'), 'utf8')
  const uploadTemplate = fs.readFileSync(path.join(miniRoot, 'pages', 'upload', 'upload.wxml'), 'utf8')
  assert.match(uploadScript, /照片已保存在当前设备/)
  assert.doesNotMatch(uploadScript, /云端|上传/)
  assert.match(uploadTemplate, /保存照片并完成点位/)
  assert.match(uploadTemplate, /\{\{storageNotice\}\}/)
})

run('completion certificate renders and saves a local album image', () => {
  const certificateScript = fs.readFileSync(path.join(miniRoot, 'pages', 'certificate', 'certificate.js'), 'utf8')
  const certificateTemplate = fs.readFileSync(path.join(miniRoot, 'pages', 'certificate', 'certificate.wxml'), 'utf8')
  assert.match(certificateScript, /canvasToTempFilePath/)
  assert.match(certificateScript, /saveImageToPhotosAlbum/)
  assert.match(certificateScript, /wx\.openSetting/)
  assert.match(certificateTemplate, /id="certificateCanvas"/)
  assert.match(certificateTemplate, /savingCertificate/)
})

run('user profile storage normalizes WeChat data', () => {
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const user = userStore.saveUser({ nickName: '  小跑  ', avatarUrl: '  wxfile://avatar.png  ' })
  assert.equal(user.nickName, '小跑')
  assert.equal(userStore.readUser().avatarUrl, 'wxfile://avatar.png')
  assert.equal(userStore.isProfileComplete(user), true)
  assert.equal(userStore.isProfileComplete({ nickName: '小跑', avatarUrl: '' }), false)
  for (const profile of incompleteProfiles) assert.equal(userStore.isProfileComplete(profile), false)
})

run('every available route check-in entry requires both nickname and avatar', () => {
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const entries = [
    ['start', (page) => page.openCheckin()],
    ['start', (page) => page.handleStart()],
    ['start', (page) => page.handleStartTap()],
    ['station', (page) => page.handleStationTap({ currentTarget: { dataset: { index: 0 } } })],
    ['finish', (page) => page.handleFinishTap()]
  ]
  for (const profile of incompleteProfiles) {
    for (const [checkpointType, enter] of entries) {
      const runtime = createPageRuntime('route')
      try {
        runtime.storage[userStore.KEY] = profile
        const progress = prepareCheckpoint(checkpointType)
        const before = JSON.stringify(progress.readProgress())
        runtime.page.refreshProgress()
        enter(runtime.page)
        assert.equal(runtime.page.data.profileVisible, true, `${checkpointType} prompts for profile`)
        assert.equal(runtime.calls.navigation.length, 0, 'cannot open scanner without a complete profile')
        runtime.page.closeProfileAuthorization()
        enter(runtime.page)
        assert.equal(runtime.page.data.profileVisible, true, 'closing the prompt does not bypass the prerequisite')
        assert.equal(runtime.calls.navigation.length, 0)
        assert.equal(JSON.stringify(progress.readProgress()), before)
      } finally {
        runtime.cleanup()
      }
    }
  }
})

run('route rejects incomplete profile saves and opens check-in after valid details are saved', () => {
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const runtime = createPageRuntime('route')
  try {
    runtime.page.openCheckin()
    for (const profile of incompleteProfiles) {
      runtime.page.saveAuthorizedProfile({ detail: { user: profile } })
      assert.equal(runtime.page.data.profileVisible, true)
      assert.equal(userStore.isProfileComplete(userStore.readUser()), false)
      assert.equal(runtime.calls.navigation.length, 0)
    }
    runtime.page.saveAuthorizedProfile({ detail: { user: completeProfile } })
    assert.equal(runtime.page.data.profileVisible, false)
    assert.equal(userStore.isProfileComplete(userStore.readUser()), true)
    assert.equal(runtime.app.globalData.user.nickName, completeProfile.nickName)
    runtime.page.openCheckin()
    assert.equal(runtime.calls.navigation.at(-1).url, '/pages/checkin/checkin')
  } finally {
    runtime.cleanup()
  }
})

run('direct scanner entry cannot scan or write checkpoint progress without a complete profile', () => {
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const qrValidation = require(path.join(miniRoot, 'utils', 'qr-validation.js'))
  for (const profile of incompleteProfiles) {
    for (const [type, tagIndex] of [['start', 0], ['station', 1], ['finish', 4]]) {
      const runtime = createPageRuntime('checkin')
      try {
        runtime.storage[userStore.KEY] = profile
        const progress = prepareCheckpoint(type)
        const before = JSON.stringify(progress.readProgress())
        runtime.page.onLoad()
        runtime.page.onShow()
        runtime.page.startQrScan()
        assert.equal(runtime.calls.scans.length, 0)
        const result = qrValidation.validateQrResult({
          expectedCheckpointType: type,
          expectedStationIndex: type === 'station' ? 0 : null,
          result: { result: QR_TAGS[tagIndex].payload },
          qrTags: QR_TAGS
        })
        assert.equal(result.ok, true)
        runtime.page.handleValidationResult(result, runtime.page.attemptId)
        assert.equal(JSON.stringify(progress.readProgress()), before, `${type} checkpoint remains unchanged`)
        assert.equal(runtime.page.accepted, false)
        assert.equal(runtime.calls.redirects.length, 1, 'repeated guards share one pending profile redirect')
        assert.equal(runtime.calls.redirects[0].url, '/pages/route/route')
      } finally {
        runtime.cleanup()
      }
    }
  }
})

run('scanner rechecks profile after the asynchronous QR result before any checkpoint write', () => {
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  for (const [type, tagIndex] of [['start', 0], ['station', 1], ['finish', 4]]) {
    const runtime = createPageRuntime('checkin')
    try {
      runtime.storage[userStore.KEY] = completeProfile
      const progress = prepareCheckpoint(type)
      const before = JSON.stringify(progress.readProgress())
      runtime.page.onLoad()
      runtime.page.startQrScan()
      assert.equal(runtime.calls.scans.length, 1, `${type} scanner opens with complete details`)
      delete runtime.storage[userStore.KEY]
      runtime.calls.scans[0].success({ result: QR_TAGS[tagIndex].payload })
      assert.equal(JSON.stringify(progress.readProgress()), before)
      assert.equal(runtime.page.accepted, false)
      assert.equal(runtime.calls.redirects.at(-1).url, '/pages/route/route')
    } finally {
      runtime.cleanup()
    }
  }
})

run('photo page requires complete details for deep links, returning, choosing, and saving', () => {
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  for (const profile of incompleteProfiles) {
    const runtime = createPageRuntime('upload')
    try {
      const progress = prepareCheckpoint('station')
      progress.checkInStation(0, 'qr-code', { ...QR_TAGS[1], assurance: 'LOCAL_QR_MATCH', observedAt: Date.now() })
      const before = JSON.stringify(progress.readProgress())
      runtime.storage[userStore.KEY] = profile
      runtime.page.onLoad({ station: '0' })
      runtime.page.onShow()
      runtime.page.choosePhoto()
      runtime.page.setData({ photoPath: 'wxfile://photo.jpg' })
      runtime.page.submitPoint()
      assert.equal(runtime.calls.photos.length, 0)
      assert.equal(runtime.calls.saves.length, 0)
      assert.equal(runtime.calls.redirects.at(-1).url, '/pages/route/route')
      assert.equal(JSON.stringify(progress.readProgress()), before)
    } finally {
      runtime.cleanup()
    }
  }
})

run('photo selection ignores a delayed callback after profile details become incomplete', () => {
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  const runtime = createPageRuntime('upload')
  try {
    runtime.storage[userStore.KEY] = completeProfile
    const progress = prepareCheckpoint('station')
    progress.checkInStation(0, 'qr-code', { ...QR_TAGS[1], assurance: 'LOCAL_QR_MATCH', observedAt: Date.now() })
    runtime.page.onLoad({ station: '0' })
    runtime.page.choosePhoto()
    assert.equal(runtime.calls.photos.length, 1)
    delete runtime.storage[userStore.KEY]
    runtime.calls.photos[0].success({ tempFiles: [{ tempFilePath: 'wxfile://photo.jpg', size: 1000 }] })
    assert.equal(runtime.page.data.photoPath, '')
    assert.equal(progress.readProgress().completed, 0)
    assert.equal(runtime.calls.redirects.at(-1).url, '/pages/route/route')
  } finally {
    runtime.cleanup()
  }
})

run('returning to an existing route, scanner, or photo page rechecks profile completeness', () => {
  const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
  const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
  for (const name of ['route', 'checkin', 'upload']) {
    const runtime = createPageRuntime(name)
    try {
      runtime.storage[userStore.KEY] = completeProfile
      const progress = prepareCheckpoint('station')
      progress.checkInStation(0, 'qr-code', { ...QR_TAGS[1], assurance: 'LOCAL_QR_MATCH', observedAt: Date.now() })
      runtime.page.onLoad({ station: '0' })
      runtime.storage[userStore.KEY] = { nickName: completeProfile.nickName }
      runtime.page.onShow()
      if (name === 'route') {
        assert.equal(runtime.page.data.profileVisible, true)
        assert.equal(runtime.calls.navigation.length, 0)
      } else {
        assert.equal(runtime.calls.redirects.at(-1).url, '/pages/route/route')
      }
    } finally {
      runtime.cleanup()
    }
  }
})

run('calendar uses real month boundaries and activity dates', () => {
  const format = require(path.join(miniRoot, 'utils', 'format.js'))
  const calendar = format.getMonthGrid(2026, 7, ['2026-08-05'])
  assert.equal(calendar.monthLabel, '2026.08')
  assert.equal(calendar.cells.find((cell) => cell.day === 5).active, true)
  assert.equal(calendar.cells.length % 7, 0)
})

run('completion certificate formats local duration and activity distance without ranking', () => {
  const format = require(path.join(miniRoot, 'utils', 'format.js'))
  assert.equal(format.formatDuration(1000, 3723000), '01:02:02')
  assert.equal(format.formatDuration(0, 3723000), '--')
  assert.equal(format.formatDuration(4000, 3000), '--')
  assert.equal(format.formatDuration(1000, 1000), '00:00:00')
  assert.equal(format.formatDuration(1000, 1000999), '00:16:39')
  assert.equal(format.formatDuration(1000, 86401000), '24:00:00')
  assert.equal(format.formatDuration(Infinity, Infinity), '--')
  assert.equal(format.formatDuration(-1000, 3000), '--')
  assert.equal(format.formatDuration('invalid', 3000), '--')

  const certificateScript = fs.readFileSync(path.join(miniRoot, 'pages', 'certificate', 'certificate.js'), 'utf8')
  const certificateTemplate = fs.readFileSync(path.join(miniRoot, 'pages', 'certificate', 'certificate.wxml'), 'utf8')
  assert.match(certificateScript, /formatDuration\(progress\.startedAt, progress\.completedAt\)/)
  assert.match(certificateScript, /总用时/)
  assert.doesNotMatch(certificateScript, /排名|rankLabel|路程|1\.56|待统计/)
  assert.match(certificateScript, /deriveStats\(progress\)/)
  assert.match(certificateTemplate, /\{\{completionDuration\}\}/)
  assert.doesNotMatch(certificateTemplate, /排名|rankLabel|路程|1\.56 km/)
  assert.match(certificateTemplate, /完成时间/)
  assert.match(certificateTemplate, /总用时/)
})

run('certificate refresh and saved poster use fixed device-local completion times', () => {
  const store = require(path.join(miniRoot, 'utils', 'progress.js'))
  const user = require(path.join(miniRoot, 'utils', 'user.js'))
  const file = path.join(miniRoot, 'pages', 'certificate', 'certificate.js')
  const previousPage = global.Page
  const readProgress = store.readProgress
  const readUser = user.readUser
  let definition
  try {
    global.Page = (page) => { definition = page }
    delete require.cache[require.resolve(file)]
    require(file)
    store.readProgress = () => ({
      completed: 3,
      startedAt: 1000,
      completedAt: 1123000,
      startCheckIn: { qrId: 'QR-START-A', pointCode: '000', assurance: 'LOCAL_QR_MATCH' },
      finishCheckIn: { qrId: 'QR-FINISH-A', pointCode: '999', assurance: 'LOCAL_QR_MATCH' }
    })
    user.readUser = () => ({ nickName: '测试用户' })
    const page = { ...definition, data: { ...definition.data }, setData(update) { Object.assign(this.data, update) } }
    page.refreshCertificate()
    assert.equal(page.data.completionDuration, '00:18:42')
    page.refreshCertificate()
    assert.equal(page.data.completionDuration, '00:18:42')
    assert.equal(page.data.certificateReady, true)
    const texts = []
    const context = new Proxy({ fillText: (text) => texts.push(text) }, {
      get(target, key) { return key in target ? target[key] : () => {} }
    })
    page.drawCertificatePoster(context)
    assert.ok(texts.some((text) => text.includes('完成时间') && text.includes('总用时 00:18:42')))
    assert.doesNotMatch(texts.join('\n'), /排名|路程|1\.56|待统计/)
    assert.ok(texts.some((text) => text.includes('3.50 km')))
    store.readProgress = () => ({ completed: 3, startedAt: 0, completedAt: 1123000 })
    page.refreshCertificate()
    assert.equal(page.data.completionDuration, '--')
  } finally {
    store.readProgress = readProgress
    user.readUser = readUser
    global.Page = previousPage
    delete require.cache[require.resolve(file)]
  }
})

run('wxml has balanced view/block tags', () => {
  for (const page of pages) {
    const wxml = fs.readFileSync(path.join(miniRoot, 'pages', page, `${page}.wxml`), 'utf8')
    const tags = [...wxml.matchAll(/<\/?(view|text|button|image|block)(?:\s[^>]*)?>/g)].map((match) => match[0])
    const stack = []
    for (const tag of tags) {
      if (tag.startsWith('</')) {
        assert.equal(stack.pop(), tag.match(/^<\/(\w+)/)[1], `${page} closing tag`)
      } else if (!tag.endsWith('/>')) {
        stack.push(tag.match(/^<(\w+)/)[1])
      }
    }
    assert.equal(stack.length, 0, `${page} unclosed tags`)
  }
})

run('wxml event handlers exist in page scripts', () => {
  for (const page of pages) {
    const wxml = fs.readFileSync(path.join(miniRoot, 'pages', page, `${page}.wxml`), 'utf8')
    const script = fs.readFileSync(path.join(miniRoot, 'pages', page, `${page}.js`), 'utf8')
    const handlers = [...wxml.matchAll(/(?:bind|catch)[a-z]+="([A-Za-z0-9_]+)"/g)].map((match) => match[1])
    for (const handler of handlers) {
      assert.match(script, new RegExp(`\\b${handler}\\s*\\(`), `${page}.${handler}`)
    }
  }
})

run('wxss files have balanced braces', () => {
  const files = [
    path.join(miniRoot, 'app.wxss'),
    ...pages.map((page) => path.join(miniRoot, 'pages', page, `${page}.wxss`)),
    ...components.map((component) => path.join(miniRoot, 'components', component, `${component}.wxss`))
  ]
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    let depth = 0
    for (const character of source) {
      if (character === '{') depth += 1
      if (character === '}') depth -= 1
      assert.ok(depth >= 0, `${path.basename(file)} closes too many blocks`)
    }
    assert.equal(depth, 0, `${path.basename(file)} has unclosed blocks`)
  }
})

run('warm orange and indigo theme has no legacy green tokens', () => {
  const requiredTokens = ['--ink', '--deep', '--primary', '--orange', '--orange-bright', '--yellow', '--coral', '--lavender', '--peach', '--paper', '--line', '--muted', '--disabled']
  const appStyles = fs.readFileSync(path.join(miniRoot, 'app.wxss'), 'utf8')
  for (const token of requiredTokens) assert.match(appStyles, new RegExp(`${token}:`), token)

  const sourceFiles = [
    path.join(miniRoot, 'app.wxss'),
    path.join(miniRoot, 'app.json'),
    ...pages.map((page) => path.join(miniRoot, 'pages', page, `${page}.wxss`)),
    ...pages.map((page) => path.join(miniRoot, 'pages', page, `${page}.json`)),
    ...components.map((component) => path.join(miniRoot, 'components', component, `${component}.wxss`)),
    path.join(miniRoot, 'components', 'route-map', 'route-map.js'),
    path.join(miniRoot, 'utils', 'route.js'),
    path.join(miniRoot, 'pages', 'certificate', 'certificate.js'),
    path.join(miniRoot, 'pages', 'profile', 'profile.js'),
    path.join(miniRoot, 'pages', 'upload', 'upload.js')
  ]
  const legacyColors = /#(?:102d25|005d46|087d5c|a8ee24|e5f8c7|d9f2e7|f4f7f2|d7e2db|6c7e76|55c7dd|f1694c|edf6f1|e4ebe7|e7f4ec|e4f3ec|8bdcc6|48c4aa|9fc9b6|c5f4db|c2ded3|b1d0c4|c7eadd|85978f)\b/i
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /var\(--(?:green|mint|lime|blue|cream)\)/i, path.relative(root, file))
    assert.doesNotMatch(source, legacyColors, path.relative(root, file))
  }
})

async function runAsync(label, callback) {
  try {
    await callback()
    console.log(`PASS ${label}`)
  } catch (error) {
    console.error(`FAIL ${label}`)
    throw error
  }
}

async function runAsyncTests() {
  await runAsync('photo save callback rechecks profile before completing a point and permits valid completion', async () => {
    const userStore = require(path.join(miniRoot, 'utils', 'user.js'))
    const { QR_TAGS } = require(path.join(miniRoot, 'utils', 'qr-tags.js'))
    const runtime = createPageRuntime('upload')
    try {
      runtime.storage[userStore.KEY] = completeProfile
      const progress = prepareCheckpoint('station')
      progress.checkInStation(0, 'qr-code', { ...QR_TAGS[1], assurance: 'LOCAL_QR_MATCH', observedAt: Date.now() })
      const before = JSON.stringify(progress.readProgress())
      runtime.page.onLoad({ station: '0' })
      runtime.page.setData({ photoPath: 'wxfile://photo.jpg' })
      runtime.page.submitPoint()
      assert.equal(runtime.calls.saves.length, 1, 'valid profile can begin saving')
      delete runtime.storage[userStore.KEY]
      runtime.calls.saves[0].success({ savedFilePath: 'wxfile://saved-photo.jpg' })
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(JSON.stringify(progress.readProgress()), before, 'removed details cannot complete a point asynchronously')
      assert.equal(runtime.page.data.submitting, false)
      assert.equal(runtime.page.data.successVisible, false)
      assert.equal(runtime.calls.redirects.at(-1).url, '/pages/route/route')

      runtime.storage[userStore.KEY] = completeProfile
      runtime.page.submitPoint()
      assert.equal(runtime.calls.saves.length, 2)
      runtime.calls.saves[1].success({ savedFilePath: 'wxfile://saved-photo.jpg' })
      await new Promise((resolve) => setImmediate(resolve))
      assert.equal(progress.readProgress().completed, 1)
      assert.equal(progress.readProgress().photos['0'], 'wxfile://saved-photo.jpg')
      assert.equal(runtime.page.data.successVisible, true)
    } finally {
      runtime.cleanup()
    }
  })
  console.log(`\n${pages.length} pages checked; native mini program structure is ready for DevTools.`)
}

runAsyncTests().catch((error) => {
  process.exitCode = 1
  setImmediate(() => { throw error })
})
