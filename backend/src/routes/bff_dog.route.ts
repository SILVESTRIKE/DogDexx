import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { createDogSchema, updateDogSchema, createHealthRecordSchema, updateHealthRecordSchema, contactOwnerSchema } from "../utils/validation";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.middleware";
import {
    createDog,
    getMyDogs,
    getDog,
    updateDog,
    deleteDog,
    addHealthRecord,
    updateHealthRecord,
    deleteHealthRecord,
    getHealthRecords,
    searchLostDogs,
    reportLost,
    analyzeForCreation,
    getPublicDogInfo,
    contactOwner,
    reportFoundWithVerification,
} from "../controllers/dog.controller";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: BFF-Dog
 *   description: API quản lý hồ sơ chó và sức khỏe
 */

/**
 * @swagger
 * /bff/dog:
 *   post:
 *     summary: Tạo hồ sơ chó mới
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - breed
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên của chó
 *               breed:
 *                 type: string
 *                 description: Giống chó
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *               weight:
 *                 type: number
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Tạo hồ sơ chó thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 */
router.post("/", authMiddleware, uploadSingle, validate(createDogSchema, "body"), createDog);

/**
 * @swagger
 * /bff/dog/analyze:
 *   post:
 *     summary: Phân tích ảnh chó trước khi tạo hồ sơ
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Kết quả phân tích giống chó
 *       401:
 *         description: Chưa đăng nhập
 */
router.post("/analyze", authMiddleware, uploadSingle, analyzeForCreation);

/**
 * @swagger
 * /bff/dog/public/{id}:
 *   get:
 *     summary: Lấy thông tin công khai của chó (qua QR code)
 *     tags: [BFF-Dog]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của chó
 *     responses:
 *       200:
 *         description: Thông tin công khai của chó
 *       404:
 *         description: Không tìm thấy chó
 */
router.get("/public/:id", getPublicDogInfo);

/**
 * @swagger
 * /bff/dog/public/contact-owner:
 *   post:
 *     summary: Gửi thông tin liên hệ đến chủ sở hữu chó
 *     tags: [BFF-Dog]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dogId
 *               - finderName
 *               - finderPhone
 *             properties:
 *               dogId:
 *                 type: string
 *               finderName:
 *                 type: string
 *               finderPhone:
 *                 type: string
 *               finderEmail:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đã gửi thông tin liên hệ thành công
 *       404:
 *         description: Không tìm thấy chó
 */
router.post("/public/contact-owner", validate(contactOwnerSchema, "body"), contactOwner);

/**
 * @swagger
 * /bff/dog/my-dogs:
 *   get:
 *     summary: Lấy danh sách chó của người dùng hiện tại
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách chó
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/my-dogs", authMiddleware, getMyDogs);

/**
 * @swagger
 * /bff/dog/{id}/report-lost:
 *   post:
 *     summary: Báo mất chó
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của chó
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lastSeenLocation:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *                   address:
 *                     type: string
 *               contactPhone:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đã báo mất thành công
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy chó
 */
router.post("/:id/report-lost", authMiddleware, reportLost);

/**
 * @swagger
 * /bff/dog/report-found-verified:
 *   post:
 *     summary: Báo tìm thấy chó với xác minh AI
 *     tags: [BFF-Dog]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - dogId
 *               - image
 *               - finderName
 *               - finderPhone
 *             properties:
 *               dogId:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               finderName:
 *                 type: string
 *               finderPhone:
 *                 type: string
 *               finderEmail:
 *                 type: string
 *               location:
 *                 type: string
 *                 description: JSON string của location object
 *     responses:
 *       200:
 *         description: Kết quả xác minh và thông báo cho chủ sở hữu
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.post('/report-found-verified', uploadSingle, reportFoundWithVerification);

/**
 * @swagger
 * /bff/dog/search/lost:
 *   get:
 *     summary: Tìm kiếm chó bị mất theo khu vực
 *     tags: [BFF-Dog]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Vĩ độ
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Kinh độ
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Bán kính tìm kiếm (km)
 *       - in: query
 *         name: breed
 *         schema:
 *           type: string
 *         description: Lọc theo giống chó
 *     responses:
 *       200:
 *         description: Danh sách chó bị mất trong khu vực
 */
router.get("/search/lost", searchLostDogs);

/**
 * @swagger
 * /bff/dog/{id}:
 *   get:
 *     summary: Lấy chi tiết hồ sơ chó
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết hồ sơ chó
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy chó
 */
router.get("/:id", authMiddleware, getDog);

/**
 * @swagger
 * /bff/dog/{id}:
 *   put:
 *     summary: Cập nhật hồ sơ chó
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               breed:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *               weight:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy chó
 */
router.put("/:id", authMiddleware, validate(updateDogSchema, "body"), updateDog);

/**
 * @swagger
 * /bff/dog/{id}:
 *   delete:
 *     summary: Xóa hồ sơ chó
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy chó
 */
router.delete("/:id", authMiddleware, deleteDog);

/**
 * @swagger
 * /bff/dog/{dogId}/health:
 *   post:
 *     summary: Thêm hồ sơ sức khỏe cho chó
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dogId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - date
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [vaccination, checkup, surgery, medication, other]
 *               date:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *               veterinarian:
 *                 type: string
 *               notes:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Thêm hồ sơ sức khỏe thành công
 *       401:
 *         description: Chưa đăng nhập
 */
router.post("/:dogId/health", authMiddleware, uploadMultiple, validate(createHealthRecordSchema, "body"), addHealthRecord);

/**
 * @swagger
 * /bff/dog/health/{recordId}:
 *   put:
 *     summary: Cập nhật hồ sơ sức khỏe
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *               veterinarian:
 *                 type: string
 *               notes:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy hồ sơ
 */
router.put("/health/:recordId", authMiddleware, uploadMultiple, validate(updateHealthRecordSchema, "body"), updateHealthRecord);

/**
 * @swagger
 * /bff/dog/health/{recordId}:
 *   delete:
 *     summary: Xóa hồ sơ sức khỏe
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy hồ sơ
 */
router.delete("/health/:recordId", authMiddleware, deleteHealthRecord);

/**
 * @swagger
 * /bff/dog/{dogId}/health:
 *   get:
 *     summary: Lấy danh sách hồ sơ sức khỏe của chó
 *     tags: [BFF-Dog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách hồ sơ sức khỏe
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/:dogId/health", authMiddleware, getHealthRecords);

export default router;
