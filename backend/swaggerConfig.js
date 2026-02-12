const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Dog Breed Prediction API",
      version: "1.0.0",
      description:
        "Tài liệu API cho hệ thống dự đoán giống chó, quản lý người dùng, và các module liên quan.",
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development Server",
      },
    ],
    tags: [
      { name: "Analytics", description: "API liên quan đến phân tích và theo dõi người dùng" },

      { name: "BFF-Prediction", description: "API tổng hợp cho chức năng dự đoán phía client" },
      { name: "BFF-Collection", description: "API tổng hợp cho chức năng bộ sưu tập (DogDex) phía client" },
      { name: "BFF-Content", description: "API tổng hợp cho các chức năng hiển thị nội dung phía client" },
      { name: "BFF-Admin", description: "API tổng hợp cho các chức năng quản trị phía client" },
      { name: "BFF-User", description: "API tổng hợp cho chức năng quản lý tài khoản người dùng phía client" },
      { name: "BFF-Public", description: "API công khai cho các chức năng không cần đăng nhập" },
      { name: "BFF-Dog", description: "API quản lý hồ sơ chó và sức khỏe" },
      { name: "BFF-Post", description: "API quản lý bài đăng cộng đồng (Lost & Found)" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: {
      "/api/analytics/track-visit": {
        post: {
          security: [],
          tags: ["Analytics"],
          summary: "Ghi nhận lượt truy cập trang (công khai)",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/routes/**/*.ts"],
};

module.exports = { options };