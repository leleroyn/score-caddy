// pages/room/room.js
const app = getApp();

Page({
  data: {
    roomCode: '',
    roomInfo: null,
    players: [],
    myOpenId: '',
    isOwner: false,
    isLoading: true,
    isGameFinished: false,
    showKeypad: false,
    keypadValue: '',
    selectedTargetId: null,
    targetNickname: '',
    isSending: false
  },

  /**
   * 生命周期函数 -- 监听页面加载
   */
  onLoad: function (options) {
    // 用 setData 正确初始化数据（修复直接赋值的 bug）
    this.setData({
      roomCode: options.roomCode || '',
      myOpenId: wx.getStorageSync('openId') || '',
      isOwner: options.isCreator === '1'
    });

    this.initRoom();
    this.setupRoomListener();
  },

  /**
   * 生命周期函数 -- 监听页面卸载
   */
  onUnload: function () {
    if (this.roomListener) {
      this.roomListener.close();
    }
  },

  /**
   * 分享功能（邀请好友加入房间）
   */
  onShareAppMessage: function () {
    return {
      title: '来玩纸牌送分游戏！房间号：' + this.data.roomCode,
      path: '/pages/create/create?joinCode=' + this.data.roomCode
    };
  },

  /**
   * 初始化房间数据
   */
  initRoom: function () {
    const db = wx.cloud.database();
    db.collection('rooms').where({
      roomCode: this.data.roomCode
    }).get().then(res => {
      if (res.data.length === 0) {
        wx.showModal({
          title: '提示',
          content: '房间不存在或已解散',
          showCancel: false,
          success: () => { wx.navigateBack(); }
        });
        return;
      }

      const room = res.data[0];
      this._updateRoomData(room);
    }).catch(err => {
      console.error('获取房间信息失败:', err);
      wx.showModal({
        title: '加载失败',
        content: '无法获取房间信息，请检查网络后重试',
        showCancel: false,
        success: () => { wx.navigateBack(); }
      });
    });
  },

  /**
   * 设置房间数据实时监听器
   */
  setupRoomListener: function () {
    const db = wx.cloud.database();
    this.roomListener = db.collection('rooms').where({
      roomCode: this.data.roomCode
    }).watch({
      onChange: res => {
        if (res.docs.length > 0) {
          const room = res.docs[0];
          const wasFinished = this.data.isGameFinished;
          this._updateRoomData(room);

          // 检测游戏刚刚结束（修复：对比之前的状态，而不是 setData 后的状态）
          if (room.status === 'finished' && !wasFinished) {
            wx.showModal({
              title: '游戏结束',
              content: '房主已进行结算，游戏结束！',
              showCancel: false
            });
          }
        }
      },
      onError: err => {
        console.error('房间监听器错误:', err);
        // 5秒后尝试重连
        if (this.roomListener) {
          this.roomListener.close();
        }
        setTimeout(() => {
          if (!this.data.isGameFinished) {
            this.setupRoomListener();
          }
        }, 5000);
      }
    });
  },

  /**
   * 统一更新房间数据到页面
   */
  _updateRoomData: function (room) {
    this.setData({
      roomInfo: room,
      players: room.players || [],
      isLoading: false,
      isGameFinished: room.status === 'finished'
    });

    // 检查自己的昵称/头像是否为空，自动补充
    this._ensureMyProfile(room);
  },

  /**
   * 如果自己的昵称或头像为空，自动从本地缓存同步到云数据库
   */
  _ensureMyProfile: function (room) {
    const myOpenId = this.data.myOpenId;
    if (!myOpenId) return;

    const me = (room.players || []).find(p => p.openid === myOpenId);
    if (!me) return;

    const cachedNick = wx.getStorageSync('nickName') || '';
    const cachedAvatar = wx.getStorageSync('avatarUrl') || '';

    // 如果房间中为空但本地有值，自动更新到云数据库
    const needUpdate = (!me.nickName && cachedNick) || (!me.avatarUrl && cachedAvatar);
    if (needUpdate) {
      wx.cloud.callFunction({
        name: 'updatePlayerInfo',
        data: {
          roomCode: this.data.roomCode,
          nickName: me.nickName || cachedNick,
          avatarUrl: me.avatarUrl || cachedAvatar
        }
      }).catch(err => {
        console.error('自动更新用户信息失败:', err);
      });
    }
  },

  /**
   * 点击其他玩家 -- 打开送分弹窗
   */
  onPlayerTap: function (e) {
    if (this.data.isGameFinished) return;

    const openid = e.currentTarget.dataset.openid;
    const nickname = e.currentTarget.dataset.nickname;

    if (openid === this.data.myOpenId) return;

    this.setData({
      selectedTargetId: openid,
      targetNickname: nickname,
      showKeypad: true,
      keypadValue: ''
    });
  },

  /**
   * 弹窗内输入分数
   */
  onKeypadInput: function (e) {
    // 只允许正整数
    let val = e.detail.value.replace(/[^0-9]/g, '');
    // 去掉前导零
    if (val.length > 1 && val[0] === '0') {
      val = val.replace(/^0+/, '') || '0';
    }
    this.setData({ keypadValue: val });
  },

  /**
   * 快捷金额
   */
  setQuickAmount: function (e) {
    const amount = e.currentTarget.dataset.amount;
    const current = parseInt(this.data.keypadValue) || 0;
    const newVal = current + amount;
    // 最大99999
    this.setData({ keypadValue: String(Math.min(newVal, 99999)) });
  },

  /**
   * 确认送分
   */
  confirmSend: function () {
    if (this.data.isSending) return;

    const value = parseInt(this.data.keypadValue);
    const targetId = this.data.selectedTargetId;

    if (isNaN(value) || value <= 0) {
      wx.showToast({ title: '请输入正整数', icon: 'none' });
      return;
    }

    if (!targetId) {
      wx.showToast({ title: '请选择目标玩家', icon: 'none' });
      return;
    }

    this.setData({ showKeypad: false, isSending: true });
    wx.showLoading({ title: '送分中...', mask: true });

    wx.cloud.callFunction({
      name: 'sendScore',
      data: {
        roomCode: this.data.roomCode,
        targetOpenId: targetId,
        value: value
      }
    }).then(res => {
      wx.hideLoading();
      this.setData({ isSending: false });

      if (res.result && res.result.code === 0) {
        wx.showToast({
          title: '成功送出 ' + value + ' 分',
          icon: 'none',
          duration: 1500
        });
      } else {
        wx.showToast({
          title: (res.result && res.result.message) || '送分失败',
          icon: 'none'
        });
      }
      this._clearSelection();
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isSending: false });
      console.error('送分失败:', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      this._clearSelection();
    });
  },

  /**
   * 取消送分
   */
  cancelSend: function () {
    this.setData({
      showKeypad: false
    });
    this._clearSelection();
  },

  /**
   * 阻止事件冒泡（弹窗内部点击不关闭弹窗）
   */
  stopPropagation: function () {
    // 空函数，仅用于阻止冒泡
  },

  /**
   * 清除选择状态
   */
  _clearSelection: function () {
    this.setData({
      selectedTargetId: null,
      targetNickname: '',
      keypadValue: ''
    });
  },

  /**
   * 复制房间号
   */
  copyRoomCode: function () {
    wx.setClipboardData({
      data: this.data.roomCode,
      success: () => {
        wx.showToast({ title: '房间号已复制', icon: 'success' });
      }
    });
  },

  /**
   * 结算游戏（仅房主）
   */
  settleGame: function () {
    if (!this.data.isOwner) return;
    if (this.data.isGameFinished) return;

    // 展示当前各玩家分数
    const players = this.data.players;
    const scoreSummary = players.map(p => {
      const name = p.nickName || '匿名';
      const score = p.score || 0;
      return name + ': ' + score + '分';
    }).join('\n');

    const total = players.reduce((s, p) => s + (p.score || 0), 0);
    const adjust = players.length > 0 ? (-total / players.length).toFixed(1) : 0;

    wx.showModal({
      title: '确认结算',
      content: '当前分数：\n' + scoreSummary + '\n\n总分：' + total + '\n每人调整：' + adjust + '分\n\n结算后游戏将结束，确定？',
      confirmText: '确认结算',
      confirmColor: '#f5576c',
      success: res => {
        if (res.confirm) {
          this._performSettle();
        }
      }
    });
  },

  /**
   * 执行结算
   */
  _performSettle: function () {
    wx.showLoading({ title: '结算中...', mask: true });

    wx.cloud.callFunction({
      name: 'settleGame',
      data: { roomCode: this.data.roomCode }
    }).then(res => {
      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showModal({
          title: '结算完成',
          content: '游戏已结束！最终分数已保存至历史记录。',
          showCancel: false
        });
      } else {
        wx.showToast({
          title: (res.result && res.result.message) || '结算失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('结算失败:', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    });
  },

  /**
   * 返回首页
   */
  goBack: function () {
    wx.navigateBack();
  }
});
