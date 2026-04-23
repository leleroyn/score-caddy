// 云函数: sendScore
// 发送分数给其他玩家（包括茶水系统玩家）

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    const { roomCode, targetOpenId, value } = event;
    const { OPENID } = cloud.getWXContext();
    
    // 参数验证
    if (!roomCode || !targetOpenId || !value) {
      return {
        code: -1,
        message: '参数错误：缺少房间号、目标玩家ID或分数值'
      };
    }
    
    const scoreValue = parseInt(value);
    if (isNaN(scoreValue) || scoreValue <= 0) {
      return {
        code: -1,
        message: '分数值必须是正整数'
      };
    }
    
    // 不能给自己发送分数
    if (targetOpenId === OPENID) {
      return {
        code: -1,
        message: '不能给自己发送分数'
      };
    }
    
    const db = cloud.database();
    const _ = db.command;
    
    // 使用事务确保数据一致性
    return db.runTransaction(async function (transaction) {
      // 通过 roomCode 获取房间
      const roomResult = await transaction.collection('rooms')
        .where({ roomCode })
        .get();
      
      if (roomResult.data.length === 0) {
        throw new Error('房间不存在');
      }
      
      const room = roomResult.data[0];
      
      // 验证当前用户在房间中
      const playerInRoom = room.players.some(p => p.openid === OPENID);
      if (!playerInRoom) {
        throw new Error('你不在该房间中');
      }
      
      // 验证目标玩家在房间中
      const targetInRoom = room.players.some(p => p.openid === targetOpenId);
      if (!targetInRoom) {
        throw new Error('目标玩家不在该房间中');
      }
      
      // 先更新当前玩家分数（减分）
      await transaction.collection('rooms')
        .where({
          _id: room._id,
          'players.openid': OPENID
        })
        .update({
          data: {
            'players.$.score': _.inc(-scoreValue)
          }
        });
      
      // 再更新目标玩家分数（加分）
      await transaction.collection('rooms')
        .where({
          _id: room._id,
          'players.openid': targetOpenId
        })
        .update({
          data: {
            'players.$.score': _.inc(scoreValue)
          }
        });

      // 查找双方的昵称和头像，用于记录展示
      const fromPlayer = room.players.find(p => p.openid === OPENID);
      const toPlayer = room.players.find(p => p.openid === targetOpenId);

      // 写入送分记录
      await transaction.collection('score_records').add({
        data: {
          roomCode: room.roomCode,
          roomId: room._id,
          fromOpenId: OPENID,
          toOpenId: targetOpenId,
          fromName: (fromPlayer && fromPlayer.nickName) || '匿名',
          toName: (toPlayer && toPlayer.nickName) || '匿名',
          fromAvatar: (fromPlayer && fromPlayer.avatarUrl) || '',
          toAvatar: (toPlayer && toPlayer.avatarUrl) || '',
          value: scoreValue,
          createdAt: db.serverDate()
        }
      });
      
      return {
        code: 0,
        message: '分数发送成功',
        roomCode: room.roomCode
      };
    });
  } catch (err) {
    console.error('[云函数] [sendScore] 执行错误:', err);
    return {
      code: -1,
      message: '服务器错误，请稍后重试'
    };
  }
};
