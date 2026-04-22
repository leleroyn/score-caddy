// 云函数: updatePlayerInfo
// 更新玩家在房间中的昵称和头像

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    const { roomCode, nickName, avatarUrl } = event;
    const { OPENID } = cloud.getWXContext();

    if (!roomCode) {
      return { code: -1, message: '缺少房间号' };
    }

    const db = cloud.database();

    // 更新该玩家在房间中的昵称和头像
    const result = await db.collection('rooms')
      .where({
        roomCode,
        'players.openid': OPENID
      })
      .update({
        data: {
          'players.$.nickName': nickName || '',
          'players.$.avatarUrl': avatarUrl || '',
          updateTime: db.serverDate()
        }
      });

    return { code: 0, message: '更新成功' };
  } catch (err) {
    console.error('[updatePlayerInfo] 错误:', err);
    return { code: -1, message: err.message || '服务器错误' };
  }
};
