// 云函数: createRoom
// 创建游戏房间

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

exports.main = async (event, context) => {
  try {
    const { playerCount = 4, nickName = '', avatarUrl = '' } = event;
    const { OPENID } = cloud.getWXContext();

    if (typeof playerCount !== 'number' || isNaN(playerCount) || playerCount < 2 || playerCount > 10) {
      return { code: -1, message: '玩家数量应在2-10之间' };
    }

    if (!OPENID) {
      return { code: -1, message: '无法获取用户信息，请重试' };
    }

    const db = cloud.database();
    const roomCode = generateRoomCode();

    const players = [{
      openid: OPENID,
      nickName: nickName,
      avatarUrl: avatarUrl,
      score: 0
    }];

    const roomData = {
      roomCode,
      creatorId: OPENID,
      maxPlayers: playerCount,
      players,
      status: 'playing',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    await db.collection('rooms').add({ data: roomData });

    return {
      code: 0,
      message: '房间创建成功',
      room: {
        roomCode,
        creatorId: OPENID,
        maxPlayers: playerCount,
        playersCount: players.length,
        status: 'playing'
      }
    };
  } catch (err) {
    console.error('[createRoom] 错误:', err);
    return { code: -1, message: err.message || '服务器内部错误' };
  }
};