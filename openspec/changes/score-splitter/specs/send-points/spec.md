## ADDED Requirements

### Requirement: Send points to other players
The system SHALL allow the current player to send points to any other player in the room.

#### Scenario: Successful points transfer
- **WHEN** current player clicks on another player's avatar
- **AND** enters a positive integer value in the numeric keypad
- **AND** confirms the transfer
- **THEN** system calls sendScore cloud function with target player's OpenID and value
- **AND** cloud function validates current player ≠ target player
- **AND** cloud function atomically updates:
  • Current player's score: score -= value
  • Target player's score: score += value
- **AND** system closes numeric keypad and clears selection
- **AND** system updates displayed scores for both players in real-time

#### Scenario: Attempt to send points to self
- **WHEN** current player clicks on their own avatar
- **THEN** system does NOT open numeric keypad
- **AND** system shows no response or visual feedback indicating invalid action

#### Scenario: Send zero or negative points
- **WHEN** current player enters zero or negative number in keypad
- **THEN** system prevents confirmation and shows error "Please enter a positive number"
- **AND** system does NOT call sendScore cloud function

#### Scenario: Send points with invalid target (left room)
- **WHEN** current player attempts to send points to player who left room
- **AND** system has not yet updated player list
- **THEN** cloud function returns error for invalid target OpenID
- **AND** system shows error "Player no longer in room"

#### Scenario: Network failure during points transfer
- **WHEN** network request to sendScore cloud function fails
- **THEN** system shows error "Failed to send points, please try again"
- **AND** system does NOT update local scores (maintains consistency)
- **AND** system allows retry of the operation