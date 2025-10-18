// BFF Admin Controller
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../services/config.service';
import { AIModelService } from '../services/ai_models.service';
import { AdminService } from '../services/admin.service';
import { feedbackService } from '../services/feedback.service';
import { userService } from '../services/user.service';
import { CreateAIModelSchema } from '../types/zod/ai_model.zod';
import { AppError } from '../errors';

const configService = new ConfigService();
const adminService = new AdminService();

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  const dashboardData = await adminService.getDashboardData();
  res.status(200).json(dashboardData);
};

export const getFeedback = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 10, status, search } = req.query as any;
  const pagination = { page: Number(page), limit: Number(limit) };
  const filters = { status, search };
  const feedbackData = await feedbackService.getAdminFeedbackPageData(filters, pagination);
  res.status(200).json(feedbackData);
};

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  const usersData = await adminService.getEnrichedUsers({
    page: parseInt(req.query.page as string, 10) || 1,
    limit: parseInt(req.query.limit as string, 10) || 10,
    search: req.query.search as string | undefined,
  });
  res.status(200).json(usersData);
};

/**
 * @desc (Admin) Tạo người dùng mới
 * @route POST /bff/admin/users
 * @access Private (Admin)
 */
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password, role, verify } = req.body;
  // Ánh xạ 'verify' từ frontend ('active'/'pending') sang 'isVerified' (true/false) cho service
  const verifyStatus = verify === 'active';

  const newUser = await userService.createUserByAdmin({ username, email, password, role, verify: verifyStatus });

  res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser,
  });
};

/**
 * @desc (Admin) Cập nhật thông tin người dùng
 * @route PUT /bff/admin/users/:id
 * @access Private (Admin)
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { username, email, role, status } = req.body;
  // Ánh xạ 'status' từ frontend ('active'/'pending') sang 'isVerified' (true/false) cho service
  const updateData: any = { username, email, role };
  if (status !== undefined) {
      updateData.verify = status === 'active';
  }

  const updatedUser = await userService.updateUserById(id, updateData);

  res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
  });
};
export const getModelConfig = async (req: Request, res: Response, next: NextFunction) => {
  const config = await configService.getAiConfig();
  res.status(200).json({
    message: 'Lấy cấu hình model thành công.',
    data: config,
  });
};

export const updateModelConfig = async (req: Request, res: Response, next: NextFunction) => {
  const { modelId, ...otherConfigData } = req.body;

  try {
    const promises = [];

    // 1. Nếu có modelId được gửi lên, kích hoạt model đó.
    if (modelId) {
      console.log(`[BFF-Admin] Activating new model: ${modelId}`);
      promises.push(AIModelService.activateModel(modelId));
    }

    // 2. Nếu có các dữ liệu cấu hình khác (device, thresholds), cập nhật chúng.
    if (Object.keys(otherConfigData).length > 0) {
      console.log(`[BFF-Admin] Updating config:`, otherConfigData);
      promises.push(configService.updateAiConfig(otherConfigData));
    }

    // Thực hiện các cập nhật song song
    await Promise.all(promises);

    // 3. Sau khi tất cả cập nhật DB hoàn tất, yêu cầu AI service tải lại cấu hình.
    console.log(`[BFF-Admin] Triggering AI service reload...`);
    const reloadResult = await configService.reloadAiService();

    res.status(200).json({
      message: 'AI configuration updated and reload triggered successfully.',
      details: reloadResult.details,
    });
  } catch (error: any) {
    console.error('[BFF-Admin] Failed to update model config:', error);
    res.status(500).json({ message: 'Failed to update configuration', error: error.message });
  }
};

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  const alerts = await adminService.getSystemAlerts();
  res.status(200).json({ alerts });
};

/**
 * @desc (Admin) Upload a new AI model file and create its record via BFF.
 * @route POST /bff/admin/models/upload
 * @access Private (Admin)
 */
export const uploadModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Dữ liệu file được multer xử lý và đưa vào req.files
    const files = req.files;

    // Kiểm tra chặt chẽ để TypeScript có thể suy luận kiểu
    if (!files || typeof files !== 'object' || !('modelFile' in files) || !Array.isArray(files.modelFile)) {
      throw new AppError("Model file is required.");
    }

    // Dữ liệu metadata từ req.body
    const data = CreateAIModelSchema.parse(req.body);

    const newModel = await AIModelService.uploadAndCreateModel(
      files as { modelFile: Express.Multer.File[] },
      data,
      (req as any).user.id
    );
    res.status(201).json({ message: "Model uploaded and created successfully.", data: newModel });
  } catch (error) {
    next(error);
  }
};
