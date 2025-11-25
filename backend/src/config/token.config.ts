const jwtAccessExpirationSeconds = parseInt(process.env.JWT_ACCESS_EXPIRATION || '900', 10); // Mặc định là 900 giây (15 phút)
const jwtRefreshExpirationSeconds = parseInt(process.env.JWT_REFRESH_EXPIRATION || '2592000', 10); // Mặc định là 2592000 giây (30 ngày)

export const tokenConfig = {
  guest: {
    initialTokens: 10,
    expirationSeconds: 24 * 60 * 60, // 1 ngày
  },
  costs: {
    imagePrediction: 2,
    videoPrediction: 10,
    streamSession: 5,
    chatMessage: 1,
  },
  access: {
    secret: process.env.JWT_SECRET || 'default_access_secret',
    expirationSeconds: jwtAccessExpirationSeconds,
  },

  refresh: {
    secret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    expirationSeconds: jwtRefreshExpirationSeconds,
  },
};