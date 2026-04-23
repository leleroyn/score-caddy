// pages/room/room.js
const app = getApp();

const TEA_SYSTEM_ID = '__system_tea__';

Page({
  data: {
    roomCode: '',
    roomInfo: null,
    players: [],
    sortedPlayers: [],
    teaPlayer: null,
    myOpenId: '',
    isOwner: false,
    isLoading: true,
    isGameFinished: false,
    showKeypad: false,
    keypadValue: '',
    selectedTargetId: null,
    targetNickname: '',
    isSending: false,
    records: [],
    showProfileEdit: false,
    editAvatarUrl: '',
    editNickname: '',
    presetAvatars: [
      '/images/avatars/boy-1.svg', '/images/avatars/boy-2.svg', '/images/avatars/boy-3.svg',
      '/images/avatars/girl-1.svg', '/images/avatars/girl-2.svg', '/images/avatars/girl-3.svg',
      '/images/avatars/kid-1.svg', '/images/avatars/kid-2.svg',
      '/images/avatars/elder-m.svg', '/images/avatars/elder-f.svg'
    ]
  },

  /**
   * 生命周期函数 -- 监听页面加载
   */
  onLoad: function (options) {
    const self = this;
    this.setData({
      roomCode: options.roomCode || '',
      myOpenId: wx.getStorageSync('openId') || '',
      isOwner: options.isCreator === '1'
    });

    this.initRoom().then(function () {
      if (!self.data.isGameFinished) {
        self.setupRoomListener();
        self.setupRecordListener();
        self.loadRecords();
      }
    });
  },

  /**
   * 生命周期函数 -- 监听页面卸载
   */
  onUnload: function () {
    if (this.roomListener) {
      this.roomListener.close();
    }
    if (this.recordListener) {
      this.recordListener.close();
    }
  },

  /**
   * 分享功能（邀请好友加入房间）
   */
  onShareAppMessage: function () {
    if (this.data.isGameFinished) return;
    return {
      title: '来玩纸牌送分游戏！房间号：' + this.data.roomCode,
      path: '/pages/create/create?joinCode=' + this.data.roomCode
    };
  },

  /**
   * 初始化房间数据
   * 已结束房间从 game_history 集合取数据，进行中房间从 rooms 集合取
   */
  initRoom: function () {
    const self = this;
    const db = wx.cloud.database();
    const roomCode = this.data.roomCode;

    // 先查 rooms 表判断状态
    return db.collection('rooms').where({ roomCode: roomCode }).get()
      .then(function (res) {
        if (res.data.length === 0) {
          // rooms 里找不到，可能是已清理，尝试从 game_history 找
          return self._loadFromHistory(roomCode);
        }

        const room = res.data[0];

        if (room.status === 'finished') {
          // 已结束，从 game_history 取快照
          return self._loadFromHistory(roomCode, room);
        }

        // 进行中，走正常流程
        self._updateRoomData(room);
        return Promise.resolve();
      })
      .catch(function (err) {
        console.error('获取房间信息失败:', err);
        wx.showModal({
          title: '加载失败',
          content: '无法获取房间信息，请检查网络后重试',
          showCancel: false,
          success: function () { wx.navigateBack(); }
        });
      });
  },

  /**
   * 从 game_history 加载已结束房间数据
   */
  _loadFromHistory: function (roomCode, room) {
    const self = this;
    const db = wx.cloud.database();

    return db.collection('game_history').where({ roomCode: roomCode }).get()
      .then(function (res) {
        if (res.data.length === 0) {
          wx.showModal({
            title: '提示',
            content: '房间不存在或历史记录已清理',
            showCancel: false,
            success: function () { wx.navigateBack(); }
          });
          return;
        }

        // 取最新的那条（按 endTime 倒序，文档已按默认排序）
        let history = res.data[0];
        // 如果多条，取 endTime 最大的
        if (res.data.length > 1) {
          history = res.data.reduce(function (a, b) {
            return new Date(b.endTime).getTime() > new Date(a.endTime).getTime() ? b : a;
          }, res.data[0]);
        }

        // 从快照构造玩家列表
        const players = history.playersSnapshot || [];

        // 排序：找第一个（通常是房主）
        const sorted = players.map(function (p) { return p; });

        // 茶水
        const teaPlayer = history.enableTea ? {
          openid: TEA_SYSTEM_ID,
          nickName: history.teaNickName || '茶水',
          avatarUrl: '/images/tea-avatar.svg',
          score: history.teaScore || 0,
          isSystem: true
        } : null;

        // 构造 roomInfo
        const roomInfo = room || {
          roomCode: roomCode,
          status: 'finished',
          maxPlayers: players.length
        };

        self.setData({
          roomInfo: roomInfo,
          players: players,
          sortedPlayers: sorted,
          teaPlayer: teaPlayer,
          isLoading: false,
          isGameFinished: true,
          records: []
        });
      })
      .catch(function (err) {
        console.error('获取历史记录失败:', err);
        wx.showModal({
          title: '加载失败',
          content: '无法获取历史记录',
          showCancel: false,
          success: function () { wx.navigateBack(); }
        });
      });
  },

  /**
   * 设置房间数据实时监听器
   */
  setupRoomListener: function () {
    const db = wx.cloud.database();
    const self = this;
    this.roomListener = db.collection('rooms').where({
      roomCode: this.data.roomCode
    }).watch({
      onChange: function (res) {
        if (res.docs.length > 0) {
          const room = res.docs[0];
          const wasFinished = self.data.isGameFinished;
          self._updateRoomData(room);

          // 检测游戏刚刚结束
          if (room.status === 'finished' && !wasFinished) {
            wx.showModal({
              title: '游戏已结束',
              content: '感谢您的使用。',
              showCancel: false
            });
          }
        }
      },
      onError: function (err) {
        console.error('房间监听器错误:', err);
        if (self.roomListener) {
          self.roomListener.close();
        }
        setTimeout(function () {
          if (!self.data.isGameFinished) {
            self.setupRoomListener();
          }
        }, 5000);
      }
    });
  },

  /**
   * 统一更新房间数据到页面
   */
  _updateRoomData: function (room) {
    const players = room.players || [];

    // 分离茶水系统玩家和真实玩家
    const tea = players.find(p => p.openid === TEA_SYSTEM_ID || p.isSystem) || null;
    const realPlayers = players.filter(p => p.openid !== TEA_SYSTEM_ID && !p.isSystem);

    // 排序：房主排第一，其余按加入顺序
    const creatorId = room.creatorId;
    const sorted = [...realPlayers].sort((a, b) => {
      if (a.openid === creatorId) return -1;
      if (b.openid === creatorId) return 1;
      return 0;
    });

    this.setData({
      roomInfo: room,
      players: players,
      sortedPlayers: sorted,
      teaPlayer: tea,
      isLoading: false,
      isGameFinished: room.status === 'finished'
    });
  },

  /**
   * 加载全部历史送分记录（分页拉取）
   */
  loadRecords: function () {
    const db = wx.cloud.database();
    const roomCode = this.data.roomCode;
    const self = this;
    let all = [];
    let page = 0;
    const pageSize = 20;

    const loadPage = () => {
      db.collection('score_records')
        .where({ roomCode: roomCode })
        .skip(page * pageSize)
        .limit(pageSize)
        .get()
        .then(res => {
          const list = res.data || [];
          all = all.concat(list);
          if (list.length === pageSize) {
            page++;
            loadPage();
          } else {
            // 按时间倒序排列（最新在前）
            all.sort(function (a, b) {
              const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return tb - ta;
            });
            self.setData({ records: all.map(function (doc) { return self._formatRecord(doc); }) });
          }
        })
        .catch(err => {
          console.error('加载送分记录失败:', err);
        });
    };

    loadPage();
  },

  /**
   * 实时监听送分记录新增
   */
  setupRecordListener: function () {
    const db = wx.cloud.database();
    const self = this;
    this.recordListener = db.collection('score_records')
      .where({ roomCode: this.data.roomCode })
      .limit(50)
      .watch({
        onChange: function (res) {
          if (res.docs && res.docs.length > 0) {
            // 按时间倒序排列
            res.docs.sort(function (a, b) {
              const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return tb - ta;
            });
            const records = res.docs.map(function (doc) { return self._formatRecord(doc); });
            self.setData({ records: records });
          }
        },
        onError: function (err) {
          console.error('记录监听器错误:', err);
          if (self.recordListener) {
            self.recordListener.close();
          }
          setTimeout(function () {
            if (!self.data.isGameFinished) {
              self.setupRecordListener();
            }
          }, 5000);
        }
      });
  },

  /**
   * 格式化单条记录
   */
  _formatRecord: function (doc) {
    const time = doc.createdAt;
    let timeStr = '';
    if (time) {
      const d = new Date(time);
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      timeStr = h + ':' + m;
    }

    const myId = this.data.myOpenId;
    const fromMe = doc.fromOpenId === myId;
    const toMe = doc.toOpenId === myId;
    const isTea = doc.toOpenId === TEA_SYSTEM_ID || doc.fromOpenId === TEA_SYSTEM_ID;

    // 名字替换
    let fromName = doc.fromName || '匿名';
    let toName = doc.toName || '匿名';
    if (fromMe) fromName = '我';
    if (toMe) toName = '我';

    // 文案
    let text = '';
    if (fromMe) {
      text = '向 ' + toName + ' 送';
    } else if (toMe) {
      text = fromName + ' 向我 送';
    } else {
      text = fromName + ' 向 ' + toName + ' 送';
    }

    // 我送出的在左，别人送的在右
    const isLeft = fromMe;

    return {
      fromOpenId: doc.fromOpenId,
      toOpenId: doc.toOpenId,
      fromName: fromName,
      toName: toName,
      fromAvatar: doc.fromAvatar || '',
      toAvatar: doc.toAvatar || '',
      value: doc.value || 0,
      timeStr: timeStr,
      isMine: fromMe || toMe,
      isLeft: isLeft,
      isTea: isTea,
      desc: text,
      valueStr: '+' + (doc.value || 0) + '分'
    };
  },

  /**
   * 点击自己 -- 弹出修改个人信息弹窗
   */
  onSelfTap: function (e) {
    if (this.data.isGameFinished) return;

    const index = e.currentTarget.dataset.index;
    const player = this.data.sortedPlayers[index] || {};

    this.setData({
      editAvatarUrl: player.avatarUrl || '',
      editNickname: player.nickName || '',
      showProfileEdit: true
    });
  },

  /**
   * 选择预设头像
   */
  selectPresetAvatar: function (e) {
    const url = e.currentTarget.dataset.url;
    this.setData({ editAvatarUrl: url });
  },

  /**
   * 获取微信头像（仅预选，需点保存才生效）
   */
  onChooseWechatAvatar: function (e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      this.setData({ editAvatarUrl: avatarUrl });
    }
  },

  /**
   * 获取微信昵称
   */
  onNicknameConfirm: function (e) {
    // type="nickname" 的 input 在确认后触发
    const nickName = e.detail.value;
    if (nickName) {
      this.setData({ editNickname: nickName });
    }
  },

  /**
   * 输入昵称
   */
  onNicknameInput: function (e) {
    this.setData({ editNickname: e.detail.value });
  },

  /**
   * 保存个人信息修改
   */
  confirmProfileEdit: function () {
    const nickName = this.data.editNickname.trim();
    const avatarUrl = this.data.editAvatarUrl;

    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    if (!avatarUrl) {
      wx.showToast({ title: '请选择一个头像', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...', mask: true });

    wx.cloud.callFunction({
      name: 'updatePlayerInfo',
      data: {
        roomCode: this.data.roomCode,
        nickName: nickName,
        avatarUrl: avatarUrl
      }
    }).then(res => {
      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({
          showProfileEdit: false,
          editAvatarUrl: '',
          editNickname: ''
        });
      } else if (res.result && res.result.code === -2) {
        // 昵称被占用
        wx.showToast({ title: res.result.message || '昵称已被占用', icon: 'none' });
      } else {
        wx.showToast({ title: (res.result && res.result.message) || '保存失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('保存个人信息失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  /**
   * 取消修改个人信息
   */
  cancelProfileEdit: function () {
    this.setData({
      showProfileEdit: false,
      editAvatarUrl: '',
      editNickname: ''
    });
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
    let val = e.detail.value.replace(/[^0-9]/g, '');
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
    this.setData({ showKeypad: false });
    this._clearSelection();
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation: function () {},

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
   * 结束游戏（仅房主）
   */
  settleGame: function () {
    if (!this.data.isOwner) return;
    if (this.data.isGameFinished) return;

    wx.showModal({
      title: '确认结束',
      content: '结束后房间将不能再进行游戏记分，只能查看各位玩家的最终分数，且只有房主能重新进入。',
      confirmText: '确认结束',
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
    wx.showLoading({ title: '结束中...', mask: true });

    wx.cloud.callFunction({
      name: 'settleGame',
      data: { roomCode: this.data.roomCode }
    }).then(res => {
      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        // 结束成功，页面会通过 watch 监听自动刷新为已结束状态
      } else {
        wx.showToast({
          title: (res.result && res.result.message) || '操作失败',
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
    wx.reLaunch({ url: '/pages/create/create' });
  }
});
