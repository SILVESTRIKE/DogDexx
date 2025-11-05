// import { Router } from "express";
// import { AIModelController } from "../controllers/ai_models.controller";
// import { checkAllowedRoles } from "../middlewares/role.middleware";

// const router = Router();

// /**
//  * @openapi
//  * /api/ai-models:
//  *   get:
//  *     tags: [AI-Models]
//  *     summary: (Admin) Lấy danh sách tất cả AI models
//  *     responses:
//  *       200: { description: "Success" }
//  *   post:
//  *     tags: [AI-Models]
//  *     summary: (Admin) Tạo một AI model mới
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/AIModelCreatePayload'
//  *     responses:
//  *       201: { description: "Created" }
//  */
// router.route("/api/ai-models/")
//   .get(checkAllowedRoles(['admin']), AIModelController.findAll)
//   .post(checkAllowedRoles(['admin']), AIModelController.create);

// /**
//  * @openapi
//  * /api/ai-models/{id}:
//  *   get:
//  *     tags: [AI-Models]
//  *     summary: (Admin) Lấy chi tiết một AI model
//  *   put:
//  *     tags: [AI-Models]
//  *     summary: (Admin) Cập nhật một AI model
//  */
// router.route("/api/ai-models/:id")
//   .get(checkAllowedRoles(['admin']), AIModelController.findById)
//   .put(checkAllowedRoles(['admin']), AIModelController.update);

// /**
//  * @openapi
//  * /api/ai-models/{id}/activate:
//  *   post:
//  *     tags: [AI-Models]
//  *     summary: (Admin) Kích hoạt một AI model cho tác vụ của nó
//  */
// router.post("/api/ai-models/:id/activate/?", checkAllowedRoles(['admin']), AIModelController.activate);

// export default router;