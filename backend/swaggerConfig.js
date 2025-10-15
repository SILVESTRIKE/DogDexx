const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  // 1. Thông tin chung về API
  openapi: '3.0.0',
  info: {
    title: 'Dog Breed Prediction API',
    version: '1.0.0',
    description: 'Tài liệu API cho hệ thống dự đoán giống chó, quản lý người dùng, và các module liên quan.',
  },
  
  // 2. Định nghĩa server API của bạn
  servers: [
    {
      url: 'http://localhost:3000', // Thay đổi port nếu server Node.js của bạn chạy ở port khác
      description: 'Development Server',
    },
  ],

  // Thêm tags để nhóm các API
  tags: [
    { name: 'Auth', description: 'API xác thực và quản lý tài khoản' },
    { name: 'Medias', description: 'API quản lý media (ảnh, video)' },
    { name: 'DogsWiki', description: 'API quản lý thông tin các giống chó (wiki)' },
    { name: 'Directories', description: 'API quản lý thư mục logic' },
    { name: 'Predictions', description: 'API dự đoán, lưu lịch sử, stream, kiểm tra trạng thái' },
    { name: 'AI Proxy', description: 'API chuyển tiếp trực tiếp đến AI Service (không lưu DB)' },
    { name: 'BFF-Prediction', description: 'API tổng hợp cho chức năng dự đoán phía client' },
    { name: 'BFF-Collection', description: 'API tổng hợp cho chức năng bộ sưu tập (Pokedex) phía client' },
    { name: 'BFF-Content', description: 'API tổng hợp cho các chức năng hiển thị nội dung phía client' },
    { name: 'BFF-Admin', description: 'API tổng hợp cho các chức năng quản trị phía client' },
    { name: 'BFF-User', description: 'API tổng hợp cho chức năng quản lý tài khoản người dùng phía client' },
  ],

  // 3. (QUAN TRỌNG) Toàn bộ "Từ điển dữ liệu" (Schemas) bạn đã cung cấp
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      // === General Schemas ===
      ErrorResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Mô tả lỗi',
            example: 'Yêu cầu không hợp lệ'
          },
          error: {
            type: 'string',
            description: 'Chi tiết lỗi (nếu có)',
            example: 'Invalid input for field "email"'
          }
        }
      },
      // ...existing schemas...
      AIModelCreatePayload: { type: 'object', required: ['name', 'taskType', 'format', 'huggingFaceRepo', 'fileName', 'version', 'creator_id'], properties: { name: { type: 'string' }, description: { type: 'string' }, taskType: { type: 'string', enum: ['DOG_BREED_CLASSIFICATION', 'CAT_BREED_CLASSIFICATION', 'OBJECT_DETECTION'] }, format: { type: 'string', enum: ['ONNX', 'TENSORFLOW_JS', 'PYTORCH'] }, huggingFaceRepo: { type: 'string' }, fileName: { type: 'string' }, labelsFileName: { type: 'string' }, version: { type: 'string' }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] }, tags: { type: 'array', items: { type: 'string' } }, creator_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }}},
      ProductResponse: { type: 'object', required: ['name', 'quantity', 'slug', 'price'], properties: { id: { type: 'string' }, name: { type: 'string' }, quantity: { type: 'number' }, slug: { type: 'string' }, price: { type: 'number' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
      ProductCreatePayload: { type: 'object', required: ['name', 'quantity', 'slug', 'price'], properties: { name: { type: 'string' }, quantity: { type: 'number' }, slug: { type: 'string' }, price: { type: 'number' }}},
        AnalyticsEventResponse: { type: 'object', required: ['eventName'], properties: { id: { type: 'string' }, eventName: { type: 'string', enum: ['SUCCESSFUL_TRIAL'] }, fingerprint: { type: 'string' }, ip: { type: 'string' }, userAgent: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
        AnalyticsEventCreatePayload: { type: 'object', required: ['eventName'], properties: { eventName: { type: 'string', enum: ['SUCCESSFUL_TRIAL'] }, fingerprint: { type: 'string' }, ip: { type: 'string' }, userAgent: { type: 'string' }}},
        PredictionHistoryResponse: { type: 'object', required: ['media', 'mediaPath', 'modelUsed', 'predictions'], properties: { id: { type: 'string' }, user: { '$ref': '#/components/schemas/UserResponse' }, media: { '$ref': '#/components/schemas/MediaResponse' }, mediaPath: { type: 'string' }, modelUsed: { type: 'string' }, predictions: { type: 'array', items: { '$ref': '#/components/schemas/YoloPrediction' } }, processedMediaPath: { type: 'string' }, isCorrect: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
        PredictionHistoryCreatePayload: { type: 'object', required: ['processed_media_base64', 'media_type', 'detections'], properties: { processed_media_base64: { type: 'string', description: 'Ảnh đã xử lý (base64)', example: '...' }, media_type: { type: 'string', enum: ['image', 'video'], example: 'image' }, detections: { type: 'array', items: { '$ref': '#/components/schemas/YoloPrediction' } }}},
        MediaResponse: { type: 'object', required: ['name', 'mediaPath'], properties: { id: { type: 'string' }, name: { type: 'string' }, mediaPath: { type: 'string' }, description: { type: 'string' }, type: { type: 'string' }, creator_id: { '$ref': '#/components/schemas/UserResponse' }, directory_id: { '$ref': '#/components/schemas/DirectoryResponse' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
        MediaCreatePayload: { type: 'object', required: ['name', 'mediaPath'], properties: { name: { type: 'string' }, mediaPath: { type: 'string' }, description: { type: 'string' }, type: { type: 'string' }, creator_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }, directory_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }}},
        DirectoryResponse: { type: 'object', required: ['name', 'creator_id'], properties: { id: { type: 'string' }, name: { type: 'string' }, parent_id: { '$ref': '#/components/schemas/DirectoryResponse' }, creator_id: { '$ref': '#/components/schemas/UserResponse' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
        DirectoryCreatePayload: { type: 'object', required: ['name', 'creator_id'], properties: { name: { type: 'string' }, parent_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }, creator_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }}},
        YoloPrediction: {
          type: 'object',
          required: ['box', 'class', 'confidence'],
          properties: {
            track_id: { type: 'number', example: 1 },
            box: { type: 'array', items: { type: 'number' }, example: [10, 20, 30, 40] },
            class: { type: 'string', example: 'husky' },
            confidence: { type: 'number', example: 0.98 },
            class_id: { type: 'number', example: 5 }
          }
        },
        DogBreedWikiResponse: { type: 'object', required: ['slug', 'display_name', 'description'], properties: { id: { type: 'string' }, slug: { type: 'string' }, display_name: { type: 'string' }, group: { type: 'string' }, coat_type: { type: 'string' }, coat_colors: { type: 'array', items: { type: 'string' } }, description: { type: 'string' }, life_expectancy: { type: 'string' }, temperament: { type: 'array', items: { type: 'string' } }, height: { type: 'string' }, weight: { type: 'string' }, favorite_foods: { type: 'array', items: { type: 'string' } }, common_health_issues: { type: 'array', items: { type: 'string' } }, energy_level: { type: 'number' }, trainability: { type: 'number' }, shedding_level: { type: 'number' }, good_with_children: { type: 'boolean' }, good_with_other_pets: { type: 'boolean' }, suitable_for: { type: 'array', items: { type: 'string' } }, unsuitable_for: { type: 'array', items: { type: 'string' } }, climate_preference: { type: 'string' }, maintenance_difficulty: { type: 'number' }, trainable_skills: { type: 'array', items: { type: 'string' } }, fun_fact: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
        DogBreedWikiCreatePayload: { type: 'object', required: ['slug', 'display_name', 'description'], properties: { slug: { type: 'string' }, display_name: { type: 'string' }, group: { type: 'string' }, coat_type: { type: 'string' }, coat_colors: { type: 'array', items: { type: 'string' } }, description: { type: 'string' }, life_expectancy: { type: 'string' }, temperament: { type: 'array', items: { type: 'string' } }, height: { type: 'string' }, weight: { type: 'string' }, favorite_foods: { type: 'array', items: { type: 'string' } }, common_health_issues: { type: 'array', items: { type: 'string' } }, energy_level: { type: 'number' }, trainability: { type: 'number' }, shedding_level: { type: 'number' }, good_with_children: { type: 'boolean' }, good_with_other_pets: { type: 'boolean' }, suitable_for: { type: 'array', items: { type: 'string' } }, unsuitable_for: { type: 'array', items: { type: 'string' } }, climate_preference: { type: 'string' }, maintenance_difficulty: { type: 'number' }, trainable_skills: { type: 'array', items: { type: 'string' } }, fun_fact: { type: 'string' }}},
        OtpResponse: { type: 'object', required: ['email', 'type', 'expiresAt'], properties: { id: { type: 'string' }, email: { type: 'string' }, type: { type: 'string', enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'] }, expiresAt: { type: 'string', format: 'date-time' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
        OtpCreatePayload: { type: 'object', required: ['email', 'otp', 'type', 'expiresAt'], properties: { email: { type: 'string' }, otp: { type: 'string' }, type: { type: 'string', enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'] }, expiresAt: { type: 'string', format: 'date-time' }}},
        RefreshTokenResponse: { type: 'object', required: ['user', 'jti', 'token', 'expiresAt'], properties: { id: { type: 'string' }, user: { '$ref': '#/components/schemas/UserResponse' }, jti: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' }, used: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
        RefreshTokenCreatePayload: { type: 'object', required: ['user', 'jti', 'token', 'expiresAt'], properties: { user: { type: 'string', example: '60d21b4667d0d8992e610c85' }, jti: { type: 'string' }, token: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' }, used: { type: 'boolean' } } },
    },
  },

  // 4. Mặc định yêu cầu xác thực cho tất cả API
  security: [
    {
      bearerAuth: [],
    },
  ],
};

// 5. Cấu hình để `swagger-jsdoc` biết phải quét file nào
const options = {
  swaggerDefinition,

  apis: ['./src/routes/*.ts', './src/routes/**/*.ts'], 
};

// 6. Tạo ra đối tượng spec cuối cùng và export nó
const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;