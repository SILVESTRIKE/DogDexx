export const refreshTokenCookieConfig = {
    httpOnly: true,        // Prevent JavaScript access (XSS protection)
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    sameSite: 'lax' as const,  // Allow cross-origin for mobile apps, still protects against CSRF
    path: '/bff/user',     // Only sent to auth endpoints
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};
