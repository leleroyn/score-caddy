## Why

We need to build a WeChat mini-program for tracking scores in card games where players can only give points to others (not take). The current manual score tracking is error-prone and disruptive to gameplay. This app will automate score keeping with real-time synchronization using WeChat's cloud database.

## What Changes

- Create WeChat mini-program pages for room creation and room management
- Implement player score display with clear identification of "self" vs others
- Build sendScore and settleGame cloud functions for score transactions
- Add real-time score updates using WeChat cloud database push capabilities
- Implement settlement algorithm that balances scores to zero sum

## Capabilities

### New Capabilities
- `room-creation`: Create game rooms with configurable player count
- `score-tracking`: Real-time display and updating of player scores
- `send-points`: Allow players to send points to other players (not receive)
- `settle-balance`: Automatic score balancing to zero sum at game end
- `game-history`: Persistent storage of completed game results

### Modified Capabilities
*(No existing capabilities being modified)*

## Impact

- Frontend: WeChat mini-program pages in `/pages/create/` and `/pages/room/`
- Backend: Cloud functions `createRoom`, `sendScore`, `settleGame`
- Database: New collections `rooms` and `game_history`
- Real-time data synchronization between all room participants