## ADDED Requirements

### Requirement: Settle game balance to zero sum
The system SHALL allow the room owner to settle the game, adjusting all players' scores so the total sum equals zero.

#### Scenario: Successful settlement by room owner
- **WHEN** room owner clicks "Settle" button
- **AND** system calculates current total score sum
- **THEN** system calls settleGame cloud function
- **AND** cloud function validates user is room owner
- **AND** cloud function calculates adjustment value: adjust = -sum / playerCount
- **AND** cloud function atomically updates each player's score: score = score + adjust
- **AND** system sets room status to "finished"
- **AND** system saves player snapshot to game_history collection
- **AND** system shows confirmation "Game settled successfully"

#### Scenario: Settlement attempt by non-owner
- **WHEN** non-owner player clicks "Settle" button
- **THEN** system does NOT show settle button (hidden by permission)
- **OR** cloud function rejects request with permission error
- **AND** system shows error "Only room owner can settle the game"

#### Scenario: Settlement with zero total score
- **WHEN** room owner clicks "Settle" button
- **AND** current total score sum is already 0
- **THEN** cloud function proceeds with settlement (no adjustment needed)
- **AND** system sets room status to "finished"
- **AND** system saves player snapshot to game_history collection

#### Scenario: Settlement with non-divisible total score
- **WHEN** room owner clicks "Settle" button
- **AND** total score sum is not evenly divisible by player count
- **THEN** cloud function calculates adjustment using floating point division
- **AND** applies adjustment to each player's score (may result in decimal scores)
- **AND** final total score equals 0 (within floating point precision)

#### Scenario: Network failure during settlement
- **WHEN** network request to settleGame cloud function fails
- **THEN** system shows error "Failed to settle game, please try again"
- **AND** system does NOT change room status
- **AND** system does NOT save to game_history
- **AND** system allows retry of the operation

### Requirement: Persist game results
The system SHALL store a snapshot of player scores and game metadata when a game is settled.

#### Scenario: Game history storage
- **WHEN** settlement is successful
- **THEN** cloud function creates document in game_history collection
- **AND** document includes roomCode
- **AND** document includes playersSnapshot array with {openid, nickName, avatarUrl, finalScore}
- **AND** document includes endTime timestamp
- **AND** system can retrieve this history for future reference