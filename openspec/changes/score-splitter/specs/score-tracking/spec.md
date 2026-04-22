## ADDED Requirements

### Requirement: Display player list with scores
The system SHALL display all players in the current room with their avatars, nicknames, and current scores.

#### Scenario: Initial score display
- **WHEN** user enters a room
- **THEN** system shows all players with their avatars
- **AND** system displays each player's nickname below avatar
- **AND** system shows each player's current score (initially 0) below nickname
- **AND** system marks the current player with "(我)" label and gray background

#### Scenario: Score update display
- **WHEN** any player's score changes in the database
- **THEN** system updates the displayed score for that player in real-time
- **AND** system preserves the "(我)" label for current player

### Requirement: Identify current player vs others
The system SHALL visually distinguish the current player from other players in the room.

#### Scenario: Current player identification
- **WHEN** displaying the player list
- **THEN** system shows "(我)" label next to current player's nickname
- **AND** system applies gray background to current player's avatar container
- **AND** system does NOT make current player's avatar clickable for sending points

#### Scenario: Other players identification
- **WHEN** displaying the player list
- **THEN** system shows other players' avatars without "(我)" label
- **AND** system applies normal background to other players' avatar containers
- **AND** system makes other players' avatars clickable for sending points

### Requirement: Real-time score synchronization
The system SHALL use WeChat cloud database real-time push to synchronize scores across all room participants.

#### Scenario: Score change propagation
- **WHEN** any player's score is updated in the database
- **THEN** system receives real-time update for that room document
- **AND** system updates the displayed score for the affected player within 1 second
- **AND** system does not require manual refresh to see score changes

#### Scenario: Connection interruption handling
- **WHEN** network connection is temporarily lost
- **THEN** system continues to display last known scores
- **AND** system automatically resumes real-time updates when connection is restored
- **AND** system shows visual indicator when offline (optional enhancement)