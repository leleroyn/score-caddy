// 云函数: joinRoom
// 加入已有房间

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 内置头像库（与前端保持一致）
const AVATAR_POOL = [
  '/images/avatars/boy-1.svg', '/images/avatars/boy-2.svg', '/images/avatars/boy-3.svg',
  '/images/avatars/girl-1.svg', '/images/avatars/girl-2.svg', '/images/avatars/girl-3.svg',
  '/images/avatars/kid-1.svg', '/images/avatars/kid-2.svg',
  '/images/avatars/elder-m.svg', '/images/avatars/elder-f.svg'
];

const TEA_SYSTEM_ID = '__system_tea__';

exports.main = async (event, context) => {
  try {
    const { roomCode } = event;
    const { OPENID } = cloud.getWXContext();

    if (!roomCode) {
      return { code: -1, message: '缺少房间号' };
    }

    const db = cloud.database();
    const _ = db.command;

    // 查询房间
    const roomResult = await db.collection('rooms').where({ roomCode }).get();
    if (roomResult.data.length === 0) {
      return { code: -1, message: '房间不存在' };
    }

    const room = roomResult.data[0];

    if (room.status === 'finished') {
      return { code: -1, message: '游戏已结束' };
    }

    if (room.players.some(p => p.openid === OPENID)) {
      return { code: 0, message: '已在房间中', alreadyInRoom: true };
    }

    const maxPlayers = room.maxPlayers || 10;
    // 只计算真实玩家数量（排除系统玩家）
    const realPlayerCount = room.players.filter(p => p.openid !== TEA_SYSTEM_ID && !p.isSystem).length;
    if (realPlayerCount >= maxPlayers) {
      return { code: -1, message: '房间已满' };
    }

    // 用事务将玩家加入房间
    return db.runTransaction(async function (transaction) {
      const freshRoom = await transaction.collection('rooms')
        .where({ roomCode })
        .get();

      if (freshRoom.data.length === 0) {
        throw new Error('房间不存在');
      }

      const currentRoom = freshRoom.data[0];

      if (currentRoom.status === 'finished') {
        throw new Error('游戏已结束');
      }

      if (currentRoom.players.some(p => p.openid === OPENID)) {
        return { code: 0, message: '已在房间中', alreadyInRoom: true };
      }

      if (currentRoom.players.length >= maxPlayers) {
        throw new Error('房间已满');
      }

      // 只统计真实玩家，分配昵称编号
      const realCount = currentRoom.players.filter(p => p.openid !== TEA_SYSTEM_ID && !p.isSystem).length;
      const playerNum = realCount + 1;
      const autoNickName = '玩家' + playerNum;

      // 随机选一个未被真实玩家使用的头像（排除茶水头像）
      const usedAvatars = currentRoom.players
        .filter(p => p.openid !== TEA_SYSTEM_ID && !p.isSystem)
        .map(p => p.avatarUrl).filter(Boolean);
      const availableAvatars = AVATAR_POOL.filter(a => !usedAvatars.includes(a));
      let avatarUrl;
      if (availableAvatars.length > 0) {
        avatarUrl = availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
      } else {
        // 所有头像都被占用，从全部头像中随机选一个
        avatarUrl = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
      }

      await transaction.collection('rooms')
        .where({ roomCode })
        .update({
          data: {
            players: _.push([{
              openid: OPENID,
              nickName: autoNickName,
              avatarUrl: avatarUrl,
              score: 0
            }]),
            updateTime: db.serverDate()
          }
        });

      return { code: 0, message: '加入成功' };
    });
  } catch (err) {
    console.error('[云函数] [joinRoom] 错误:', err);
    return {
      code: -1,
      message: err.message || '服务器错误，请稍后重试'
    };
  }
};
