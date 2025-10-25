# API Integration Guide

This document describes how the frontend is integrated with the backend API.

## Environment Variables

Create a `.env.local` file in the root directory:

\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:3000
\`\`\`

For production, update this to your production API URL.

## API Client

The API client is located in `lib/api-client.ts` and provides:

- Automatic JWT token management
- Token refresh on 401 errors
- Type-safe API calls
- Error handling
- WebSocket connection support

## Authentication Flow

1. **Register**: `POST /bff/user/register`
   - Creates new user account
   - May require email verification (OTP)

2. **Login**: `POST /bff/user/login`
   - Returns user data, access token, and refresh token
   - Tokens are stored in localStorage

3. **Logout**: `POST /bff/user/logout`
   - Invalidates refresh token on server
   - Clears tokens from localStorage

4. **Token Refresh**: Automatic on 401 errors
   - Uses refresh token to get new access token

## Collection Management

- **Get Pokedex**: `GET /bff/collection/pokedex`
  - Supports pagination, search, filtering, sorting
  - Returns breeds with `isCollected` flag for logged-in users

- **Add to Collection**: `POST /bff/collection/add/{slug}`
  - Adds breed to user's collection
  - Checks for new achievements

- **Get Achievements**: `GET /bff/collection/achievements`
  - Returns user's unlocked achievements

- **Get Stats**: `GET /bff/collection/stats`
  - Returns collection statistics

## Prediction Flow

1. **Upload & Predict**: 
   - `POST /bff/predict/image` for images
   - `POST /bff/predict/video` for videos
   - `POST /bff/predict/batch` for multiple images

2. **Response includes**:
   - Predictions with bounding boxes
   - Confidence scores
   - Processed image URL
   - Prediction history ID

3. **Submit Feedback**: `POST /bff/predict/{id}/feedback`
   - Allows users to correct predictions
   - Helps improve model accuracy

## Content Management

- **Get Breed Details**: `GET /bff/content/breed/{slug}`
  - Returns detailed breed information
  - Includes collection status for logged-in users

- **Upload Media**: `POST /bff/content/media/upload`
  - Uploads images/videos to user's library

## Admin Features

Admin endpoints require `role: 'admin'`:

- `GET /bff/admin/dashboard` - Dashboard statistics
- `GET /bff/admin/feedback` - User feedback
- `POST /bff/admin/feedback/{id}/approve` - Approve feedback
- `POST /bff/admin/feedback/{id}/reject` - Reject feedback
- `GET /bff/admin/users` - User management
- `POST /bff/admin/users` - Create a new user
- `PUT /bff/admin/users/{id}` - Update a user
- `GET /bff/admin/model/config` - AI model configuration
- `PUT /bff/admin/model/config` - Update model config
- `GET /bff/admin/alerts` - System alerts
- `GET /bff/admin/histories/browse` - Browse prediction histories by directory structure

## Error Handling

All API calls include error handling:

\`\`\`typescript
try {
  const result = await apiClient.predictImage(file)
  // Handle success
} catch (error) {
  console.error('Prediction failed:', error)
  // Show error to user
}
\`\`\`

## Offline Support

For non-logged-in users, the app falls back to localStorage for:
- Collection management
- Feedback storage

This data can be synced when the user logs in.

## WebSocket Support

The API client now includes full WebSocket support for real-time detection:

### Connection Methods

\`\`\`typescript
// Connect to live detection stream
const ws = apiClient.connectLiveDetection()

// Or connect to prediction stream
const ws = apiClient.connectStreamPrediction()

// Or create custom WebSocket connection
const ws = apiClient.createWebSocketConnection('/bff/custom-endpoint')
\`\`\`

### WebSocket Endpoints

- **`WS /bff/live`** - Live camera detection with real-time streaming
- **`WS /bff/predict/stream`** - Streaming predictions for continuous video

### Authentication

WebSocket connections automatically include JWT token as query parameter:
\`\`\`
ws://localhost:3000/bff/live?token=<access_token>
\`\`\`

### Usage Example

\`\`\`typescript
const ws = apiClient.connectLiveDetection()

ws.onopen = () => {
  console.log('WebSocket connected')
}

ws.onmessage = (event) => {
  const result = JSON.parse(event.data)
  // Handle detection result
  console.log('Detected:', result.breed, result.confidence)
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}

ws.onclose = () => {
  console.log('WebSocket disconnected')
}

// Send video frame
ws.send(frameData)
\`\`\`

### Detection Result Format

\`\`\`typescript
interface DetectionResult {
  breed: string
  confidence: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  breedInfo?: {
    name: string
    origin: string
    group: string
    description: string
    slug: string
  }
}
\`\`\`

## Complete API Endpoint Summary

### BFF-User
- `POST /bff/user/register` - Register new user
- `POST /bff/user/login` - Login
- `POST /bff/user/logout` - Logout
- `GET /bff/user/profile` - Get user profile
- `PUT /bff/user/profile` - Update profile
- `POST /bff/user/refresh` - Refresh access token

### BFF-Collection
- `GET /bff/collection/pokedex` - Get pokedex with filters
- `POST /bff/collection/add/{slug}` - Add breed to collection
- `GET /bff/collection/achievements` - Get achievements
- `GET /bff/collection/stats` - Get collection stats

### BFF-Content
- `GET /bff/content/breed/{slug}` - Get breed details
- `GET /bff/content/breeds` - Get all breeds
- `POST /bff/content/media/upload` - Upload media

### BFF-Prediction
- `POST /bff/predict/image` - Predict from image
- `POST /bff/predict/video` - Predict from video
- `POST /bff/predict/batch` - Batch prediction
- `POST /bff/predict/history/{id}/feedback` - Submit feedback for a prediction (Private)
- `GET /bff/predict/history` - Get prediction history
- `GET /bff/predict/history/{id}` - Get a specific prediction history item (Public for guest's own history, Private for user's history)
- `DELETE /bff/predict/history/{id}` - Delete a prediction history item

### BFF-Admin
- `GET /bff/admin/dashboard` - Admin dashboard
- `GET /bff/admin/feedback` - Manage feedback
- `POST /bff/admin/feedback/{id}/approve` - Approve feedback
- `POST /bff/admin/feedback/{id}/reject` - Reject feedback
- `GET /bff/admin/users` - Manage users
- `POST /bff/admin/users` - Create user
- `PUT /bff/admin/users/{id}` - Update user
- `GET /bff/admin/model/config` - Get model config
- `PUT /bff/admin/model/config` - Update model config
- `POST /bff/admin/models/upload` - Upload a new AI model
- `GET /bff/admin/alerts` - Get system alerts
- `GET /bff/admin/usage` - Get usage statistics
- `GET /bff/admin/histories` - Get all prediction histories (paginated)
- `GET /bff/admin/histories/browse` - Browse histories by directory
- `GET /bff/admin/media/browse` - Browse user media files by directory

### Analytics (Public)
- `POST /api/analytics/track-visit` - Track a page visit (no auth required)

### BFF-Realtime (WebSocket)
- `WS /bff/live` - Live detection stream
- `WS /bff/predict/stream` - Prediction stream
