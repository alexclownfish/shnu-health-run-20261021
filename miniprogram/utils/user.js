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
  // Keep nickName as the stored field for the manually entered participant name.
  // Existing local avatars remain optional display data.
  return Boolean(user.nickName)
}

module.exports = { KEY, defaultUser, normalizeUser, readUser, saveUser, isProfileComplete }
