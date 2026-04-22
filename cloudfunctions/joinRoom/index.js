// 云函数: joinRoom
// 加入已有房间

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    const { roomCode, nickName = '', avatarUrl = '' } = event;
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
    if (room.players.length >= maxPlayers) {
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

      await transaction.collection('rooms')
        .where({ roomCode })
        .update({
          data: {
            players: _.push([{
              openid: OPENID,
              nickName: nickName,
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
