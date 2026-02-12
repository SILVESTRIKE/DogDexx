# Future Features Module

This folder contains features that are ready for future development but NOT yet integrated into the main app.

## Structure

```
future_features/
├── models/
│   ├── app_setting.model.ts     # Configurable app settings
│   ├── qr_scan_log.model.ts     # QR scan tracking logs
│   └── reward_log.model.ts      # Token reward history
├── services/
│   └── admin_settings.service.ts # Admin CRUD operations
├── controllers/
│   └── admin_settings.controller.ts
├── routes/
│   └── admin_settings.route.ts
└── index.ts                      # Exports all modules
```

## Features

### 1. App Settings
- Configurable settings stored in MongoDB
- Categories: rewards, notifications, limits, general
- Default settings auto-seeded on startup

### 2. Plan Limits Management  
- Admin can view/edit dogLimit and healthRecordLimitPerDog
- No code changes needed to update limits

### 3. QR Scan Logs
- Tracks every QR code scan with location data
- Filter by dog, owner, date range
- Useful for lost dog reports

### 4. Reward Logs
- Tracks all token rewards given
- Types: finder_reward, referral, achievement, admin_grant
- Statistics endpoint for analytics

## How to Integrate

1. **Add route to app.ts:**
```typescript
import { adminSettingsRoutes } from './future_features';
app.use('/bff/admin/settings', adminSettingsRoutes);
```

2. **Seed settings on startup:**
```typescript
import { AdminSettingsService } from './future_features';
AdminSettingsService.seedDefaultSettings();
```

3. **Update dog.controller.ts to use settings:**
```typescript
import { AdminSettingsService, QrScanLogModel, RewardLogModel } from './future_features';

// Get reward amount from settings
const rewardAmount = await AdminSettingsService.getSetting('finder_reward_tokens') || 10;

// Log QR scan
await QrScanLogModel.create({ dog_id, owner_id, scannerIp, location, dogWasLost: true, alertSent: true });

// Log reward
await RewardLogModel.create({ user_id, user_email, type: 'finder_reward', amount: rewardAmount, description: '...' });
```

## API Endpoints (when integrated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /bff/admin/settings | Get all app settings |
| PUT | /bff/admin/settings/:key | Update a setting |
| GET | /bff/admin/plans | Get all plans with limits |
| PUT | /bff/admin/plans/:id/limits | Update plan limits |
| GET | /bff/admin/qr-scans | Get QR scan logs |
| GET | /bff/admin/rewards | Get reward logs |
| GET | /bff/admin/rewards/stats | Get reward statistics |
