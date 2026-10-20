Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    user: {
      type: Object,
      value: null,
      observer(value) {
        const user = value || {}
        this.setData({
          draftAvatarUrl: user.avatarUrl || '',
          draftNickName: user.nickName || ''
        })
      }
    }
  },

  data: {
    draftAvatarUrl: '',
    draftNickName: ''
  },

  methods: {
    preventClose() {},

    close() {
      this.triggerEvent('close')
    },

    onChooseAvatar(event) {
      const avatarUrl = event.detail && event.detail.avatarUrl
      if (!avatarUrl) return
      this.setData({ draftAvatarUrl: avatarUrl })
      wx.vibrateShort({ type: 'light' })
    },

    onNicknameInput(event) {
      this.setData({ draftNickName: event.detail.value || '' })
    },

    confirm() {
      const nickName = (this.data.draftNickName || '').trim()
      const avatarUrl = (this.data.draftAvatarUrl || '').trim()
      if (!avatarUrl) {
        wx.showToast({ title: '请先选择微信头像', icon: 'none' })
        return
      }
      if (!nickName) {
        wx.showToast({ title: '请填写微信昵称', icon: 'none' })
        return
      }
      this.submit({ nickName, avatarUrl })
    },

    submit(user) {
      wx.vibrateShort({ type: 'light' })
      this.triggerEvent('save', { user })
    }
  }
})
