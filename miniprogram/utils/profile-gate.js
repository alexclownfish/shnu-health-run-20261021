const userStore = require('./user')

function requireCompleteProfile(page) {
  if (userStore.isProfileComplete(userStore.readUser())) {
    page.profileRedirecting = false
    return true
  }
  if (!page.profileRedirecting) {
    page.profileRedirecting = true
    wx.showToast({ title: '请先填写参与者姓名', icon: 'none' })
    wx.switchTab({
      url: '/pages/route/route',
      fail: () => { page.profileRedirecting = false }
    })
  }
  return false
}

module.exports = { requireCompleteProfile }
