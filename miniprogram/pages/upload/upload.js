const stations = require('../../utils/stations')
const progressStore = require('../../utils/progress')
const photoService = require('../../utils/photo')
const { requireCompleteProfile } = require('../../utils/profile-gate')

Page({
  data: {
    station: stations[0],
    stationIndex: 0,
    photoPath: '',
    privacyAccepted: true,
    submitting: false,
    successVisible: false,
    completed: 0,
    successProgress: 0,
    storageNotice: '',
    continueLabel: '查看下一站'
  },

  onLoad(options = {}) {
    if (!requireCompleteProfile(this)) return
    const stationIndex = Math.min(Math.max(Number(options.station) || 0, 0), 2)
    const progress = progressStore.readProgress()
    if (stationIndex !== progress.completed || !progressStore.canUpload(progress, stationIndex)) {
      wx.showToast({ title: '请先扫码打卡', icon: 'none' })
      // The scanner replaces itself with this page, so one step returns to the route.
      setTimeout(() => wx.navigateBack({ delta: 1 }), 900)
      return
    }
    this.setData({ stationIndex, station: stations[stationIndex] })
  },

  onShow() {
    requireCompleteProfile(this)
  },

  choosePhoto() {
    if (!requireCompleteProfile(this)) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (result) => {
        if (!requireCompleteProfile(this)) return
        const file = result.tempFiles && result.tempFiles[0]
        if (!file) return
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({ title: '照片不能超过 10MB', icon: 'none' })
          return
        }
        this.setData({ photoPath: file.tempFilePath })
        wx.vibrateShort({ type: 'light' })
      },
      fail: (error) => {
        if (!error.errMsg || !error.errMsg.includes('cancel')) {
          wx.showToast({ title: '暂时无法选择照片', icon: 'none' })
        }
      }
    })
  },

  previewPhoto() {
    if (!this.data.photoPath) return
    wx.previewImage({ current: this.data.photoPath, urls: [this.data.photoPath] })
  },

  togglePrivacy() {
    this.setData({ privacyAccepted: !this.data.privacyAccepted })
  },

  submitPoint() {
    if (this.data.submitting) return
    if (!requireCompleteProfile(this)) return
    if (!this.data.privacyAccepted) {
      wx.showToast({ title: '请先确认照片隐私设置', icon: 'none' })
      return
    }
    if (!this.data.photoPath) {
      wx.showToast({ title: '请先拍照或选择照片', icon: 'none' })
      wx.vibrateShort({ type: 'light' })
      return
    }

    this.setData({ submitting: true })
    photoService.saveCheckInPhoto(this.data.photoPath)
      .then((savedPath) => {
      if (!requireCompleteProfile(this)) {
        this.setData({ submitting: false })
        return
      }
      const progress = progressStore.completeStation(this.data.stationIndex, savedPath)
      if (progress.completed <= this.data.stationIndex) {
        this.setData({ submitting: false })
        wx.showToast({ title: '保存状态失效，请重新扫码打卡', icon: 'none' })
        return
      }
      this.setData({
        submitting: false,
        successVisible: true,
        completed: progress.completed,
        successProgress: Math.round(progress.completed / 3 * 100),
        storageNotice: '照片已保存在当前设备',
        continueLabel: progress.completed === 3 ? '前往终点扫码' : '查看下一站'
      })
      wx.vibrateShort({ type: 'medium' })
      })
      .catch((error) => {
        this.setData({ submitting: false })
        wx.vibrateShort({ type: 'heavy' })
        const errorCode = error && error.code && error.code !== 'UNKNOWN' ? `\n错误码：${error.code}` : ''
        wx.showModal({
          title: '照片保存失败',
          content: `请检查设备存储空间后重试。照片未保存成功，本点位不会解锁。${errorCode}`,
          showCancel: false,
          confirmColor: '#5664C2'
        })
      })
  },

  preventClose() {},

  continueRoute() {
    if (this.data.completed === 3) {
      wx.redirectTo({ url: '/pages/checkin/checkin' })
      return
    }
    wx.switchTab({ url: '/pages/route/route' })
  }
})
