// 云函数: settleGame
// 结算游戏，将所有玩家的分数调整为总和为0

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    const { roomCode } = event;
    const { OPENID } = cloud.getWXContext(); // 当前用户的openid
    
    // 参数验证
    if (!roomCode) {
      return {
        code: -1,
        message: '参数错误：缺少房间号'
      };
    }
    
    const db = cloud.database();
    const _ = db.command;
    
    // 获取房间信息
    const roomResult = await db.collection('rooms').where({
      roomCode: roomCode
    }).get();
    
    if (roomResult.data.length === 0) {
      return {
        code: -1,
        message: '房间不存在'
      };
    }
    
    const room = roomResult.data[0];
    
    // 验证当前用户是否为房主
    if (room.creatorId !== OPENID) {
      return {
        code: -1,
        message: '只有房主可以结算游戏'
      };
    }
    
    // 检查游戏是否已经结束
    if (room.status === 'finished') {
      return {
        code: -1,
        message: '游戏已经结束'
      };
    }
    
    // 计算总分
    const totalScore = room.players.reduce((sum, player) => sum + (player.score || 0), 0);
    const playerCount = room.players.length;
    
    // 计算每个玩家需要调整的分数（使总分变为0）
    const adjustment = -totalScore / playerCount;
    
    // 使用事务确保数据一致性
    return db.runTransaction(async function (transaction) {
      // 更新所有玩家的分数
      for (const player of room.players) {
        await transaction.collection('rooms')
          .where({
            _id: room._id,
            'players.openid': player.openid
          })
          .update({
            data: {
              'players.$.score': _.inc(adjustment)
            }
          });
      }
      
      // 更新房间状态为已结束
      await transaction.collection('rooms')
        .where({
          _id: room._id
        })
        .update({
          data: {
            status: 'finished',
            endTime: new Date()
          }
        });
      
      // 保存游戏历史记录
      const playersSnapshot = room.players.map(player => ({
        openid: player.openid,
        nickName: player.nickName || '匿名用户',
        avatarUrl: player.avatarUrl || '',
        score: player.score || 0
      }));
      
      await transaction.collection('game_history').add({
        data: {
          roomCode: roomCode,
          playersSnapshot: playersSnapshot,
          endTime: new Date(),
          totalScoreBeforeSettle: totalScore
        }
      });
      
      return {
        code: 0,
        message: '游戏结算成功',
        roomCode: roomCode,
        adjustment: adjustment,
        totalScoreBefore: totalScore,
        playersCount: playerCount
      };
    });
  } catch (err) {
    console.error('[云函数] [settleGame] 执行错误:', err);
    return {
      code: -1,
      message: '服务器错误，请稍后重试'
    };
  }
};