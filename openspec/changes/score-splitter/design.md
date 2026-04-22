## Context

We are building a WeChat mini-program for tracking scores in card games with a unique rule: players can only give points to others (not receive or take). The app must use WeChat's native development with cloud database and cloud functions for real-time synchronization. The current manual score tracking is error-prone and disruptive.

## Goals / Non-Goals

**Goals:**
- Enable players to create and join game rooms
- Display player scores with clear identification of the current user ("self")
- Allow the current user to send points to any other player in the room
- Automatically update all players' scores in real-time via cloud database push
- Provide a settlement function for the room owner to balance all scores to zero sum
- Persist game results in a history collection

**Non-Goals:**
- Supporting gameplay mechanics beyond score tracking
- Implementing user authentication (rely on WeChat's OpenID)
- Supporting cross-platform (only WeChat mini-program)
- Adding chat or other social features

## Decisions

### Architecture: Cloud-First with Real-Time Database
We chose to use WeChat Cloud Database's real-time push capabilities rather than polling or WebSocket alternatives because:
- It provides low-latency updates with minimal code complexity
- It integrates seamlessly with WeChat's cloud functions
- It handles connection management and reconnection automatically
- Alternative: Using WebSocket would require managing connections and scaling concerns

### Data Model: Denormalized Player Scores in Room Document
We store player scores directly in the `rooms` collection rather than a separate `scores` collection because:
- Room sizes are small (typically 4-8 players), so denormalization is acceptable
- It allows atomic updates to multiple players' scores in a single transaction
- It simplifies real-time synchronization as the entire room object updates
- Alternative: Separate scores collection would require multiple queries and complex synchronization

### Cloud Functions: Atomic Transactions for Score Updates
We use database transactions in cloud functions for `sendScore` and `settleGame` because:
- They ensure consistency when updating multiple players' scores
- They prevent race conditions when multiple users send points simultaneously
- Alternative: Separate updates could lead to inconsistent states if one update fails

### Settlement Algorithm: Proportional Adjustment
We chose to adjust all players' scores equally when balancing to zero sum because:
- It's mathematically simple and fair (no player gains or loses disproportionately)
- It preserves the relative differences between players' scores
- Alternative: Adjusting only the highest/lowest scores would be unfair and complex

### UI/UX: Clear Visual Distinction for Self
We will mark the current player's avatar with a "(我)" label and gray background because:
- It's immediately visible without requiring extra taps
- It follows WeChat mini-program design conventions
- Alternative: Using only color might not be accessible for color-blind users

## Risks / Trade-offs

[Real-time dependency on WeChat cloud] → If WeChat cloud services experience downtime, real-time updates will fail. Mitigation: Implement local caching with retry mechanism and show offline status.

[Database read limits] → Frequent real-time updates could exceed database quota. Mitigation: Use efficient queries and consider debouncing rapid score changes.

[Settlement fairness] → Equal adjustment might feel unfair if one player has extremely high score. Mitigation: The rule is part of the game definition; we follow the specified algorithm.

[Room code generation] → Random room codes could collide. Mitigation: Use sufficiently long random strings (6+ alphanumeric chars) and check for existence before creation.

## Migration Plan

Not applicable - this is a new feature with no existing version to migrate from.

## Open Questions

1. Should we add a timeout for inactive rooms to free up database space?
2. What happens if a player leaves during a game? Should we pause or continue?
3. Should we add a "undo" function for the last score transfer?

These questions can be addressed in future iterations and do not block the initial implementation.