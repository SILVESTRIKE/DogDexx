const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

<<<<<<< Updated upstream
=======
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

  // 3. (QUAN TRỌNG) Toàn bộ "Từ điển dữ liệu" (Schemas)
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
            example: 'An error occurred'
          },
          error: {
            type: 'object'
          }
        }
      },
      PaginatedDogBreedWikiResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/DogBreedWikiResponse'
            }
          },
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' }
        }
      },
      PaginatedUserResponse: {
        // Define this schema if it's used elsewhere
        // Example definition:
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/UserResponse' } },
          total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, totalPages: { type: 'integer' }
        }
      },

      // === Core Schemas ===
      PredictionHistoryResponse: { // Combined and cleaned up

        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Mô tả lỗi',
            example: 'Yêu cầu không hợp lệ'
          },
          processedMediaPath: { type: 'string', example: '/processed/images/xyz.jpg' },
          modelUsed: { type: 'string', example: 'YOLOv8_image_batch' },
          isCorrect: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      PredictionHistoryCreatePayload: {
        type: 'object',
        required: ['processed_media_base64', 'media_type', 'detections'],
        properties: {
          processed_media_base64: { type: 'string', description: 'Ảnh đã xử lý (base64)', example: '...' },
          media_type: { type: 'string', enum: ['image', 'video'], example: 'image' },
          detections: {
            type: 'array',
            items: { $ref: '#/components/schemas/YoloPrediction' }
          }
        }
      },
      MediaResponse: { // Combined and cleaned up
        type: 'object',
        required: ['name', 'mediaPath', 'type'],
        properties: {
          id: { type: 'string', example: '60d21b4667d0d8992e610c85' },
          name: { type: 'string', example: 'dog.jpg' },
          mediaPath: { type: 'string', example: '/uploads/images/2024/05/dog.jpg' },
          type: { type: 'string', enum: ['image', 'video'], example: 'image' },
          creator_id: { $ref: '#/components/schemas/UserResponse' },
          directory_id: { type: 'string', example: '60d21b4667d0d8992e610c85' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
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
      AIModelCreatePayload: { type: 'object', required: ['name', 'taskType', 'format', 'huggingFaceRepo', 'fileName', 'version', 'creator_id'], properties: { name: { type: 'string' }, description: { type: 'string' }, taskType: { type: 'string', enum: ['DOG_BREED_CLASSIFICATION', 'CAT_BREED_CLASSIFICATION', 'OBJECT_DETECTION'] }, format: { type: 'string', enum: ['ONNX', 'TENSORFLOW_JS', 'PYTORCH'] }, huggingFaceRepo: { type: 'string' }, fileName: { type: 'string' }, labelsFileName: { type: 'string' }, version: { type: 'string' }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] }, tags: { type: 'array', items: { type: 'string' } }, creator_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }}},
      ProductResponse: { type: 'object', required: ['name', 'quantity', 'slug', 'price'], properties: { id: { type: 'string' }, name: { type: 'string' }, quantity: { type: 'number' }, slug: { type: 'string' }, price: { type: 'number' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
      ProductCreatePayload: { type: 'object', required: ['name', 'quantity', 'slug', 'price'], properties: { name: { type: 'string' }, quantity: { type: 'number' }, slug: { type: 'string' }, price: { type: 'number' }}},
      AnalyticsEventResponse: { type: 'object', required: ['eventName'], properties: { id: { type: 'string' }, eventName: { type: 'string', enum: ['SUCCESSFUL_TRIAL'] }, fingerprint: { type: 'string' }, ip: { type: 'string' }, userAgent: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
      AnalyticsEventCreatePayload: { type: 'object', required: ['eventName'], properties: { eventName: { type: 'string', enum: ['SUCCESSFUL_TRIAL'] }, fingerprint: { type: 'string' }, ip: { type: 'string' }, userAgent: { type: 'string' }}},
      MediaCreatePayload: { type: 'object', required: ['name', 'mediaPath'], properties: { name: { type: 'string' }, mediaPath: { type: 'string' }, description: { type: 'string' }, type: { type: 'string' }, creator_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }, directory_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }}},
      DirectoryResponse: { type: 'object', required: ['name', 'creator_id'], properties: { id: { type: 'string' }, name: { type: 'string' }, parent_id: { '$ref': '#/components/schemas/DirectoryResponse' }, creator_id: { '$ref': '#/components/schemas/UserResponse' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
      DirectoryCreatePayload: { type: 'object', required: ['name', 'creator_id'], properties: { name: { type: 'string' }, parent_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }, creator_id: { type: 'string', example: '60d21b4667d0d8992e610c85' }}},
      DogBreedWikiResponse: { type: 'object', required: ['slug', 'display_name', 'description'], properties: { id: { type: 'string' }, slug: { type: 'string' }, display_name: { type: 'string' }, imagePath: { type: 'string', example: '/wiki/images/husky.jpg' }, group: { type: 'string' }, coat_type: { type: 'string' }, coat_colors: { type: 'array', items: { type: 'string' } }, description: { type: 'string' }, life_expectancy: { type: 'string' }, temperament: { type: 'array', items: { type: 'string' } }, height: { type: 'string' }, weight: { type: 'string' }, favorite_foods: { type: 'array', items: { type: 'string' } }, common_health_issues: { type: 'array', items: { type: 'string' } }, energy_level: { type: 'number' }, trainability: { type: 'number' }, shedding_level: { type: 'number' }, good_with_children: { type: 'boolean' }, good_with_other_pets: { type: 'boolean' }, suitable_for: { type: 'array', items: { type: 'string' } }, unsuitable_for: { type: 'array', items: { type: 'string' } }, climate_preference: { type: 'string' }, maintenance_difficulty: { type: 'number' }, trainable_skills: { type: 'array', items: { type: 'string' } }, fun_fact: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
      DogBreedWikiCreatePayload: { type: 'object', required: ['slug', 'display_name', 'description'], properties: { slug: { type: 'string' }, display_name: { type: 'string' }, imagePath: { type: 'string', example: '/wiki/images/husky.jpg' }, group: { type: 'string' }, coat_type: { type: 'string' }, coat_colors: { type: 'array', items: { type: 'string' } }, description: { type: 'string' }, life_expectancy: { type: 'string' }, temperament: { type: 'array', items: { type: 'string' } }, height: { type: 'string' }, weight: { type: 'string' }, favorite_foods: { type: 'array', items: { type: 'string' } }, common_health_issues: { type: 'array', items: { type: 'string' } }, energy_level: { type: 'number' }, trainability: { type: 'number' }, shedding_level: { type: 'number' }, good_with_children: { type: 'boolean' }, good_with_other_pets: { type: 'boolean' }, suitable_for: { type: 'array', items: { type: 'string' } }, unsuitable_for: { type: 'array', items: { type: 'string' } }, climate_preference: { type: 'string' }, maintenance_difficulty: { type: 'number' }, trainable_skills: { type: 'array', items: { type: 'string' } }, fun_fact: { type: 'string' }}},
      OtpResponse: { type: 'object', required: ['email', 'type', 'expiresAt'], properties: { id: { type: 'string' }, email: { type: 'string' }, type: { type: 'string', enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'] }, expiresAt: { type: 'string', format: 'date-time' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
      OtpCreatePayload: { type: 'object', required: ['email', 'otp', 'type', 'expiresAt'], properties: { email: { type: 'string' }, otp: { type: 'string' }, type: { type: 'string', enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'] }, expiresAt: { type: 'string', format: 'date-time' }}},
      RefreshTokenResponse: { type: 'object', required: ['user', 'jti', 'token', 'expiresAt'], properties: { id: { type: 'string' }, user: { '$ref': '#/components/schemas/UserResponse' }, jti: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' }, used: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }}},
      RefreshTokenCreatePayload: { type: 'object', required: ['user', 'jti', 'token', 'expiresAt'], properties: { user: { type: 'string', example: '60d21b4667d0d8992e610c85' }, jti: { type: 'string' }, token: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' }, used: { type: 'boolean' } } },
      // UserResponse is missing, let's add it
      UserResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] },
          isVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        }
      }

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
>>>>>>> Stashed changes
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API PRODUCT MANAGEMENT',
            version: '1.0.0',
            description: 'Tài liệu API quản lý sản phẩm',
        },
        servers: [
            {
                url: 'http://localhost:3000',
            },
        ],
        // Dùng để thêm nút "Authorize" cho JWT
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        schemas: {
            // --- Input DTOs ---
            ProductInput: { // Input DTO cho Product CREATE/UPDATE
                type: 'object',
                required: ['name', 'slug', 'quantity', 'price'],
                properties: {
                    name: { type: 'string', minLength: 3, maxLength: 100, example: "Laptop Pro" },
                    slug: { type: 'string', pattern: '^[a-z0-9-]+$', example: "laptop-pro" },
                    quantity: { type: 'number', minimum: 0, example: 50 },
                    price: { type: 'number', minimum: 0, example: 1200 },
                    description: { type: 'string', maxLength: 500, example: "A powerful laptop for professionals." }
                }
            },
            UserRegisterInput: { // Input DTO for Register
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                    username: { type: 'string', minLength: 3, maxLength: 50, example: "johndoe" },
                    email: { type: 'string', format: 'email', example: "john.doe@example.com" },
                    password: { type: 'string', format: 'password', minLength: 6, example: "aSecurePassword123" }
                }
            },
            LoginInput: { // Input DTO for Login
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email', example: "john.doe@example.com" },
                    password: { type: 'string', format: 'password', minLength: 6, example: "aSecurePassword123" }
                }
            },
            SendOtpInput: { // Input DTO for Send OTP
                type: 'object',
                required: ['email'],
                properties: {
                    email: { type: 'string', format: 'email', example: "john.doe@example.com" }
                }
            },
            VerifyOtpInput: { // Input DTO for Verify OTP
                type: 'object',
                required: ['email', 'otp'],
                properties: {
                    email: { type: 'string', format: 'email', example: "john.doe@example.com" },
                    otp: { type: 'string', length: 6, pattern: '^[0-9]{6}$', example: "123456" }
                }
            },
            UpdateUserInput: { // Input DTO for Update User
                type: 'object',
                required: ['username'],
                properties: {
                    username: { type: 'string', minLength: 3, maxLength: 50, example: "john_doe_updated" }
                }
            },

            // --- Output DTOs ---
            UserResponse: { // Output DTO for User
                type: 'object',
                properties: {
                    _id: { type: 'string', example: "60d0fe4f5311236168a109ca" },
                    username: { type: 'string', example: "johndoe" },
                    email: { type: 'string', format: 'email', example: "john.doe@example.com" },
                    verify: { type: 'boolean', example: true },
                    role: { type: 'string', enum: ['user', 'admin'], example: "admin" }
                }
            },
            Product: { // Output DTO for Product
                type: 'object',
                properties: {
                    _id: { type: 'string', example: "60d0fe4f5311236168a109ca" },
                    name: { type: 'string', example: "Laptop Pro" },
                    slug: { type: 'string', example: "laptop-pro" },
                    quantity: { type: 'number', example: 50 },
                    price: { type: 'number', example: 1200 },
                    description: { type: 'string', example: "A powerful laptop for professionals." },
                    createdAt: { type: 'string', format: 'date-time', example: "2023-10-27T10:00:00.000Z" },
                    updatedAt: { type: 'string', format: 'date-time', example: "2023-10-27T10:00:00.000Z" }
                }
            },
            Error: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                }
            }
        },
        security: [{
            bearerAuth: []
        }]
    },
    // Chỗ này quan trọng: trỏ đến các file chứa route của bạn
    apis: ['./routes/*.js'], // Ví dụ: './src/routes/**/*.js'
};

const swaggerSpec = swaggerJSDoc(options);

function setupSwaggerDocs(app) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        swaggerOptions: {
            defaultModelsExpandDepth: -1,
            defaultModelRendering: "example",
            tryItOutEnabled: true // bật mặc định
        }
    }));
    console.log(`Swagger docs available at http://localhost:3000/api-docs`); // Thay port
}

module.exports = setupSwaggerDocs;