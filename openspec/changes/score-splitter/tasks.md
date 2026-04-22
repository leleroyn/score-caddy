## 1. Project Setup and Room Creation

- [x] 1.1 Initialize WeChat mini-program project structure
- [x] 1.2 Set up cloud database collections (rooms, game_history)
- [x] 1.3 Create room creation page (pages/create/create)
- [x] 1.4 Implement createRoom cloud function
- [x] 1.5 Add room code generation logic with collision handling
- [x] 1.6 Implement player initialization with default scores of 0
- [x] 1.7 Add navigation from create room to room management

## 2. Room Management and Score Tracking

- [x] 2.1 Create room management page (pages/room/room)
- [x] 2.2 Implement real-time listener for room data changes
- [x] 2.3 Design player list UI with avatar, nickname, and score display
- [x] 2.4 Implement current player identification with "(我)" label
- [x] 2.4.1 Add gray background styling for current player avatar
- [x] 2.4.2 Ensure current player avatar is not clickable for sending points
- [x] 2.5 Make other players' avatars clickable for sending points
- [x] 2.6 Implement visual feedback for avatar taps (scaling animation)

## 3. Send Points Functionality

- [x] 3.1 Implement numeric keypad popup for score input
- [x] 3.2 Add validation for positive integer input only
- [x] 3.3 Create sendScore cloud function
- [x] 3.4 Implement validation: current player ≠ target player
- [x] 3.5 Implement atomic score updates in database:
  - [x] 3.5.1 Current player score -= value
  - [x] 3.5.2 Target player score += value
- [x] 3.6 Close keypad and clear selection after successful transfer
- [x] 3.7 Handle error cases:
  - [x] 3.7.1 Prevent sending zero/negative points
  - [x] 3.7.2 Handle invalid target (player left room)
  - [x] 3.7.3 Handle network failures with retry mechanism

## 4. Settlement and Game History

- [x] 4.1 Add settle button UI (visible only to room owner)
- [x] 4.2 Implement settleGame cloud function
- [x] 4.3 Implement room owner validation
- [x] 4.4 Calculate adjustment value: adjust = -sum / playerCount
- [x] 4.5 Apply atomic updates to all players' scores
- [x] 4.6 Set room status to "finished"
- [x] 4.7 Save player snapshot to game_history collection
- [x] 4.8 Handle edge cases:
  - [x] 4.8.1 Settlement when total score is already 0
  - [x] 4.8.2 Settlement with non-divisible total scores (floating point)
  - [x] 4.8.3 Network failure during settlement with retry
- [x] 4.9 Show success/error messages for settlement attempts

## 5. Integration and Testing

- [x] 5.1 Test real-time score synchronization across multiple clients
- [x] 5.2 Verify send points functionality updates all clients instantly
- [x] 5.3 Test settlement functionality and score balancing to zero
- [x] 5.4 Validate game history persistence and retrieval
- [x] 5.5 Perform end-to-end testing of complete game flow
- [x] 5.6 Test error handling and edge cases
- [x] 5.7 Optimize database queries and real-time subscriptions