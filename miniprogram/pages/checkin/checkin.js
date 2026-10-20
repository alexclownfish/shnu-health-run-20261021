const stations = require('../../utils/stations')
const progressStore = require('../../utils/progress')
const qrValidation = require('../../utils/qr-validation')
const { QR_TAGS } = require('../../utils/qr-tags')
const completionReport = require('../../utils/completion-report')
const { requireCompleteProfile } = require('../../utils/profile-gate')

const REASON_CONTENT = {
  NO_CURRENT_STATION: ['暂无待打卡点位', '路线可能已经完成，请返回路线页查看当前进度。'],
  WRONG_POINT: ['点位不匹配', '请扫描当前点位标牌上的二维码。'],
  QR_CANCELLED: ['已取消扫码', '需要打卡时，可重新打开相机扫描点位二维码。'],
  CAMERA_DENIED: ['无法使用相机', '请在系统设置中允许微信使用相机后重试。'],
  QR_SCAN_FAILED: ['扫码启动失败', '请检查相机权限后重新尝试。'],
  QR_INVALID: ['二维码格式无效', '请扫描活动标牌上的点位二维码。'],
  QR_UNKNOWN: ['二维码未登记', '这个二维码不在本次活动清单中。'],
  QR_CONFIG_DUPLICATE: ['二维码配置冲突', '活动二维码清单存在重复配置，请联系现场工作人员。'],
  NO_CURRENT_CHECKPOINT: ['暂无可打卡检查点', '请返回路线页查看当前流程。']
}

Page({
  data: {
    state: 'INITIALIZING',
    statusLabel: '正在准备',
    title: '正在读取当前点位',
    message: '请保持页面打开。',
    checkpointLabel: 'LOCAL CHECK IN',
    station: null,
    showPrimary: false,
    showRetry: false,
    showRoute: false,
    success: false
  },

  onLoad() {
    this.pageActive = true
    this.pageUnloaded = false
    this.qrScanActive = false
    this.accepted = false
    this.attemptId = 0
    this.needsReset = false
    this.initializeContext()
  },

  onShow() {
    this.pageActive = true
    if (!requireCompleteProfile(this)) return
    if (this.accepted) {
      this.scheduleNavigation()
      return
    }
    if (this.needsReset && !this.accepted) {
      this.needsReset = false
      this.initializeContext()
    }
  },

  onHide() {
    this.pageActive = false
    if (this.qrScanActive) return
    this.attemptId += 1
    this.stopPending()
    if (!this.accepted) this.needsReset = true
  },

  onUnload() {
    this.pageActive = false
    this.pageUnloaded = true
    this.qrScanActive = false
    this.attemptId += 1
    this.stopPending()
  },

  stopPending() {
    if (this.navigationTimer) clearTimeout(this.navigationTimer)
    this.navigationTimer = null
  },

  initializeContext() {
    this.stopPending()
    this.expectedCheckpointType = null
    this.expectedStationIndex = null
    if (!requireCompleteProfile(this)) {
      this.setData({
        state: 'PROFILE_REQUIRED',
        statusLabel: '请先填写姓名',
        title: '填写姓名后再打卡',
        message: '请返回路线页填写参与者姓名。',
        showPrimary: false,
        showRetry: false,
        showRoute: true,
        success: false
      })
      return
    }
    const progress = progressStore.readProgress()
    const checkpoint = progressStore.getCurrentCheckpoint(progress)
    this.expectedStationIndex = null
    if (checkpoint && checkpoint.type === 'start') {
      this.expectedCheckpointType = 'start'
      this.setData({
        state: 'IDLE_QR',
        statusLabel: '等待出发',
        checkpointLabel: 'START / 起点',
        title: '扫描起点二维码',
        message: '扫描起点二维码后开始计时，再前往第一个任务点。',
        station: null,
        showPrimary: true,
        showRetry: false,
        showRoute: true,
        success: false
      })
      return
    }
    if (checkpoint && checkpoint.type === 'finish') {
      this.expectedCheckpointType = 'finish'
      this.setData({
        state: 'IDLE_QR',
        statusLabel: '等待结束',
        checkpointLabel: 'FINISH / 终点',
        title: '扫描终点二维码',
        message: '三个任务点已完成，扫描终点二维码结束计时。',
        station: null,
        showPrimary: true,
        showRetry: false,
        showRoute: true,
        success: false
      })
      return
    }
    if (!checkpoint || checkpoint.type !== 'station') {
      this.expectedCheckpointType = null
      this.expectedStationIndex = null
      this.showRejected('NO_CURRENT_STATION', false)
      return
    }

    this.expectedCheckpointType = 'station'
    this.expectedStationIndex = progress.completed
    this.setData({
      state: 'IDLE_QR',
      statusLabel: '等待开始',
      checkpointLabel: `POINT ${stations[this.expectedStationIndex].id} / ${stations[this.expectedStationIndex].location}`,
      title: `${stations[this.expectedStationIndex].title} · 扫码打卡`,
      message: '点击扫码后，对准现场标牌上的点位二维码。',
      station: stations[this.expectedStationIndex],
      showPrimary: true,
      showRetry: false,
      showRoute: true,
      success: false
    })
  },

  startQrScan() {
    if (this.accepted || this.qrScanActive || this.pageUnloaded || !this.pageActive) return
    if (!requireCompleteProfile(this)) return
    this.initializeContext()
    if (this.expectedCheckpointType === 'station' && !Number.isInteger(this.expectedStationIndex)) return
    if (!this.expectedCheckpointType) return
    if (typeof wx.scanCode !== 'function') {
      this.showRejected('QR_SCAN_FAILED', true)
      return
    }

    const attemptId = ++this.attemptId
    this.qrScanActive = true
    this.setData({
      state: 'SCANNING_QR',
      statusLabel: '打开相机',
      title: this.expectedCheckpointType === 'start'
        ? '起点 · 扫描二维码'
        : this.expectedCheckpointType === 'finish'
          ? '终点 · 扫描二维码'
          : `点位 ${this.expectedStationIndex + 1} · 扫描二维码`,
      message: this.expectedCheckpointType === 'start'
        ? '请对准起点标牌上的二维码。'
        : this.expectedCheckpointType === 'finish'
          ? '请对准终点标牌上的二维码。'
          : '请对准现场标牌上的点位二维码。',
      showPrimary: false,
      showRetry: false,
      showRoute: false,
      success: false
    })

    const fail = (error) => {
      if (!this.finishQrScan(attemptId)) return
      const result = qrValidation.normalizeScanError(error)
      this.showRejected(result.reasonCode, result.retryable)
    }
    try {
      wx.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode'],
        success: (result) => {
          if (!this.finishQrScan(attemptId)) return
          this.handleValidationResult(qrValidation.validateQrResult({
            expectedStationIndex: this.expectedStationIndex,
            expectedCheckpointType: this.expectedCheckpointType,
            result,
            qrTags: QR_TAGS
          }), attemptId)
        },
        fail
      })
    } catch (error) {
      fail(error)
    }
  },

  finishQrScan(attemptId) {
    if (this.pageUnloaded || !this.qrScanActive || attemptId !== this.attemptId) return false
    this.qrScanActive = false
    this.pageActive = true
    this.needsReset = false
    return true
  },

  handleValidationResult(result, attemptId) {
    if (!this.pageActive || this.accepted || attemptId !== this.attemptId) return
    if (!requireCompleteProfile(this)) return
    if (!result.ok) {
      this.showRejected(result.reasonCode, result.retryable)
      return
    }

    const checkpoint = progressStore.getCurrentCheckpoint(progressStore.readProgress())
    if (!checkpoint || checkpoint.type !== result.checkpointType ||
      (checkpoint.type === 'station' && checkpoint.stationIndex !== result.stationIndex)) {
      this.showRejected('WRONG_POINT', false)
      return
    }

    let progress
    let identityMatches = false
    if (result.checkpointType === 'start') {
      progress = progressStore.startCheckIn({ ...result, reportingContext: completionReport.captureContext() })
      identityMatches = progress.startCheckIn && progress.startCheckIn.qrId === result.qrId
    } else if (result.checkpointType === 'finish') {
      progress = progressStore.finishCheckIn(result)
      identityMatches = progress.finishCheckIn && progress.finishCheckIn.qrId === result.qrId
    } else {
      progress = progressStore.checkInStation(result.stationIndex, 'qr-code', result)
      const checkIn = progress.checkins[String(result.stationIndex)]
      identityMatches = checkIn && checkIn.qrId === result.qrId
    }
    if (!identityMatches) {
      this.showRejected('WRONG_POINT', false)
      return
    }

    const reportPromise = result.checkpointType === 'finish'
      ? completionReport.report(progress)
      : Promise.resolve()

    this.accepted = true
    this.acceptedCheckpointType = result.checkpointType
    this.acceptedStationIndex = result.stationIndex
    this.stopPending()
    this.setData({
      state: 'ACCEPTED',
      statusLabel: result.checkpointType === 'start' ? '起点已核对' : result.checkpointType === 'finish' ? '终点已核对' : '二维码已核对',
      checkpointLabel: result.checkpointType === 'start' ? 'START / 起点' : result.checkpointType === 'finish' ? 'FINISH / 终点' : this.data.checkpointLabel,
      title: result.checkpointType === 'start'
        ? '起点打卡成功'
        : result.checkpointType === 'finish'
          ? '终点打卡成功'
          : `${stations[result.stationIndex].title} · 打卡成功`,
      message: result.checkpointType === 'start'
        ? '计时已开始，即将返回路线页。'
        : result.checkpointType === 'finish'
          ? '计时已结束，即将生成完赛凭证。'
          : '点位二维码一致，即将进入拍照上传。',
      showPrimary: false,
      showRetry: false,
      showRoute: false,
      success: true
    })
    if (typeof wx.vibrateShort === 'function') wx.vibrateShort({ type: 'medium' })
    this.scheduleNavigation(reportPromise)
 },

  scheduleNavigation(afterReport = Promise.resolve()) {
   this.stopPending()
    Promise.resolve(afterReport).catch(() => {}).then(() => {
      if (!this.pageActive || !this.accepted) return
      this.navigationTimer = setTimeout(() => {
        this.navigationTimer = null
        if (!this.pageActive || !this.accepted) return
        if (this.acceptedCheckpointType === 'start') {
          wx.switchTab({ url: '/pages/route/route' })
        } else if (this.acceptedCheckpointType === 'finish') {
          wx.redirectTo({ url: '/pages/certificate/certificate' })
        } else {
          // 点位二维码核验成功后直接进入拍照页；动作图示和动作等待计时已取消。
          wx.redirectTo({ url: `/pages/upload/upload?station=${this.acceptedStationIndex}` })
        }
      }, 700)
    })
 },

  showRejected(reasonCode, retryable) {
    const content = REASON_CONTENT[reasonCode] || ['暂时无法打卡', '请返回路线页后重新尝试。']
    this.setData({
      state: 'REJECTED',
      statusLabel: '未完成打卡',
      title: content[0],
      message: content[1],
      showPrimary: false,
      showRetry: Boolean(retryable),
      showRoute: true,
      success: false
    })
  },

  retry() {
    if (this.accepted) return
    this.pageActive = true
    this.startQrScan()
  },

  goRoute() {
    this.attemptId += 1
    this.qrScanActive = false
    this.stopPending()
    wx.switchTab({ url: '/pages/route/route' })
  }
})
