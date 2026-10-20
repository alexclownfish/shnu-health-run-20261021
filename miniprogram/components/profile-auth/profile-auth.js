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

    onNicknameInput(event) {
      this.setData({ draftNickName: event.detail.value || '' })
    },

    confirm() {
      const nickName = (this.data.draftNickName || '').trim()
      const avatarUrl = (this.data.draftAvatarUrl || '').trim()
      if (!nickName) {
        wx.showToast({ title: '请填写参与者姓名', icon: 'none' })
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
