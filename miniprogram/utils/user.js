const KEY = 'patchwalk-user-v1'

function defaultUser() {
  return { nickName: '', avatarUrl: '' }
}

function normalizeUser(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    nickName: typeof source.nickName === 'string' ? source.nickName.trim() : '',
    avatarUrl: typeof source.avatarUrl === 'string' ? source.avatarUrl.trim() : ''
  }
}

function readUser() {
  try {
    return normalizeUser(wx.getStorageSync(KEY))
  } catch (error) {
    return defaultUser()
  }
}

function saveUser(value) {
  const next = normalizeUser(value)
  wx.setStorageSync(KEY, next)
  return next
}

function isProfileComplete(value) {
  const user = normalizeUser(value)
  return Boolean(user.nickName && user.avatarUrl)
}

module.exports = { KEY, defaultUser, normalizeUser, readUser, saveUser, isProfileComplete }
