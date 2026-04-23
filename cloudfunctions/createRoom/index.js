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

// 内置头像库（与前端保持一致）
const AVATAR_POOL = [
  '/images/avatars/boy-1.svg', '/images/avatars/boy-2.svg', '/images/avatars/boy-3.svg',
  '/images/avatars/girl-1.svg', '/images/avatars/girl-2.svg', '/images/avatars/girl-3.svg',
  '/images/avatars/kid-1.svg', '/images/avatars/kid-2.svg',
  '/images/avatars/elder-m.svg', '/images/avatars/elder-f.svg'
];

// 茶水系统玩家的固定 ID（不会与任何真实用户冲突）
const TEA_SYSTEM_ID = '__system_tea__';
const TEA_AVATAR = '/images/tea-avatar.svg';

exports.main = async (event, context) => {
  try {
    const { playerCount = 4, enableTea = false } = event;
    const { OPENID } = cloud.getWXContext();

    if (typeof playerCount !== 'number' || isNaN(playerCount) || playerCount < 2 || playerCount > 10) {
      return { code: -1, message: '玩家数量应在2-10之间' };
    }

    if (!OPENID) {
      return { code: -1, message: '无法获取用户信息，请重试' };
    }

    const db = cloud.database();
    const roomCode = generateRoomCode();

    // 创建者默认是 玩家1，头像从库中随机选一个
    const avatarIndex = Math.floor(Math.random() * AVATAR_POOL.length);

    const players = [{
      openid: OPENID,
      nickName: '玩家1',
      avatarUrl: AVATAR_POOL[avatarIndex],
      score: 0
    }];

    // 如果启用茶水，添加系统茶水玩家
    if (enableTea) {
      players.push({
        openid: TEA_SYSTEM_ID,
        nickName: '茶水',
        avatarUrl: TEA_AVATAR,
        score: 0,
        isSystem: true
      });
    }

    const roomData = {
      roomCode,
      creatorId: OPENID,
      maxPlayers: playerCount,
      players,
      status: 'playing',
      enableTea: !!enableTea,
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
