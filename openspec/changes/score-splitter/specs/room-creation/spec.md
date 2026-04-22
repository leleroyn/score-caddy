## ADDED Requirements

### Requirement: Users can create a game room
The system SHALL allow users to create a new game room with a unique room code and configurable player count.

#### Scenario: Successful room creation
- **WHEN** user clicks "Create Room" button and specifies player count
- **THEN** system generates a unique 6-character room code
- **AND** system creates a room document in the database with status "playing"
- **AND** system initializes player list with current user as creator
- **AND** system sets all player scores to 0
- **AND** system navigates user to the room management page

#### Scenario: Room creation with default player count
- **WHEN** user clicks "Create Room" button without specifying player count
- **THEN** system uses default player count of 4
- **AND** proceeds with room creation as normal

#### Scenario: Room creation failure
- **WHEN** system fails to generate a unique room code after 3 attempts
- **THEN** system shows error message "Unable to create room, please try again"

### Requirement: Users can join an existing game room
The system SHALL allow users to join an existing game room using a room code.

#### Scenario: Successful room joining
- **WHEN** user enters a valid room code and clicks "Join Room"
- **THEN** system adds user to the room's player list
- **AND** system initializes user's score to 0
- **AND** system navigates user to the room management page

#### Scenario: Joining non-existent room
- **WHEN** user enters a room code that doesn't exist
- **THEN** system shows error message "Room not found"

#### Scenario: Joining full room
- **WHEN** user tries to join a room that has reached maximum player capacity
- **THEN** system shows error message "Room is full"

#### Scenario: Joining finished room
- **WHEN** user tries to join a room with status "finished"
- **THEN** system shows error message "Game has already ended"