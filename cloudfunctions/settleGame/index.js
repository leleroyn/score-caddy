// 云函数: settleGame
// 结算游戏：标记房间为已结束，保存所有玩家分数快照到 game_history
// 不做任何分数调整，后续结算逻辑待定

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const TEA_SYSTEM_ID = '__system_tea__';

exports.main = async (event, context) => {
  try {
    const { roomCode } = event;
    const { OPENID } = cloud.getWXContext();
    
    if (!roomCode) {
      return { code: -1, message: '参数错误：缺少房间号' };
    }
    
    const db = cloud.database();
    
    const roomResult = await db.collection('rooms').where({ roomCode }).get();
    
    if (roomResult.data.length === 0) {
      return { code: -1, message: '房间不存在' };
    }
    
    const room = roomResult.data[0];
    
    if (room.creatorId !== OPENID) {
      return { code: -1, message: '只有房主可以结算游戏' };
    }
    
    if (room.status === 'finished') {
      return { code: -1, message: '游戏已经结束' };
    }
    
    // 分离真实玩家和茶水系统玩家
    const realPlayers = room.players.filter(p => !p.isSystem && p.openid !== TEA_SYSTEM_ID);
    const teaPlayer = room.players.find(p => p.isSystem || p.openid === TEA_SYSTEM_ID);
    
    // 玩家分数快照
    const playersSnapshot = realPlayers.map(player => ({
      openid: player.openid,
      nickName: player.nickName || '匿名用户',
      avatarUrl: player.avatarUrl || '',
      score: player.score || 0
    }));

    // 使用事务保证原子性
    return db.runTransaction(async function (transaction) {
      // 更新房间状态为已结束（不做分数调整）
      await transaction.collection('rooms')
        .where({ _id: room._id })
        .update({
          data: {
            status: 'finished',
            endTime: new Date()
          }
        });
      
      // 保存游戏历史记录
      await transaction.collection('game_history').add({
        data: {
          roomCode: roomCode,
          playersSnapshot: playersSnapshot,
          teaScore: teaPlayer ? (teaPlayer.score || 0) : 0,
          teaNickName: teaPlayer ? (teaPlayer.nickName || '茶水') : '',
          enableTea: !!teaPlayer,
          endTime: new Date()
        }
      });
      
      return {
        code: 0,
        message: '游戏结算成功',
        roomCode: roomCode,
        playersCount: realPlayers.length,
        teaScore: teaPlayer ? (teaPlayer.score || 0) : 0
      };
    });
  } catch (err) {
    console.error('[云函数] [settleGame] 执行错误:', err);
    return { code: -1, message: '服务器错误，请稍后重试' };
  }
};
