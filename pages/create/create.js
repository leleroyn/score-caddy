// pages/create/create.js
const app = getApp();

Page({
  data: {
    playerCount: 4,
    showMoreCount: false,
    joinRoomCode: '',
    isCreating: false,
    isJoining: false
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
          playerCount: this.data.playerCount
        }
      });
    }).then(res => {
      wx.hideLoading();
      this.setData({ isCreating: false });

      if (res.result && res.result.code === 0) {
        const roomInfo = res.result.room;
        wx.setStorageSync('lastRoomCode', roomInfo.roomCode);
        wx.navigateTo({
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
   * 加入房间
   */
  joinRoom: function () {
    if (this.data.isJoining) return;

    const code = this.data.joinRoomCode.trim().toUpperCase();
    if (code.length !== 6) {
      wx.showToast({ title: '请输入6位房间号', icon: 'none' });
      return;
    }

    this.setData({ isJoining: true });
    wx.showLoading({ title: '加入中...', mask: true });

    // 先确保登录
    app.ensureLogin().then(() => {
      const db = wx.cloud.database();
      return db.collection('rooms').where({ roomCode: code }).get();
    }).then(res => {
      wx.hideLoading();

      if (res.data.length === 0) {
        this.setData({ isJoining: false });
        wx.showToast({ title: '房间不存在', icon: 'none' });
        return;
      }

      const room = res.data[0];

      if (room.status === 'finished') {
        this.setData({ isJoining: false });
        wx.showToast({ title: '游戏已结束', icon: 'none' });
        return;
      }

      if (room.players.length >= (room.maxPlayers || 10)) {
        this.setData({ isJoining: false });
        wx.showToast({ title: '房间已满', icon: 'none' });
        return;
      }

      const openId = app.globalData.openId || wx.getStorageSync('openId') || '';
      const alreadyInRoom = room.players.some(p => p.openid === openId);

      wx.setStorageSync('lastRoomCode', code);

      if (alreadyInRoom) {
        this.setData({ isJoining: false });
        wx.navigateTo({
          url: '/pages/room/room?roomCode=' + code + '&isCreator=0'
        });
      } else {
        this._callJoinRoom(code);
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isJoining: false });
      console.error('joinRoom:', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    });
  },

  /**
   * 调用云函数加入房间
   */
  _callJoinRoom: function (roomCode) {
    wx.showLoading({ title: '加入中...', mask: true });

    wx.cloud.callFunction({
      name: 'joinRoom',
      data: {
        roomCode: roomCode
      }
    }).then(res => {
      wx.hideLoading();
      this.setData({ isJoining: false });

      if (res.result && res.result.code === 0) {
        wx.navigateTo({
          url: '/pages/room/room?roomCode=' + roomCode + '&isCreator=0'
        });
      } else {
        wx.showToast({
          title: (res.result && res.result.message) || '加入失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isJoining: false });
      console.error('joinRoom 云函数调用失败:', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    });
  }
});
