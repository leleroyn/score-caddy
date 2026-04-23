# 把把赢记分器

纸牌游戏记分微信小程序，支持多人在线实时同步。

## 功能

- 创建/加入房间，6位房间号
- 点击玩家头像送分，实时同步
- 送分记录聊天式展示
- 房主一键结束游戏，保存历史
- 已结束房间可回看最终分数

## 技术栈

微信小程序 + 微信云开发（云函数 + 云数据库）

## 快速开始

```bash
git clone https://github.com/yourname/score-caddy.git
```

1. 用微信开发者工具导入项目
2. 开通云开发，创建集合 `rooms`、`score_records`、`game_history`
3. 右键云函数文件夹 → 创建并部署：云端安装依赖
4. 编译预览

## 云函数

| 云函数 | 说明 |
|--------|------|
| createRoom | 创建房间 |
| joinRoom | 加入房间 |
| sendScore | 送分（事务安全） |
| settleGame | 结束游戏 |
| updatePlayerInfo | 更新玩家信息 |
| cleanupExpiredRooms | 定时清理7天前房间 |

## 许可证

MIT
