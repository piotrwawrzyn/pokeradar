Design a detailed implementation plan for migrating from file-based storage to MongoDB, with the goal of eventually switching to a cron-based approach.

## Current Architecture

### Repository Pattern (existing)
- `ICollectionRepository<T>` - base interface with `getAll()`, optional `getById()`
- `IShopRepository` extends it with `getEnabled()`
- `IWatchlistRepository` extends base
- File implementations: `FileShopRepository`, `FileWatchlistRepository`

### Data that stays as JSON files in the repo (at least for now)
**ShopConfig** (17 shops in JSON files)

### Data to Migrate

2. **WatchlistProduct** (12 products in single JSON)
   - Search phrases, price constraints
   - Auto-generated ID from name

3. **NotificationState** (currently in-memory StateManager)
   - CRITICAL: Must persist to survive restarts
   - Key: `{productId}:{shopId}`
   - Tracks: lastNotified, lastPrice, wasAvailable
   - Only need to keep one record at a time for key `{productId}:{shopId}`

4. **ProductResult** (currently discarded after each scan)
   - We don't need to support chart / history for now
   - So it looks like we can just store one record per item `{productId}:{shopId}`
   - High volume: ~2000 scans per hour

### MongoDB Atlas
- User has free cluster at cloud.mongodb.com
- Need connection string handling
- Consider free tier limits (512MB storage)

DB Username: pokebot
DB Password: TUCPyPC_Ub4ghxr
Connection string: mongodb+srv://pokebot:<db_password>@cluster0.cubc62f.mongodb.net/

### Future Goal: Cron-based approach
- We introduce mongodb in order to keep all required state in the DB and resign from setInterval appraoch
- Instead of setInterval, use external cron to trigger scans
- Requires state to survive between invocations
- NotificationState persistence is critical for this

## Design Requirements

1. Create MongoDB repository implementations
2. Add state repository interface and implementation for NotificationState
3. Consider scan results storage (with TTL for free tier limits)
4. Migration script to import existing JSON configs
5. Environment variable for MongoDB connection string / credentials
6. Graceful fallback if MongoDB unavailable?

Please provide a detailed implementation plan with:
- New files to create
- Existing files to modify
- MongoDB collections and indexes
- Migration approach
- Testing strategy