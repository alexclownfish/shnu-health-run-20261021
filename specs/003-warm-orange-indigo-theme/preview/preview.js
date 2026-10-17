const pageLabels = {
  all: '全流程',
  route: '路线首页',
  checkin: '扫码打卡',
  upload: '照片上传',
  certificate: '完赛凭证',
  records: '运动记录',
  profile: '个人中心'
}

const state = { page: 'all', progress: 0, scan: 'idle', photo: 'idle' }
const screens = document.getElementById('screens')
const picker = document.getElementById('page-picker')
const station = (index = 0) => previewData.stations[index]
const previewDistance = () => (state.progress === 3 ? previewData.totalDistance : state.progress ? previewData.taskDistances[state.progress - 1] : 0).toFixed(2)
function icon(name) {
  return `<i data-lucide="${name}" aria-hidden="true"></i>`
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } })
}

function nativeHeader(title, subtitle = '', share = false) {
  return `<div class="native-nav"><button class="nav-back" aria-label="返回">${icon('chevron-left')}</button><strong>${title}<small>${subtitle}</small></strong><div class="wx-capsule">${share ? icon('share-2') : icon('user-round')}<span></span>${icon('more-horizontal')}</div></div>`
}

function systemBar() {
  return `<div class="system-bar"><span>12:24</span><span class="system-icons">${icon('signal')}${icon('wifi')}${icon('battery-full')}</span></div>`
}

function fixedAction(label, action = 'arrow-up-right', disabled = false) {
  return `<view class="fixed-action"><button class="primary-button" ${disabled ? 'disabled' : ''}><text>${label}</text><text class="arrow">${icon(action)}</text></button></view>`
}

function mapSvg(progress) {
  return `<div class="map"><canvas class="route-canvas" width="620" height="380" data-progress="${progress}"></canvas><span class="map-scale">100m</span><span class="map-north">N</span></div>`
}

function routePage() {
  const currentTitle = state.progress === 0 ? '准备出发' : state.progress === 3 ? '路线已完成' : `下一站 · ${station(state.progress).title}`
  const cta = state.progress === 0 ? '开始漫步' : state.progress === 3 ? '查看完赛凭证' : `前往点位 ${state.progress + 1}`
  return `<div class="device has-tabs">${systemBar()}${nativeHeader('活动路线', '步履拾光·健康同行')}<div class="screen-body"><view class="snapshot"><view class="page route-page with-fixed-action">
    <view class="route-heading"><view><text class="eyebrow">PATCHWALK / 悠湃体育计划</text><text class="page-title">午间漫步</text></view><view class="profile-dot">我</view></view>
    <view class="weather card"><view class="weather-symbol">☼</view><view class="weather-copy"><text>适合轻运动</text><text>多云 · 26°C · 微风</text></view><view class="weather-score"><text>${state.progress} / 3</text><text>已完成</text></view></view>
    <view class="challenge"><view class="challenge-ring ring-one"></view><view class="challenge-ring ring-two"></view><view class="challenge-copy"><text class="challenge-code mono">TODAY / ROUTE 01</text><text class="challenge-title">${previewData.totalDistance.toFixed(2)} 公里实景健康漫步</text><text class="challenge-desc">沿真实轨迹行进，完成 3 次扫码拍照</text></view></view>
    <view class="route-card card"><view class="route-card-head"><view><text class="section-kicker">今日路线</text><text class="route-card-title">${currentTitle}</text></view><text class="section-side">${state.progress} / 3 点位</text></view>${mapSvg(state.progress)}<view class="map-hint"><text class="scan-icon">⌗</text><text>到达点位后打开打卡页 · 扫码打卡</text></view></view>
    <view class="section-head"><view><text class="section-kicker">沿途任务</text><text class="section-title">3 个健康点位</text></view><text class="demo-link">按顺序完成</text></view>
    <view class="station-list">${previewData.stations.map((item, index) => `<view class="station-card card ${index < state.progress ? 'done' : ''} ${index > state.progress ? 'locked' : ''}"><view class="station-number">${index < state.progress ? '✓' : index + 1}</view><view class="station-copy"><text>${item.title}</text><text>${item.location} · ${item.tag}</text></view><view class="station-meta"><text>${index < state.progress ? 'DONE' : index === state.progress && state.progress < 3 ? 'NEXT' : 'LOCKED'}</text></view></view>`).join('')}</view>
    ${fixedAction(cta)}
  </view></view></div>${tabBar('route')}<div class="home-indicator"></div></div>`
}

function checkinPage() {
  const scanMap = { idle: ['等待开始', '点击扫码后，对准现场标牌上的点位二维码。', 'reader-idle', 'QR'], scanning: ['打开相机', '请对准现场标牌上的点位二维码。', '', 'CODE'], success: ['二维码已核对', '点位二维码一致，即将进入拍照上传。', 'reader-success', '✓'], error: ['点位不匹配', '请扫描当前点位标牌上的二维码。', 'reader-error', '!'], cancel: ['已取消扫码', '需要打卡时，可重新打开相机扫描点位二维码。', 'reader-error', '!'] }
  const [status, message, extra, glyph] = scanMap[state.scan]
  return `<div class="device">${systemBar()}${nativeHeader('点位打卡', `点位 1 · ${station(0).title}`)}<div class="screen-body"><view class="snapshot"><view class="page checkin-page"><view class="status-line"><view class="status-dot ${state.scan === 'success' ? 'success' : state.scan === 'error' || state.scan === 'cancel' ? 'error' : 'active'}"></view><text class="mono">${status}</text></view><view class="reader reader-qr ${extra}"><view class="reader-ring ring-a"></view><view class="reader-ring ring-b"></view><view class="reader-phone"><view class="reader-speaker"></view><text>${glyph}</text></view>${state.scan === 'scanning' ? '<view class="reader-tag">CODE</view>' : ''}</view><view class="result-copy"><text class="eyebrow">POINT 1 / ${station(0).location}</text><text class="result-title">${state.scan === 'idle' ? '准备扫码' : status}</text><text class="result-message">${message}</text></view><view class="assurance-note"><text class="note-title">本机验证</text><text>打卡进度仅保存在当前设备。清除数据、重装或更换手机后无法恢复。</text></view><view class="checkin-actions"><button class="primary-button" ${state.scan === 'success' ? 'disabled' : ''}>${state.scan === 'success' ? '已完成扫码' : state.scan === 'idle' ? '扫码打卡' : '重新尝试'} ${icon('scan-line')}</button><button class="secondary-button">返回路线</button></view></view></div></div><div class="home-indicator"></div></div>`
}

function uploadPage() {
  const saved = state.photo === 'saved'
  return `<div class="device">${systemBar()}${nativeHeader('上传打卡照片', '点位 1 · 肩颈舒展')}<div class="screen-body"><view class="snapshot"><view class="page upload-page with-fixed-action"><view class="upload-intro"><text class="eyebrow">CHECK-IN PHOTO / 记录当下</text><text class="upload-title">拍照上传，完成点位</text><text class="upload-copy">支持单人自拍，也可以邀请同伴一起入镜。</text></view><view class="photo-stage ${state.photo !== 'idle' ? 'has-photo' : ''}"><view class="photo-sun"></view><view class="photo-mountain mountain-one"></view><view class="photo-mountain mountain-two"></view><view class="photo-person"><view class="photo-head"></view><view class="photo-body"></view><view class="photo-arm left"></view><view class="photo-arm right"></view></view><view class="camera-prompt"><text class="camera-icon">▣</text><view><text>${saved ? '照片已保存到当前设备' : state.photo === 'selected' ? '已选择打卡照片' : '拍照或从相册选择'}</text><text>JPG / PNG，单张不超过 10MB</text></view></view></view><view class="section-head tips-head"><view><text class="section-kicker">PHOTO GUIDE</text><text class="section-title">拍照小贴士</text></view><text class="section-side">1 / 3</text></view><view class="photo-tips"><view class="card"><text class="tip-symbol">⌗</text><text>现场清晰</text><text>人物完整</text></view><view class="card"><text class="tip-symbol">♙</text><text>光线充足</text><text>画面稳定</text></view><view class="card"><text class="tip-symbol">◉</text><text>避开工牌</text><text>敏感信息</text></view></view><view class="privacy-row"><view class="checkbox checked">✓</view><text>仅用于本次健康打卡记录，不会公开展示</text></view>${fixedAction(saved ? '点位已完成' : '保存并完成点位', 'upload', state.photo === 'idle')}</view></div></div><div class="home-indicator"></div></div>`
}

function certificatePage() {
  return `<div class="device">${systemBar()}${nativeHeader('完赛凭证', 'PATCHWALK 2026', true)}<div class="screen-body"><view class="snapshot"><view class="page certificate-page"><view class="certificate card"><view class="certificate-top"><view class="decor decor-one"></view><view class="decor decor-two"></view><text class="certificate-code mono">PATCH COMPLETE / RELEASE</text><text class="certificate-title">步履拾光·健康同行</text><text class="certificate-subtitle">完成实景健康路线</text><view class="complete-seal">✓</view></view><view class="certificate-body"><text class="certificate-id mono">PATCH-WALK-260930</text><text class="certificate-owner">微信用户的健康完赛凭证</text><view class="score"><text>3/3</text><text>打卡完成</text></view><view class="certificate-stations">${previewData.stations.map((item, index) => `<view><text class="station-dot">${item.id}</text><text>${item.title} · ${item.location}</text><text>完成</text></view>`).join('')}</view><text class="certificate-note">回到起点 · 能量已释放</text><view class="certificate-meta"><text>完成时间 <text>12:42</text></text><text>总用时 <text>00:18:42</text></text></view><view class="certificate-footer"><text class="certificate-participant mono">参与者编号：上传后生成</text></view></view></view><view class="certificate-actions"><button class="secondary-button">⇩ 保存凭证</button><button class="secondary-button">⌯ 分享给同事</button></view>${fixedAction('返回活动首页', 'home')}</view></div></div><div class="home-indicator"></div></div>`
}

function recordsPage() {
  return `<div class="device has-tabs">${systemBar()}${nativeHeader('运动记录', 'ACTIVITY LOG')}<div class="screen-body"><view class="snapshot"><view class="page records-page"><view class="page-heading"><text class="eyebrow">ACTIVITY LOG</text><text class="page-title">运动记录</text></view><view class="week-summary"><view class="summary-copy"><text>本次路线能量</text><text>${state.progress * 40}</text><text class="mono">ENERGY POINTS</text></view><view class="energy-ring" style="--percent:${Math.round(state.progress / 3 * 100)}%;"><view><text>${Math.round(state.progress / 3 * 100)}%</text></view></view></view><view class="metric-grid"><view class="card"><text class="metric-icon">⌁</text><text class="metric-value mono">${previewDistance()}</text><text class="metric-label">累计公里</text></view><view class="card"><text class="metric-icon">◷</text><text class="metric-value mono">${state.progress ? '10' : '0'}</text><text class="metric-label">实际分钟</text></view><view class="card"><text class="metric-icon">✓</text><text class="metric-value mono">${state.progress}</text><text class="metric-label">完成点位</text></view></view><view class="calendar card"><view class="section-head calendar-head"><view><text class="section-kicker">ACTIVITY CALENDAR</text><text class="section-title">真实打卡节奏</text></view><view class="calendar-nav"><text>‹</text><text>2026.09</text><text>›</text></view></view><view class="week-labels">${'一二三四五六日'.split('').map((x) => `<text>${x}</text>`).join('')}</view><view class="week-days">${Array.from({ length: 21 }, (_, i) => `<view class="day-cell ${i === 15 ? 'today' : ''} ${i < state.progress ? 'active' : ''}">${i + 1}</view>`).join('')}</view></view><view class="section-head"><view><text class="section-kicker">RECENT</text><text class="section-title">最近活动</text></view></view><view class="history-list">${state.progress ? `<view class="history-item"><view class="history-date"><text>30</text><text>SEP</text></view><view class="history-copy"><text>点位 1 · 肩颈舒展</text><text>本机扫码完成 · 照片已保存</text></view><text class="history-status">完成</text></view>` : '<view class="empty-history"><text>还没有打卡记录</text><text>完成第一个点位扫码后，这里会显示真实活动。</text></view>'}</view></view></div></div>${tabBar('records')}<div class="home-indicator"></div></div>`
}

function profilePage() {
  return `<div class="device has-tabs">${systemBar()}${nativeHeader('个人中心', 'MY PATCHWALK')}<div class="screen-body"><view class="snapshot"><view class="page profile-page"><view class="page-heading"><text class="eyebrow">MY PATCHWALK</text><text class="page-title">个人中心</text></view><view class="profile-hero"><view class="profile-avatar">我</view><view class="profile-copy"><text>微信用户</text><text class="profile-edit">点击授权微信头像和昵称</text><text class="route-status">本次路线 ${state.progress} / 3 点位</text></view><text class="chevron">›</text></view><view class="level-card card"><view class="level-head"><text>本次健康能量</text><text class="mono">${state.progress * 40} / 120</text></view><view class="level-track"><view style="width:${Math.round(state.progress / 3 * 100)}%"></view></view><view class="level-foot"><text>${previewDistance()} km 已记录</text><text>${state.progress ? '10 分钟' : '完成后生成时长'}</text></view></view><view class="section-head"><view><text class="section-kicker">BADGES</text><text class="section-title">我的徽章</text></view><text class="section-side">4 枚</text></view><view class="badge-grid"><view><view class="badge">☼</view><text>轻运动</text></view><view><view class="badge blue">ϟ</view><text>能量满格</text></view><view><view class="badge coral">☀</view><text>完整路线</text></view><view><view class="badge locked">?</view><text>待解锁</text></view></view><view class="settings-list card"><view><view class="setting-icon">◇</view><text>隐私与照片</text><text>仅自己可见</text><text class="chevron">›</text></view><view><view class="setting-icon">↶</view><text>重置本次路线</text><text>${state.progress} / 3 点位</text><text class="chevron">›</text></view><view><view class="setting-icon">?</view><text>打卡流程说明</text><text></text><text class="chevron">›</text></view></view></view></div></div>${tabBar('profile')}<div class="home-indicator"></div></div>`
}

function tabBar(active) {
  return `<nav class="tab-bar">${[['route', '路线', 'map'], ['records', '记录', 'calendar-days'], ['profile', '我的', 'user-round']].map(([key, label, iconName]) => `<button class="${key === active ? 'active' : ''}">${icon(iconName)}<br>${label}</button>`).join('')}</nav>`
}

function pageMarkup(page) {
  return { route: routePage, checkin: checkinPage, upload: uploadPage, certificate: certificatePage, records: recordsPage, profile: profilePage }[page]()
}

function renderPicker() {
  picker.innerHTML = Object.entries(pageLabels).map(([key, label]) => `<button type="button" aria-pressed="${state.page === key}" data-page="${key}">${label}</button>`).join('')
  picker.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { state.page = button.dataset.page; render() }))
}

function drawMaps() {
  document.querySelectorAll('.route-canvas').forEach((canvas) => {
    const context = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    context.fillStyle = '#f2eee8'
    context.fillRect(0, 0, width, height)
    context.strokeStyle = '#d8d8dd'
    context.lineWidth = 2
    for (let x = 30; x < width; x += 72) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 48, height); context.stroke() }
    for (let y = 18; y < height; y += 64) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y + 30); context.stroke() }
    const points = previewData.points
    const latitudes = points.map((p) => p.latitude)
    const longitudes = points.map((p) => p.longitude)
    const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes), minLon = Math.min(...longitudes), maxLon = Math.max(...longitudes)
    const xy = (point) => [52 + (point.longitude - minLon) / (maxLon - minLon) * (width - 104), height - 48 - (point.latitude - minLat) / (maxLat - minLat) * (height - 96)]
    context.lineJoin = 'round'
    previewData.segments.forEach((segment) => {
      context.strokeStyle = '#ffffff'
      context.lineWidth = 15
      context.beginPath()
      segment.forEach((point, index) => { const [x, y] = xy(point); index ? context.lineTo(x, y) : context.moveTo(x, y) })
      context.stroke()
      context.strokeStyle = '#f76b2b'
      context.lineWidth = 7
      context.setLineDash([10, 7])
      context.stroke()
      context.setLineDash([])
    })
    previewData.markers.filter((marker) => marker.id > 0 && marker.id < 4).forEach((marker, index) => {
      const [x, y] = xy(marker)
      const completed = index < Number(canvas.dataset.progress)
      context.fillStyle = completed ? '#3f4b9f' : ['#ffd34e', '#5664c2', '#f15b68'][index]
      context.beginPath(); context.arc(x, y, 18, 0, Math.PI * 2); context.fill()
      context.strokeStyle = '#fff'; context.lineWidth = 4; context.stroke()
      context.fillStyle = completed || index === 1 ? '#fff' : '#2b2330'; context.font = '700 18px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(completed ? '✓' : String(index + 1), x, y)
    })
    previewData.markers.filter((marker) => marker.id === 0 || marker.id === 4).forEach((marker) => {
      const [px, py] = xy(marker)
      const x = px + (marker.id === 0 ? -22 : 22), y = py
      context.strokeStyle = marker.label.bgColor; context.lineWidth = 2
      context.beginPath(); context.moveTo(px, py); context.lineTo(x, y); context.stroke()
      context.fillStyle = marker.label.bgColor
      context.beginPath(); context.arc(x, y, 16, 0, Math.PI * 2); context.fill()
      context.strokeStyle = '#fff'; context.lineWidth = 3; context.stroke()
      context.fillStyle = '#fff'; context.font = '700 16px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'
      context.fillText(marker.label.content, x, y)
    })
  })
}

function render() {
  renderPicker()
  const visible = state.page === 'all' ? ['route', 'checkin', 'upload', 'certificate', 'records', 'profile'] : [state.page]
  screens.classList.toggle('single', visible.length === 1)
  screens.innerHTML = visible.map((page) => `<article><h2 class="screen-title"><span>${pageLabels[page]}</span><span>${page === 'route' ? `${state.progress}/3` : page === 'checkin' ? state.scan.toUpperCase() : page === 'upload' ? state.photo.toUpperCase() : 'PREVIEW'}</span></h2>${pageMarkup(page)}</article>`).join('')
  drawMaps()
  refreshIcons()
}

document.getElementById('progress-picker').addEventListener('change', (event) => { state.progress = Number(event.target.value); render() })
document.getElementById('scan-picker').addEventListener('change', (event) => { state.scan = event.target.value; render() })
document.getElementById('photo-picker').addEventListener('change', (event) => { state.photo = event.target.value; render() })
render()
