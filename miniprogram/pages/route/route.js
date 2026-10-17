const stations = require('../../utils/stations')
const progressStore = require('../../utils/progress')
const userStore = require('../../utils/user')
const { getActivityContext } = require('../../utils/format')
const routeData = require('../../utils/route')

Page({
  data: {
    totalDistance: routeData.TOTAL_DISTANCE_KM.toFixed(2),
    stations: [],
    completed: 0,
    started: false,
    finished: false,
    progressTitle: '准备出发',
    ctaLabel: '扫描起点',
    mapHint: '先扫描起点二维码，开始计时',
    elapsedLabel: '00:00:00',
    timingStatus: '起点扫码后开始',
    user: userStore.defaultUser(),
    userInitial: '我',
    activity: getActivityContext(),
    profileVisible: false
  },

  onLoad() {
    if (typeof setInterval === 'function') this.timer = setInterval(() => this.refreshTiming(), 1000)
    this.refreshProgress()
    const user = userStore.readUser()
    if (!userStore.isProfileComplete(user)) this.setData({ profileVisible: true })
  },

  onShow() {
    if (!this.timer && typeof setInterval === 'function') this.timer = setInterval(() => this.refreshTiming(), 1000)
    this.refreshProgress()
  },

  onHide() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  },

  onPullDownRefresh() {
    this.refreshProgress()
    wx.stopPullDownRefresh()
  },

  refreshProgress() {
    const progress = progressStore.readProgress()
    const started = Boolean(progress.startedAt)
    const finished = progressStore.isFinished(progress)
    const viewStations = stations.map((station, index) => ({
      ...station,
      index,
      number: String(index + 1).padStart(2, '0'),
      done: index < progress.completed,
      current: started && index === progress.completed && progress.completed < 3,
      locked: !started || index > progress.completed,
      status: index < progress.completed ? '已完成' : started && index === progress.completed ? '下一点' : '待解锁'
    }))

    const progressTitle = !started
      ? '扫描起点开始计时'
      : finished
        ? '路线已完成'
        : progress.completed === 3
          ? '扫描终点结束计时'
          : `下一站 · ${stations[progress.completed].title}`
    const ctaLabel = !started
      ? '扫描起点'
      : finished
        ? '查看完赛凭证'
        : progress.completed === 3
          ? '扫描终点'
          : `前往点位 ${progress.completed + 1}`
    const mapHint = !started
      ? '先扫描起点二维码，开始计时'
      : finished
        ? '已完成起点、3 个任务点和终点打卡'
        : progress.completed === 3
          ? '3 个任务点已完成，请扫描终点二维码'
          : '到达点位后打开打卡页 · 扫码打卡'

    this.setData({
      stations: viewStations,
      completed: progress.completed,
      started,
      finished,
      progressTitle,
      ctaLabel,
      mapHint,
      user: userStore.readUser(),
      userInitial: this.getUserInitial(userStore.readUser()),
      activity: getActivityContext()
    })
    this.refreshTiming(progress)
  },

  refreshTiming(progress = progressStore.readProgress()) {
    const startedAt = Number(progress.startedAt) || 0
    const finishedAt = Number(progress.completedAt) || 0
    const elapsed = startedAt ? Math.max(0, (finishedAt || Date.now()) - startedAt) : 0
    const seconds = Math.floor(elapsed / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const rest = seconds % 60
    const pad = (value) => String(value).padStart(2, '0')
    this.setData({
      elapsedLabel: `${pad(hours)}:${pad(minutes)}:${pad(rest)}`,
      timingStatus: !startedAt ? '起点扫码后开始' : finishedAt ? '计时已结束' : '计时进行中'
    })
  },

  getUserInitial(user) {
    return user && user.nickName ? user.nickName.charAt(0) : '我'
  },

  openProfileAuthorization() {
    this.setData({ profileVisible: true })
  },

  closeProfileAuthorization() {
    this.setData({ profileVisible: false })
  },

  saveAuthorizedProfile(event) {
    const user = userStore.saveUser(event.detail && event.detail.user)
    getApp().globalData.user = user
    this.setData({
      user,
      userInitial: this.getUserInitial(user),
      profileVisible: false
    })
    wx.showToast({ title: '微信资料已保存', icon: 'success' })
  },

  handleStart() {
    wx.vibrateShort({ type: 'light' })
    if (this.data.finished) {
      wx.navigateTo({ url: '/pages/certificate/certificate' })
      return
    }
    this.openCheckin()
  },

  handleStationTap(event) {
    const index = event.detail && event.detail.index !== undefined
      ? Number(event.detail.index)
      : Number(event.currentTarget.dataset.index)
    const station = this.data.stations[index]
    if (!station || station.locked) {
      wx.showToast({ title: this.data.started ? '请按路线依次打卡' : '请先扫描起点', icon: 'none' })
      return
    }
    if (station.done) {
      wx.showToast({ title: '该点位已完成', icon: 'success' })
      return
    }
    wx.vibrateShort({ type: 'light' })
    this.openCheckin()
  },

  handleStartTap() {
    if (this.data.started) {
      wx.showToast({ title: '起点已打卡', icon: 'none' })
      return
    }
    this.handleStart()
  },

  handleFinishTap() {
    if (!this.data.started || this.data.completed < 3) {
      wx.showToast({ title: '请先完成三个任务点', icon: 'none' })
      return
    }
    this.handleStart()
  },

  openCheckin() {
    wx.navigateTo({ url: '/pages/checkin/checkin' })
  },

  onShareAppMessage() {
    return {
      title: '步履拾光·健康同行，一起走完这条健康路线',
      path: '/pages/route/route'
    }
  },

  onShareTimeline() {
    return {
      title: '步履拾光·健康同行'
    }
  }
})
