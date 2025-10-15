import mongoose from "mongoose";
import app from "./app";

const startServer = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI phải được định nghĩa trong file .env");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET phải được định nghĩa trong file .env");
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Đã kết nối thành công tới MongoDB tại:", process.env.MONGO_URI);
  } catch (error) {
    console.error("Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
  const PORT = process.env.PORT || 3000;
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  console.log(`AI Service URL: ${AI_SERVICE_URL}`);
  app.listen(PORT, () => {
    console.log(`AI Service đang chạy tại: ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
    console.log(`HTTP Server đang chạy trên cổng: http://localhost:${PORT}`);
  });
};

startServer();
