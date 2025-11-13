# Khóa Luận Tốt Nghiệp: Tìm hiểu thuật toán Object Detection và xây dựng ứng dụng xác định giống chó (DogDex AI)

Dự án này là một ứng dụng web full-stack sử dụng Trí tuệ nhân tạo để nhận dạng giống chó từ hình ảnh, video và camera trực tiếp. Người dùng có thể khám phá thông tin chi tiết về các giống chó, thu thập chúng vào "DogDex" cá nhân và tương tác với hệ thống thông qua nhiều tính năng đa dạng.

**Bản demo trực tiếp:** 

---

## MỤC LỤC

1.  Thông tin đề tài
2.  Mục tiêu đề tài
3.  Tổng quan và Phân tích Yêu cầu
    *   Yêu cầu chức năng
    *   Yêu cầu phi chức năng
4.  Phân tích và Thiết kế Hệ thống
    *   Kiến trúc hệ thống
    *   Luồng xử lý dữ liệu (Data Pipeline)
    *   Công nghệ sử dụng
5.  Cài đặt và Triển khai
    *   Cấu trúc thư mục
    *   Hướng dẫn cài đặt
6.  Các chức năng chính đã cài đặt
7.  Đánh giá và Hướng phát triển

---

## 1. Thông tin đề tài

*   **Mã đề tài:** KLCN\_TH030
*   **Tên đề tài:** Tìm hiểu thuật toán Object Detection và xây dựng ứng dụng xác định giống chó nuôi.
*   **Định hướng:** Ứng dụng tích hợp.
*   **Giảng viên hướng dẫn:** ThS. Trần Đình Toàn
*   **Nhóm sinh viên thực hiện:**
    *   Lương Liêm Phong - MSSV: 2001223664
    *   Văn Trọng Dương - MSSV: 2001220817
    *   Trần Khánh Vũ - MSSV: 2001225914

## 2. Mục tiêu đề tài

1.  **Nghiên cứu lý thuyết:** Tìm hiểu sâu về mạng Nơ-ron tích chập (CNN) và các thuật toán Object Detection hiện đại như YOLO.
2.  **Thu thập và xử lý dữ liệu:** Xây dựng quy trình thu thập, gán nhãn và tiền xử lý dữ liệu hình ảnh các giống chó để huấn luyện mô hình.
3.  **Xây dựng và đánh giá mô hình:** Huấn luyện mô hình YOLO với bộ dữ liệu đã thu thập, thực hiện tinh chỉnh và đánh giá hiệu năng của mô hình thông qua các chỉ số như mAP, F1-score.
4.  **Xây dựng ứng dụng Web:** Phát triển một ứng dụng web hoàn chỉnh cho phép người dùng tương tác với mô hình AI, cung cấp giao diện thân thiện và trải nghiệm người dùng tốt.
5.  **Tích hợp các tính năng nâng cao:** Tích hợp các dịch vụ AI khác (Google Gemini) để làm giàu thông tin, xây dựng các tính năng cộng đồng (DogDex, thành tích) và quản trị hệ thống.

## 3. Tổng quan và Phân tích Yêu cầu

### Yêu cầu chức năng

#### Người dùng (User)

*   **Nhận dạng giống chó:**
    *   Tải lên ảnh/video (đơn hoặc hàng loạt) để nhận dạng.
    *   Sử dụng camera của thiết bị để nhận dạng thời gian thực.
*   **Xem kết quả & Thông tin chi tiết:**
    *   Hiển thị các giống chó được phát hiện cùng độ tin cậy.
    *   Xem thông tin chi tiết (mô tả, tính cách, sức khỏe, nguồn gốc...) về giống chó được nhận dạng.
*   **Tương tác với AI (Gemini):**
    *   Chat với AI để hỏi đáp các thông tin liên quan đến một giống chó cụ thể.
    *   Nhận các khuyến nghị về sức khỏe, sản phẩm phù hợp.
*   **Bộ sưu tập (DogDex):**
    *   Tự động lưu các giống chó mới nhận dạng vào bộ sưu tập cá nhân.
    *   Xem danh sách các giống chó đã sưu tầm và chưa sưu tầm, kèm thông tin ngày sưu tầm và nguồn (ảnh, video, camera).
    *   Lọc và sắp xếp DogDex theo tên, độ hiếm, ngày sưu tầm.
*   **Tài khoản, Lịch sử & Thành tích:**
    *   Đăng ký, đăng nhập, quản lý thông tin cá nhân, đổi mật khẩu.
    *   Xem lại lịch sử các lần nhận dạng và xóa các kết quả không mong muốn.
    *   Mở khóa các thành tích dựa trên tiến trình sưu tầm và số lần nhận dạng.
*   **Phản hồi (Feedback):**
    *   Đánh giá kết quả nhận dạng (đúng/sai).
    *   Nếu sai, đề xuất giống chó đúng để giúp cải thiện mô hình.
*   **Gói cước và Thanh toán:**
    *   Xem các gói cước (plans) với các giới hạn khác nhau.
    *   Nâng cấp gói cước thông qua cổng thanh toán (MoMo).

#### Quản trị viên (Admin)

*   **Dashboard:**
    *   Xem thống kê tổng quan: tổng người dùng, số lượt dự đoán, độ chính xác từ feedback, lượt truy cập...
    *   Biểu đồ hoạt động hàng tuần và các giống chó được dự đoán nhiều nhất.
*   **Quản lý Người dùng:**
    *   Xem, tạo, sửa, xóa thông tin người dùng.
*   **Quản lý Phản hồi (Feedback):**
    *   Duyệt/từ chối các phản hồi từ người dùng.
    *   Xem ảnh gốc, kết quả AI, và đề xuất của người dùng.
    *   Hệ thống tự động di chuyển file vào thư mục `approved` hoặc `rejected` để phục vụ huấn luyện lại.
*   **Quản lý Media:**
    *   Duyệt hệ thống file media của người dùng và hệ thống theo cấu trúc thư mục ảo.
    *   Xem trước và xóa các file media không mong muốn.
*   **Quản lý Hệ thống:**
    *   **AI Models:** Tải lên các phiên bản model mới, xem danh sách và kích hoạt model sẽ được sử dụng cho việc nhận dạng.
    *   **Plans & Subscriptions:** Quản lý các gói cước và các lượt đăng ký của người dùng.
    *   **Wiki:** Quản lý cơ sở dữ liệu tri thức về các giống chó.
    *   **Transactions & Subscriptions:** Xem lịch sử giao dịch và quản lý các gói đăng ký của người dùng.
    *   **Reports:** Tạo và xuất báo cáo thống kê theo khoảng thời gian tùy chọn (Excel, Word).
    *   **Usage Tracking:** Theo dõi việc sử dụng tài nguyên (token, dung lượng) của từng người dùng.

### Yêu cầu phi chức năng

*   **Hiệu suất:** Thời gian nhận dạng nhanh, tải trang mượt mà, sử dụng cache (Redis) để tăng tốc độ truy vấn và quản lý phiên chat.
*   **Bảo mật:** Xác thực JWT (Access & Refresh Token), phân quyền, mã hóa mật khẩu.
*   **Khả năng mở rộng:** Kiến trúc module hóa, dễ dàng thêm hoặc thay thế các thành phần (mô hình AI, cổng thanh toán).
*   **Tính khả dụng:** Giao diện responsive, hỗ trợ đa ngôn ngữ (Tiếng Việt, Tiếng Anh).

## 4. Phân tích và Thiết kế Hệ thống

### Kiến trúc hệ thống

Dự án được xây dựng theo kiến trúc **Monorepo**, kết hợp giữa mô hình **Backend-for-Frontend (BFF)** và **Microservice** cho tác vụ AI.

```mermaid
graph TD
    subgraph "Người dùng"
        A[Trình duyệt Web / Mobile]
    end
    
    subgraph "Hệ thống DogDex AI"
        A -- HTTPS Request --> B[Frontend - Next.js]
        B -- API Call --> C[Backend (BFF) - Node.js/Express]
        C -- Model Inference --> D[AI Service - Python/PyTorch]
        C -- Database Query --> E[Cơ sở dữ liệu - MongoDB]
        C -- Caching --> F[Cache - Redis]
        C -- Generative AI --> G[Google Gemini API];
        D -- Load Model --> H[Hugging Face Hub];
    end
    
    B -.-> A
    C -.-> B
    D -.-> C
    E -.-> C
    F -.-> C
    G -.-> C
    H -.-> D
```

*   **Frontend (Next.js):** Xây dựng giao diện người dùng, quản lý trạng thái phía client.
*   **Backend (BFF - Node.js/Express):** Xử lý logic nghiệp vụ, xác thực, và tổng hợp dữ liệu từ nhiều nguồn.
*   **AI Service (Python/PyTorch):** Chứa mô hình Object Detection (YOLO), cung cấp API để nhận dạng.
*   **MongoDB:** Lưu trữ toàn bộ dữ liệu của ứng dụng.
*   **Redis:** Dùng để cache và quản lý lịch sử phiên chat với Gemini AI.
*   **Google Gemini API:** Cung cấp khả năng hỏi-đáp thông minh.
*   **Hugging Face Hub:** Lưu trữ các phiên bản của mô hình AI, giúp việc quản lý và triển khai linh hoạt.

### Luồng xử lý dữ liệu (Data Pipeline)

#### 1. Luồng nhận dạng

1.  **Upload (Frontend):** Người dùng tải lên tệp media (ảnh/video).
2.  **API Request (Frontend -> Backend):** Frontend gửi yêu cầu đến Backend BFF.
3.  **Lưu trữ (Backend):** Backend lưu tệp vào thư mục `public/uploads` và tạo bản ghi `Media` trong MongoDB.
4.  **Gọi AI Service (Backend -> AI Service):** Backend gửi đường dẫn tệp đến AI Service.
5.  **Nhận dạng (AI Service):** AI Service tải model đang `ACTIVE` từ Hugging Face, thực hiện nhận dạng và trả về kết quả.
6.  **Xử lý kết quả (Backend):** Lưu kết quả vào `PredictionHistory`, cập nhật `UserCollection` (DogDex) và thành tích.
7.  **Hiển thị (Frontend):** Giao diện hiển thị kết quả cho người dùng.

#### 2. Luồng phản hồi (Feedback)

1.  **Submit (Frontend):** Người dùng gửi phản hồi (đúng/sai) cho một kết quả.
2.  **Xử lý (Backend):**
    *   Tạo bản ghi `Feedback` với trạng thái `pending_review`.
    *   **Di chuyển file:** File media gốc được di chuyển từ thư mục `uploads` vào thư mục `dataset/pending`.
3.  **Admin duyệt (Admin Panel):**
    *   Admin xem feedback và quyết định `Duyệt` (Approve) hoặc `Từ chối` (Reject).
    *   **Nếu Duyệt:** File được di chuyển từ `dataset/pending` vào `dataset/approved/{breed_name}`.
    *   **Nếu Từ chối:** File được di chuyển từ `dataset/pending` vào `dataset/rejected`.
4.  **Huấn luyện lại:** Thư mục `dataset/approved` chứa dữ liệu đã được xác thực, sẵn sàng cho việc huấn luyện lại mô hình.

### Công nghệ sử dụng

| Hạng mục      | Công nghệ                                                                                             |
| :------------- | :---------------------------------------------------------------------------------------------------- |
| **Frontend**   | Next.js, React, TypeScript, Tailwind CSS, Shadcn/ui, Zustand, i18next |
| **Backend**    | Node.js, Express.js, TypeScript, Mongoose, Zod |
| **AI/ML**      | Python, PyTorch, YOLO, Google Generative AI (Gemini) |
| **Database**   | MongoDB                                                                   |
| **Cache**      | Redis                                                                            |
| **Deployment** | Vercel (Frontend), Docker (Backend & AI Service)      |
| **CI/CD**      | GitHub Actions                                                 |
| **File Storage** | Local Storage, Hugging Face Hub (for models) |

## 5. Cài đặt và Triển khai

### Cấu trúc thư mục

Dự án được tổ chức theo cấu trúc monorepo:

```
/
├── backend/         # Backend BFF (Node.js/Express)
├── frontend/        # Frontend (Next.js)
├── ai_service/      # AI Service (Python)
├── .env.example     # File môi trường mẫu
├── package.json     # Quản lý chung cho monorepo
└── README.md
```

### Hướng dẫn cài đặt

**Yêu cầu:**

*   Node.js (v18 trở lên)
*   npm hoặc yarn
*   MongoDB
*   Redis
*   Python (v3.9 trở lên)

**Các bước cài đặt:**

1.  **Clone repository:**
    ```bash
    git clone https://your-repository-url.git
    cd your-project-folder
    ```

2.  **Cài đặt biến môi trường:**
    Tạo file `.env` ở thư mục gốc và sao chép nội dung từ `.env.example`. Điền các giá trị cần thiết (chuỗi kết nối DB, API keys...).

3.  **Cài đặt Backend:**
    ```bash
    cd backend
    npm install
    npm run dev
    ```
    Server backend sẽ chạy tại `http://localhost:8080`.

4.  **Cài đặt Frontend:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    Ứng dụng frontend sẽ chạy tại `http://localhost:3000`.

5.  **Cài đặt AI Service:**
    ```bash
    cd ai_service
    pip install -r requirements.txt
    python app.py
    ```
    Service AI sẽ chạy tại một cổng khác, ví dụ `http://localhost:5000`.

## 6. Các chức năng chính đã cài đặt

Dựa trên mã nguồn, các chức năng sau đã được cài đặt và hoạt động, đáp ứng đầy đủ các yêu cầu của đề tài:

*   **Chức năng 01: Nhận dạng qua ảnh/video và lưu trữ**
    *   Người dùng có thể tải lên ảnh hoặc video.
    *   Hệ thống nhận dạng và trả về kết quả.
    *   Nếu đăng nhập, kết quả sẽ tự động được lưu vào lịch sử và bộ sưu tập (DogDex).
    *   *File: `frontend/app/(main)/page.tsx`, `backend/src/controllers/prediction.controller.ts`*

*   **Chức năng 02: Nhận dạng thời gian thực qua camera**
    *   Người dùng có thể bật camera trên trang "Live".
    *   Hệ thống liên tục phân tích luồng video và hiển thị kết quả nhận dạng trực tiếp trên màn hình.
    *   *File: `frontend/app/(main)/live/page.tsx`*

*   **Chức năng 03: Cung cấp thông tin chi tiết và khuyến nghị**
    *   **Thông tin giống chó:** Sau khi nhận dạng, ứng dụng hiển thị thông tin chi tiết về giống chó từ cơ sở dữ liệu Wiki (`dogbreedwikis`).
    *   **Hỏi đáp với AI:** Người dùng có thể chat với Gemini để hỏi thêm thông tin. Phiên chat được lưu vào Redis để duy trì ngữ cảnh.
        *   *File: `frontend/components/results/ChatWithAI.tsx`, `backend/src/services/geminiAI.service.ts`*
    *   **Khuyến nghị:** Hệ thống có thể đưa ra các khuyến nghị về sức khỏe, sản phẩm phù hợp dựa trên thông tin giống chó (sử dụng Gemini).
        *   *File: `backend/src/services/geminiAI.service.ts`*

## 7. Đánh giá và Hướng phát triển

### Đánh giá

*   **Mô hình:** Mô hình YOLO được lựa chọn cho thấy hiệu quả tốt trong việc phát hiện đối tượng trong thời gian thực, phù hợp với yêu cầu của ứng dụng.
*   **Hệ thống:** Kiến trúc BFF và microservice giúp hệ thống linh hoạt, dễ bảo trì và mở rộng. Việc tách biệt logic AI và logic nghiệp vụ giúp tối ưu hóa tài nguyên.
*   **Trải nghiệm người dùng:** Giao diện hiện đại, thân thiện, cung cấp nhiều tính năng hấp dẫn (DogDex, thành tích) giúp tăng tương tác và giữ chân người dùng.

### Hướng phát triển

*   **Cải thiện mô hình AI:**
    *   Sử dụng dữ liệu từ `dataset/approved` để huấn luyện lại (retrain) mô hình, tăng độ chính xác và mở rộng số lượng giống chó.
    *   Thử nghiệm các kiến trúc YOLO mới hơn (ví dụ: YOLOv8, YOLOv9).
*   **Mở rộng tính năng:**
    *   Phát triển ứng dụng di động (Mobile App) để cải thiện trải nghiệm trên điện thoại.
    *   Xây dựng các tính năng cộng đồng: chia sẻ kết quả, so sánh bộ sưu tập với bạn bè.
*   **Tối ưu hóa hệ thống:**
    *   Triển khai hệ thống trên một cơ sở hạ tầng mạnh mẽ hơn (ví dụ: AWS, GCP) với GPU để tăng tốc độ nhận dạng.
    *   Tối ưu hóa quy trình CI/CD để tự động hóa hoàn toàn việc kiểm thử và triển khai.
