// 云函数: cleanupExpiredRooms
// 定时触发器：清理7天前的过期房间及相关数据
// 
// 清理规则：
// 1. 7天前的"进行中"房间 → 强制结束并保存快照到 game_history，再删除
// 2. 7天前的"已结束"房间 → 直接删除
// 3. 删除房间时，同步删除 score_records 中该房间的所有记录
// 4. game_history 中的记录保留，不清理（历史数据长期留存）

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const EXPIRE_DAYS = 7;
const MAX_DELETE_BATCH = 100; // 云数据库单次批量删除上限

exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;
  const now = new Date();
  const expireDate = new Date(now.getTime() - EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  console.log('[cleanup] 开始清理过期房间，截止时间:', expireDate.toISOString());

  let totalRoomsCleaned = 0;
  let totalRecordsCleaned = 0;

  // 分批查询过期房间
  let hasMore = true;
  let lastId = '';

  while (hasMore) {
    let query = db.collection('rooms')
      .where({
        createTime: _.lt(expireDate)
      })
      .orderBy('_id', 'asc')
      .limit(MAX_DELETE_BATCH);

    if (lastId) {
      query = db.collection('rooms')
        .where({
          _id: _.gt(lastId),
          createTime: _.lt(expireDate)
        })
        .orderBy('_id', 'asc')
        .limit(MAX_DELETE_BATCH);
    }

    const rooms = await query.get();

    if (rooms.data.length === 0) {
      hasMore = false;
      break;
    }

    lastId = rooms.data[rooms.data.length - 1]._id;

    for (const room of rooms.data) {
      try {
        // 如果是进行中的房间，先保存快照
        if (room.status === 'playing') {
          const TEA_SYSTEM_ID = '__system_tea__';
          const realPlayers = (room.players || []).filter(
            p => !p.isSystem && p.openid !== TEA_SYSTEM_ID
          );
          const teaPlayer = (room.players || []).find(
            p => p.isSystem || p.openid === TEA_SYSTEM_ID
          );

          await db.collection('game_history').add({
            data: {
              roomCode: room.roomCode,
              playersSnapshot: realPlayers.map(p => ({
                openid: p.openid,
                nickName: p.nickName || '匿名用户',
                avatarUrl: p.avatarUrl || '',
                score: p.score || 0
              })),
              teaScore: teaPlayer ? (teaPlayer.score || 0) : 0,
              teaNickName: teaPlayer ? (teaPlayer.nickName || '茶水') : '',
              enableTea: !!teaPlayer,
              endTime: now,
              autoFinished: true
            }
          });

          console.log('[cleanup] 房间 ' + room.roomCode + ' 自动结束，已保存快照');
        }

        // 删除该房间的送分记录
        let recordsDeleted = 0;
        let recHasMore = true;
        let recLastId = '';

        while (recHasMore) {
          let recQuery = db.collection('score_records')
            .where({ roomCode: room.roomCode })
            .orderBy('_id', 'asc')
            .limit(MAX_DELETE_BATCH);

          if (recLastId) {
            recQuery = db.collection('score_records')
              .where({
                _id: _.gt(recLastId),
                roomCode: room.roomCode
              })
              .orderBy('_id', 'asc')
              .limit(MAX_DELETE_BATCH);
          }

          const records = await recQuery.get();

          if (records.data.length === 0) {
            recHasMore = false;
            break;
          }

          recLastId = records.data[records.data.length - 1]._id;

          const idsToDelete = records.data.map(r => r._id);
          const deleteResult = await db.collection('score_records')
            .where({ _id: _.in(idsToDelete) })
            .remove();

          recordsDeleted += deleteResult.stats.removed;
        }

        // 删除房间
        await db.collection('rooms').doc(room._id).remove();

        totalRoomsCleaned++;
        totalRecordsCleaned += recordsDeleted;
        console.log('[cleanup] 已删除房间 ' + room.roomCode + '，清理 ' + recordsDeleted + ' 条送分记录');
      } catch (err) {
        console.error('[cleanup] 清理房间 ' + room.roomCode + ' 失败:', err);
      }
    }

    // 如果查到的不足上限，说明已到底
    if (rooms.data.length < MAX_DELETE_BATCH) {
      hasMore = false;
    }
  }

  const result = {
    code: 0,
    message: '清理完成',
    expireDate: expireDate.toISOString(),
    totalRoomsCleaned: totalRoomsCleaned,
    totalRecordsCleaned: totalRecordsCleaned
  };

  console.log('[cleanup] 清理完成:', JSON.stringify(result));
  return result;
};
