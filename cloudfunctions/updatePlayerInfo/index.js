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

    // 如果要修改昵称，先检查是否被其他玩家占用
    if (nickName !== undefined && nickName !== '') {
      const roomResult = await db.collection('rooms').where({ roomCode }).get();
      if (roomResult.data.length === 0) {
        return { code: -1, message: '房间不存在' };
      }
      const room = roomResult.data[0];
      const duplicate = room.players.find(p => p.openid !== OPENID && p.nickName === nickName);
      if (duplicate) {
        return { code: -2, message: '昵称"' + nickName + '"已被其他玩家使用' };
      }
    }

    // 构建更新数据
    const updateData = {
      updateTime: db.serverDate()
    };
    if (nickName !== undefined) {
      updateData['players.$.nickName'] = nickName || '';
    }
    if (avatarUrl !== undefined) {
      updateData['players.$.avatarUrl'] = avatarUrl || '';
    }

    // 更新该玩家在房间中的信息
    await db.collection('rooms')
      .where({
        roomCode,
        'players.openid': OPENID
      })
      .update({
        data: updateData
      });

    return { code: 0, message: '更新成功' };
  } catch (err) {
    console.error('[updatePlayerInfo] 错误:', err);
    return { code: -1, message: err.message || '服务器错误' };
  }
};
