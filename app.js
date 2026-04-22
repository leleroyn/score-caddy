// app.js
App({
  onLaunch: function () {
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-d6glk1co0e9f133dc',
      traceUser: true
    });
    this.getUserInfo();
    this.ensureLogin();
  },

  /**
   * 确保用户已登录（获取 openId 存入 Storage）
   * 返回 Promise，resolve(openId)
   */
  ensureLogin: function () {
    // 已有 openId 直接返回
    const cached = wx.getStorageSync('openId');
    if (cached) {
      this.globalData.openId = cached;
      return Promise.resolve(cached);
    }

    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'login'
      }).then(res => {
        if (res.result && res.result.code === 0 && res.result.openid) {
          const openId = res.result.openid;
          wx.setStorageSync('openId', openId);
          this.globalData.openId = openId;
          resolve(openId);
        } else {
          console.error('[login] 返回异常:', res);
          reject(new Error('登录失败'));
        }
      }).catch(err => {
        console.error('[login] 调用失败:', err);
        reject(err);
      });
    });
  },

  /**
   * 获取用户头像昵称（wx.getUserProfile 已废弃，使用选择头像组件）
   * 这个方法尝试从缓存读取，如果没有则返回空
   */
  getUserInfo: function () {
    const nickName = wx.getStorageSync('nickName') || '';
    const avatarUrl = wx.getStorageSync('avatarUrl') || '';
    this.globalData.userInfo = { nickName, avatarUrl };
    return { nickName, avatarUrl };
  },

  /**
   * 保存用户信息到缓存
   */
  saveUserInfo: function (nickName, avatarUrl) {
    wx.setStorageSync('nickName', nickName);
    wx.setStorageSync('avatarUrl', avatarUrl);
    this.globalData.userInfo = { nickName, avatarUrl };
  },

  globalData: {
    openId: '',
    userInfo: { nickName: '', avatarUrl: '' }
  }
});
