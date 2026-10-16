const progressStore = require('../../utils/progress')
const userStore = require('../../utils/user')

Page({
  data: {
    user: userStore.defaultUser(),
    userInitial: '我',
    stats: progressStore.deriveStats(),
    completed: 0,
    badges: [],
    profileVisible: false
  },

  onShow() {
    this.refreshProfile()
  },

  refreshProfile() {
    const user = userStore.readUser()
    const progress = progressStore.readProgress()
    const stats = progressStore.deriveStats(progress)
    this.setData({
      user,
      userInitial: user.nickName ? user.nickName.charAt(0) : '我',
      stats,
      completed: progress.completed,
      badges: [
        { icon: '♙', title: '初次出发', color: 'orange', unlocked: progress.history.length > 0 },
        { icon: 'ϟ', title: '能量满格', color: 'blue', unlocked: progressStore.isFinished(progress) },
        { icon: '☀', title: '完整路线', color: 'coral', unlocked: progressStore.isFinished(progress) }
      ]
    })
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
      userInitial: user.nickName ? user.nickName.charAt(0) : '我',
      profileVisible: false
    })
    wx.showToast({ title: '微信资料已保存', icon: 'success' })
  },

  showPrivacy() {
    wx.showModal({
      title: '隐私与照片',
      content: '照片和头像保存在当前设备，不会上传。活动开启名单收集后，微信昵称、活动编号、完成点位及起止时间会提交给组织者用于完赛名单，只有授权管理员可导出；不用于排名。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#5664C2'
    })
  },

  resetProgress() {
    wx.showModal({
      title: '重置本次路线',
      content: '会清除当前路线的点位和照片记录，历史数据也会一并清除。',
      confirmText: '确认重置',
      confirmColor: '#F15B68',
      success: (result) => {
        if (!result.confirm) return
        progressStore.resetProgress()
        this.refreshProfile()
        wx.showToast({ title: '路线已重置', icon: 'success' })
        setTimeout(() => wx.switchTab({ url: '/pages/route/route' }), 650)
      }
    })
  },

  showHelp() {
    wx.showModal({
      title: '打卡流程',
      content: '先扫描起点开始计时，再依次扫描三个任务点并拍照上传；最后扫描终点结束计时并生成凭证。',
      showCancel: false,
      confirmColor: '#5664C2'
    })
  }
})
