# DogDex AI - Setup Guide / Hướng dẫn cài đặt

## English Version

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (version 18.0 or higher)
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`

- **npm** or **yarn** (package manager)
  - npm comes with Node.js
  - Verify installation: `npm --version`

- **Git** (optional, for cloning the repository)
  - Download from: https://git-scm.com/

### Step 1: Download the Project

**Option A: Download ZIP**
1. Download the project ZIP file
2. Extract it to your desired location
3. Open terminal/command prompt in the extracted folder

**Option B: Clone from Git**
\`\`\`bash
git clone <repository-url>
cd dogpokedex3
\`\`\`

### Step 2: Install Dependencies

Open terminal in the project directory and run:

\`\`\`bash
npm install
\`\`\`

This will install all required packages including:
- Next.js 15
- React 19
- next-themes (for dark/light mode)
- Tailwind CSS
- shadcn/ui components
- And other dependencies

### Step 3: Configure Environment Variables

1. Copy the example environment file:
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

2. Open `.env.local` and configure:
\`\`\`env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
\`\`\`

**Important:** Replace `http://localhost:3000` with your actual backend API URL.

### Step 4: Run the Development Server

Start the development server:

\`\`\`bash
npm run dev
\`\`\`

The application will be available at: **http://localhost:3000**

### Step 5: Build for Production (Optional)

To create an optimized production build:

\`\`\`bash
npm run build
npm start
\`\`\`

### Features

- **AI Dog Breed Detection**: Upload images or videos to identify dog breeds
- **Multi-language Support**: Switch between English and Vietnamese
- **Dark/Light Mode**: Toggle between themes with persistent preference
- **User Authentication**: Register and login to save your collection
- **Pokedex**: Track discovered dog breeds
- **Achievements**: Unlock achievements as you explore
- **Live Detection**: Real-time breed detection via webcam

### Troubleshooting

**Port already in use:**
\`\`\`bash
# Use a different port
npm run dev -- -p 3001
\`\`\`

**Dependencies installation fails:**
\`\`\`bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
\`\`\`

**API connection issues:**
- Verify the `NEXT_PUBLIC_API_URL` in `.env.local`
- Ensure the backend server is running
- Check CORS settings on the backend

**Theme not persisting:**
- The theme preference is stored in localStorage
- Clear browser cache if experiencing issues

**Language not switching:**
- Language preference is stored in cookies
- Ensure cookies are enabled in your browser

---

## Phiên bản Tiếng Việt

### Yêu cầu hệ thống

Trước khi bắt đầu, đảm bảo bạn đã cài đặt:

- **Node.js** (phiên bản 18.0 trở lên)
  - Tải tại: https://nodejs.org/
  - Kiểm tra: `node --version`

- **npm** hoặc **yarn** (trình quản lý gói)
  - npm đi kèm với Node.js
  - Kiểm tra: `npm --version`

- **Git** (tùy chọn, để clone repository)
  - Tải tại: https://git-scm.com/

### Bước 1: Tải dự án

**Cách A: Tải file ZIP**
1. Tải file ZIP của dự án
2. Giải nén vào thư mục mong muốn
3. Mở terminal/command prompt trong thư mục đã giải nén

**Cách B: Clone từ Git**
\`\`\`bash
git clone <repository-url>
cd dogpokedex3
\`\`\`

### Bước 2: Cài đặt các gói phụ thuộc

Mở terminal trong thư mục dự án và chạy:

\`\`\`bash
npm install
\`\`\`

Lệnh này sẽ cài đặt tất cả các gói cần thiết bao gồm:
- Next.js 15
- React 19
- next-themes (chế độ sáng/tối)
- Tailwind CSS
- Các component shadcn/ui
- Và các thư viện khác

### Bước 3: Cấu hình biến môi trường

1. Sao chép file môi trường mẫu:
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

2. Mở file `.env.local` và cấu hình:
\`\`\`env
# Cấu hình API
NEXT_PUBLIC_API_URL=http://localhost:3000
\`\`\`

**Quan trọng:** Thay `http://localhost:3000` bằng URL API backend thực tế của bạn.

### Bước 4: Chạy server phát triển

Khởi động server phát triển:

\`\`\`bash
npm run dev
\`\`\`

Ứng dụng sẽ chạy tại: **http://localhost:3000**

### Bước 5: Build cho production (Tùy chọn)

Để tạo bản build tối ưu cho production:

\`\`\`bash
npm run build
npm start
\`\`\`

### Tính năng

- **Nhận diện giống chó bằng AI**: Upload ảnh hoặc video để nhận diện giống chó
- **Đa ngôn ngữ**: Chuyển đổi giữa Tiếng Anh và Tiếng Việt
- **Chế độ Sáng/Tối**: Chuyển đổi giao diện với lưu trữ tùy chọn
- **Xác thực người dùng**: Đăng ký và đăng nhập để lưu bộ sưu tập
- **Pokedex**: Theo dõi các giống chó đã khám phá
- **Thành tích**: Mở khóa thành tích khi khám phá
- **Nhận diện trực tiếp**: Nhận diện giống chó qua webcam

### Xử lý sự cố

**Port đã được sử dụng:**
\`\`\`bash
# Sử dụng port khác
npm run dev -- -p 3001
\`\`\`

**Cài đặt thư viện thất bại:**
\`\`\`bash
# Xóa cache và cài lại
rm -rf node_modules package-lock.json
npm install
\`\`\`

**Lỗi kết nối API:**
- Kiểm tra `NEXT_PUBLIC_API_URL` trong `.env.local`
- Đảm bảo backend server đang chạy
- Kiểm tra cài đặt CORS trên backend

**Giao diện không lưu chế độ sáng/tối:**
- Tùy chọn giao diện được lưu trong localStorage
- Xóa cache trình duyệt nếu gặp vấn đề

**Không chuyển được ngôn ngữ:**
- Tùy chọn ngôn ngữ được lưu trong cookies
- Đảm bảo cookies được bật trong trình duyệt

### Cấu trúc thư mục

\`\`\`
dogpokedex3/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Trang chủ
│   ├── results/           # Trang kết quả nhận diện
│   ├── pokedex/           # Trang bộ sưu tập
│   ├── achievements/      # Trang thành tích
│   ├── profile/           # Trang hồ sơ
│   └── admin/             # Trang quản trị
├── components/             # React components
│   ├── ui/                # shadcn/ui components
│   ├── navbar.tsx         # Thanh điều hướng
│   ├── theme-toggle.tsx   # Nút chuyển giao diện
│   └── language-toggle.tsx # Nút chuyển ngôn ngữ
├── lib/                   # Utilities và contexts
│   ├── api-client.ts      # Tích hợp API
│   ├── auth-context.tsx   # Xác thực
│   ├── i18n-context.tsx   # Đa ngôn ngữ
│   └── types.ts           # TypeScript types
├── i18n/                  # File dịch
│   └── messages/
│       ├── en.ts          # Bản dịch Tiếng Anh
│       └── vi.ts          # Bản dịch Tiếng Việt
├── public/                # Tài nguyên tĩnh
└── .env.local            # Biến môi trường
\`\`\`

### Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra phần Troubleshooting/Xử lý sự cố ở trên
2. Xem file `API_INTEGRATION.md` để biết chi tiết về API
3. Liên hệ team phát triển

---

## API Integration

See `API_INTEGRATION.md` for detailed API documentation and integration guide.

## Development Notes

### Theme System
- Uses `next-themes` for theme management
- Supports light, dark, and system themes
- Theme preference persists across sessions

### Internationalization
- Custom i18n implementation using React Context
- Supports English (en) and Vietnamese (vi)
- Language preference stored in cookies
- Translation files located in `i18n/messages/`

### Authentication
- JWT-based authentication
- Tokens stored in localStorage
- Automatic token refresh on 401 errors
- Protected routes with authentication guards

## License

[Your License Here]
