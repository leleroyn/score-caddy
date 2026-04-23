// pages/create/create.js
const app = getApp();

Page({
  data: {
    playerCount: 4,
    showMoreCount: false,
    joinRoomCode: '',
    isCreating: false,
    isJoining: false,
    enableTea: false
  },

  onLoad: function (options) {
    // 通过分享链接进入，自动填入房间号
    if (options && options.joinCode) {
      this.setData({ joinRoomCode: options.joinCode });
      setTimeout(() => { this.joinRoom(); }, 500);
    }
  },

  /**
   * 快捷选择玩家数量
   */
  setPlayerCount: function (e) {
    this.setData({ playerCount: parseInt(e.currentTarget.dataset.count) });
  },

  toggleMoreCount: function () {
    this.setData({ showMoreCount: !this.data.showMoreCount });
  },

  toggleTea: function () {
    this.setData({ enableTea: !this.data.enableTea });
  },

  onJoinCodeInput: function (e) {
    let val = e.detail.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    this.setData({ joinRoomCode: val });
  },

  /**
   * 创建房间
   */
  createRoom: function () {
    if (this.data.isCreating) return;

    this.setData({ isCreating: true });
    wx.showLoading({ title: '创建中...', mask: true });

    // 先确保登录
    app.ensureLogin().then(openId => {
      return wx.cloud.callFunction({
        name: 'createRoom',
        data: {
          playerCount: this.data.playerCount,
          enableTea: this.data.enableTea
        }
      });
    }).then(res => {
      wx.hideLoading();
      this.setData({ isCreating: false });

      if (res.result && res.result.code === 0) {
        const roomInfo = res.result.room;
        wx.setStorageSync('lastRoomCode', roomInfo.roomCode);
        wx.redirectTo({
          url: '/pages/room/room?roomCode=' + roomInfo.roomCode + '&isCreator=1'
        });
      } else {
        wx.showToast({
          title: (res.result && res.result.message) || '创建失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isCreating: false });
      console.error('createRoom:', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    });
  },

  /**
   * 加入房间（支持已结束房间查看历史）
   */
  joinRoom: function () {
    if (this.data.isJoining) return;

    const code = this.data.joinRoomCode.trim().toUpperCase();
    if (code.length !== 6) {
      wx.showToast({ title: '请输入6位房间号', icon: 'none' });
      return;
    }

    this.setData({ isJoining: true });
    wx.showLoading({ title: '查询中...', mask: true });

    const self = this;

    // 先查房间状态
    wx.cloud.database().collection('rooms').where({ roomCode: code }).get().then(function (res) {
      if (res.data.length === 0) {
        wx.hideLoading();
        self.setData({ isJoining: false });
        wx.showToast({ title: '房间不存在', icon: 'none' });
        return null;
      }

      const room = res.data[0];

      // 已结束的房间，直接跳转查看历史
      if (room.status === 'finished') {
        wx.hideLoading();
        self.setData({ isJoining: false });
        const myId = wx.getStorageSync('openId') || '';
        const isCreator = room.creatorId === myId ? '1' : '0';
        wx.redirectTo({
          url: '/pages/room/room?roomCode=' + code + '&isCreator=' + isCreator
        });
        return null;
      }

      // 进行中的房间，走正常加入流程
      return app.ensureLogin().then(function () {
        return wx.cloud.callFunction({
          name: 'joinRoom',
          data: { roomCode: code }
        });
      });
    }).then(function (res) {
      if (!res) return;
      wx.hideLoading();
      self.setData({ isJoining: false });

      const result = res.result || {};
      if (result.code === 0 || result.code === 1) {
        wx.setStorageSync('lastRoomCode', code);
        wx.redirectTo({
          url: '/pages/room/room?roomCode=' + code + '&isCreator=0'
        });
      } else {
        wx.showToast({
          title: result.message || '加入失败',
          icon: 'none'
        });
      }
    }).catch(function (err) {
      wx.hideLoading();
      self.setData({ isJoining: false });
      console.error('joinRoom:', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    });
  }
});
