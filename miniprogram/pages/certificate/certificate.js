const stations = require('../../utils/stations')
const progressStore = require('../../utils/progress')
const { formatClock, formatDateCode, formatDuration } = require('../../utils/format')
const userStore = require('../../utils/user')
const completionReport = require('../../utils/completion-report')

Page({
  data: {
    stations,
    certificateId: '',
    completedTime: '',
    completionDuration: '--',
    distance: '0.00',
    participantId: '',
    completed: 0,
    certificateReady: false,
    ownerName: '微信用户',
    savingCertificate: false
  },

  onLoad() {
    this.refreshCertificate()
  },

  onShow() {
    this.refreshCertificate()
    const progress = progressStore.readProgress()
    if (progressStore.isFinished(progress) && !progress.participantId) {
      completionReport.report(progress).then(() => this.refreshCertificate())
    }
  },

  refreshCertificate() {
    const progress = progressStore.readProgress()
    const timestamp = progress.completedAt || Date.now()
    const stats = progressStore.deriveStats(progress)
    this.setData({
      completed: progress.completed,
      certificateReady: progressStore.isFinished(progress),
      certificateId: formatDateCode(timestamp),
      completedTime: formatClock(timestamp),
      completionDuration: formatDuration(progress.startedAt, progress.completedAt),
      distance: stats.distance,
      participantId: progress.participantId || '',
      ownerName: userStore.readUser().nickName || '微信用户'
    })
  },

  backHome() {
    wx.switchTab({ url: '/pages/route/route' })
  },

  saveCertificate() {
    if (this.data.savingCertificate || !this.data.certificateReady) return
    wx.vibrateShort({ type: 'light' })
    this.setData({ savingCertificate: true })
    this.createCertificateImage()
      .then((filePath) => this.saveImageToAlbum(filePath))
      .then(() => {
        this.setData({ savingCertificate: false })
        wx.vibrateShort({ type: 'medium' })
        wx.showToast({ title: '凭证已保存到相册', icon: 'success' })
      })
      .catch((error) => {
        this.setData({ savingCertificate: false })
        this.handleSaveError(error)
      })
  },

  createCertificateImage() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#certificateCanvas')
        .fields({ node: true, size: true })
        .exec((result) => {
          const target = result && result[0]
          if (!target || !target.node) {
            reject(new Error('CERTIFICATE_CANVAS_UNAVAILABLE'))
            return
          }
          const canvas = target.node
          const context = canvas.getContext('2d')
          canvas.width = 750
          canvas.height = 1100
          this.drawCertificatePoster(context)
          const exportImage = () => {
            wx.canvasToTempFilePath({
              canvas,
              x: 0,
              y: 0,
              width: 750,
              height: 1100,
              destWidth: 1500,
              destHeight: 2200,
              fileType: 'png',
              quality: 1,
              success: (exportResult) => resolve(exportResult.tempFilePath),
              fail: reject
            }, this)
          }
          if (typeof canvas.requestAnimationFrame === 'function') canvas.requestAnimationFrame(exportImage)
          else setTimeout(exportImage, 50)
        })
    })
  },

  drawCertificatePoster(context) {
    const width = 750
    const height = 1100
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#f4fbfd'
    context.fillRect(0, 0, width, height)

    this.roundRect(context, 36, 36, 678, 1028, 24, '#ffffff')
    context.save()
    this.roundRectPath(context, 36, 36, 678, 270, 24)
    context.clip()
    context.fillStyle = '#21b9d2'
    context.fillRect(36, 36, 678, 270)
    context.fillStyle = 'rgba(255,211,78,.2)'
    context.beginPath()
    context.arc(85, 275, 150, 0, Math.PI * 2)
    context.fill()
    context.beginPath()
    context.arc(680, 25, 145, 0, Math.PI * 2)
    context.fill()
    context.restore()

    context.textBaseline = 'middle'
    context.textAlign = 'left'
    context.fillStyle = '#ffd22e'
    context.font = '700 22px monospace'
    context.fillText('步履时光 / 完赛凭证', 76, 91)
    context.fillStyle = '#ffffff'
    context.font = '800 38px sans-serif'
    context.fillText('步履时光·健康同行', 76, 158)
    context.fillStyle = '#dff5fa'
    context.font = '400 22px sans-serif'
    context.fillText('完成实景健康路线', 76, 208)

    context.beginPath()
    context.arc(625, 166, 52, 0, Math.PI * 2)
    context.fillStyle = '#ffffff'
    context.fill()
    context.fillStyle = '#21b9d2'
    context.font = '800 52px sans-serif'
    context.textAlign = 'center'
    context.fillText('✓', 625, 170)

    context.fillStyle = '#21b9d2'
    context.font = '700 21px monospace'
    context.fillText(`YOU-PAI-${this.data.certificateId}`, 375, 352)
    context.fillStyle = '#073b67'
    context.font = '700 26px sans-serif'
    const owner = (this.data.ownerName || '微信用户').slice(0, 14)
    context.fillText(`${owner} 的健康完赛凭证`, 375, 400)
    context.font = '700 90px monospace'
    context.fillText('3/3', 375, 493)
    context.font = '800 30px sans-serif'
    context.fillText('打卡完成', 375, 552)

    this.roundRect(context, 76, 596, 598, 220, 18, '#dff5fa')
    this.data.stations.forEach((station, index) => {
      const y = 638 + index * 64
      context.beginPath()
      context.arc(112, y, 20, 0, Math.PI * 2)
      context.fillStyle = '#ffd22e'
      context.fill()
      context.fillStyle = '#0058a5'
      context.font = '700 17px monospace'
      context.textAlign = 'center'
      context.fillText(String(station.id), 112, y + 1)
      context.fillStyle = '#073b67'
      context.font = '600 20px sans-serif'
      context.textAlign = 'left'
      context.fillText(`${station.title} · ${station.location}`, 148, y)
      context.fillStyle = '#0058a5'
      context.font = '700 17px sans-serif'
      context.textAlign = 'right'
      context.fillText('完成', 638, y)
    })

    context.textAlign = 'center'
    context.fillStyle = '#5c7890'
    context.font = '400 19px sans-serif'
    context.fillText(`${this.data.distance} km · 起终点计时完成 · 能量已释放`, 375, 850)
    context.fillStyle = '#0058a5'
    context.font = '600 18px sans-serif'
    context.fillText(`完成时间 ${this.data.completedTime}   ·   总用时 ${this.data.completionDuration}`, 375, 899)

    context.strokeStyle = '#c8e8f0'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(76, 978)
    context.lineTo(674, 978)
    context.stroke()
    context.fillStyle = '#5664C2'
    context.font = '600 18px monospace'
    context.fillText(`参与者编号：${this.data.participantId || '上传后生成'}`, 375, 1019)
  },

  roundRect(context, x, y, width, height, radius, fillStyle) {
    this.roundRectPath(context, x, y, width, height, radius)
    context.fillStyle = fillStyle
    context.fill()
  },

  roundRectPath(context, x, y, width, height, radius) {
    const right = x + width
    const bottom = y + height
    context.beginPath()
    context.moveTo(x + radius, y)
    context.lineTo(right - radius, y)
    context.quadraticCurveTo(right, y, right, y + radius)
    context.lineTo(right, bottom - radius)
    context.quadraticCurveTo(right, bottom, right - radius, bottom)
    context.lineTo(x + radius, bottom)
    context.quadraticCurveTo(x, bottom, x, bottom - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
    context.closePath()
  },

  saveImageToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject })
    })
  },

  handleSaveError(error) {
    const message = error && (error.errMsg || error.message) || ''
    const denied = /auth deny|auth denied|authorize/i.test(message)
    if (denied) {
      wx.showModal({
        title: '需要相册权限',
        content: '请在设置中允许保存图片到相册。',
        confirmText: '去设置',
        confirmColor: '#5664C2',
        success: (result) => {
          if (result.confirm) wx.openSetting()
        }
      })
      return
    }
    wx.showModal({
      title: '凭证保存失败',
      content: '请检查手机存储空间后重试。',
      showCancel: false,
      confirmColor: '#5664C2'
    })
  },

  onShareAppMessage() {
    return {
      title: '我完成了“步履时光·健康同行”活动，3/3 点位全部打卡！',
      path: '/pages/route/route'
    }
  },

  onShareTimeline() {
    return { title: '步履时光·健康同行' }
  }
})
