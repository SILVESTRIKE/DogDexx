export const tokenConfig = {
  /**
   * Cấu hình cho người dùng thử (Guest User).
   */
  guest: {
    initialTokens: 10,
    expirationSeconds: 7 * 24 * 60 * 60, // 7 ngày
  },

  /**
   * Chi phí token cho từng loại hành động.
   */
  costs: {
    imagePrediction: 2,
    videoPrediction: 10,
    streamSession: 5,
    chatMessage: 1,
  },
};