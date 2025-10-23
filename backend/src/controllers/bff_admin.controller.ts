// BFF Admin Controller
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../services/config.service';
import { AIModelService } from '../services/ai_models.service';
import { AdminService } from '../services/admin.service';
import { feedbackService } from '../services/feedback.service';
import { userService } from '../services/user.service';
import { CreateAIModelSchema } from '../types/zod/ai_model.zod';
import { AppError } from '../errors';
import { predictionHistoryService } from '../services/prediction_history.service';
import { PlanService } from '../services/plan.service';
import { transformMediaURLs } from '../utils/media.util';

/**
 * Hàm transform để định dạng lại dữ liệu feedback cho admin.
 */
function transformFeedbackForAdmin(req: Request, feedbackDoc: any) {
  const prediction = feedbackDoc.prediction_id;
  const user = feedbackDoc.user_id;

  // Transform media URLs
  const transformedPrediction = prediction ? transformMediaURLs(req, prediction.toObject()) : null;

  return {
    id: feedbackDoc._id,
    predictionId: prediction?._id,
    feedbackTimestamp: feedbackDoc.createdAt,
    predictionTimestamp: prediction?.createdAt,
    user: user ? { name: user.username, email: user.email } : { name: 'Guest', email: null },
    feedbackContent: {
      // SỬA LỖI: is_correct không tồn tại trên FeedbackModel, nó nằm trên PredictionHistory.
      // isCorrect sẽ được xác định bằng sự tồn tại của feedback (luôn là false).
      isCorrect: feedbackDoc.is_correct,
      userSubmittedLabel: feedbackDoc.user_submitted_label,
      notes: feedbackDoc.notes,
    },
    aiPrediction: prediction?.predictions?.[0] 
      ? { class: prediction.predictions[0].class, confidence: prediction.predictions[0].confidence } 
      : null,
    originalMediaUrl: transformedPrediction?.mediaUrl,
    processedMediaUrl: transformedPrediction?.processedMediaUrl,
    status: feedbackDoc.status, // THÊM LẠI TRƯỜNG STATUS
  };
}

function transformHistoryForAdmin(req: Request, historyDoc: any) {
  const user = historyDoc.user;
  const transformedHistory = transformMediaURLs(req, historyDoc.toObject ? historyDoc.toObject() : historyDoc);

  return {
    id: transformedHistory.id,
    user: user ? { id: user._id, name: user.username, email: user.email } : { id: null, name: 'Guest', email: null },
    media: {
      type: transformedHistory.media.type,
      url: transformedHistory.media.mediaUrl, // URL của media gốc
      name: transformedHistory.media.name, // Giữ lại tên file gốc
    },
    processedMediaUrl: transformedHistory.processedMediaUrl,
    predictions: (transformedHistory.predictions || []).map((p: any) => ({
      class: p.class,
      confidence: p.confidence,
    })),
    createdAt: transformedHistory.createdAt,
    source: transformedHistory.source,
    feedback: transformedHistory.feedback ? { id: transformedHistory.feedback.toString() } : null,
  };
}

function transformMediaForAdmin(req: Request, mediaDoc: any) {
  const transformedMedia = transformMediaURLs(req, mediaDoc.toObject ? mediaDoc.toObject() : mediaDoc);
  return {
    id: transformedMedia._id,
    name: transformedMedia.mediaUrl.split('/').pop(),
    type: transformedMedia.type.startsWith('image') ? 'image' : 'video',
    url: transformedMedia.mediaUrl,
    size: transformedMedia.size,
    createdAt: transformedMedia.createdAt,
  };
}

const configService = new ConfigService();
const adminService = new AdminService();

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  const dashboardData = await adminService.getDashboardData();
  res.status(200).json(dashboardData);
};

export const getFeedback = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 10, status, search, startDate, endDate } = req.query as any;
  const pagination = { page: Number(page), limit: Number(limit) };
  const filters = { status, username: search, startDate, endDate };
  const feedbackData = await feedbackService.getAdminFeedbackPageData(filters, pagination);

  // Transform the feedbacks data before sending
  const transformedFeedbacks = feedbackData.feedbacks.data.map(fb => transformFeedbackForAdmin(req, fb));

  res.status(200).json({
    ...feedbackData,
    feedbacks: { ...feedbackData.feedbacks, data: transformedFeedbacks },
  });
};

export const approveFeedback = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updatedFeedback = await feedbackService.approveFeedback(id);
  res.status(200).json({ message: 'Feedback đã được duyệt thành công.', data: transformFeedbackForAdmin(req, updatedFeedback) });
};

export const rejectFeedback = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updatedFeedback = await feedbackService.rejectFeedback(id);
  res.status(200).json({ message: 'Feedback đã bị từ chối.', data: transformFeedbackForAdmin(req, updatedFeedback) });
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
 * @desc (Admin) Duyệt các file media đã tải lên theo cấu trúc thư mục ảo.
 * @route GET /bff/admin/media/browse
 * @access Private (Admin)
 */
export const browseMedia = async (req: Request, res: Response, next: NextFunction) => {
  const path = req.query.path as string || "";
  const result = await adminService.browseMedia(path);

  res.status(200).json({
    directories: result.directories,
    media: result.media.map(m => transformMediaForAdmin(req, m)),
  });
};

/**
 * @desc (Admin) Xóa một file media và các bản ghi liên quan.
 * @route DELETE /bff/admin/media/:id
 * @access Private (Admin)
 */
export const deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
  const result = await adminService.deleteMedia(req.params.id);
  res.status(200).json(result);
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

export const getUsageStats = async (req: Request, res: Response, next: NextFunction) => {
  const usageData = await adminService.getUsageStats();
  res.status(200).json(usageData);
};
export const getModelConfig = async (req: Request, res: Response, next: NextFunction) => {
  const config = await configService.getAiConfig();
  res.status(200).json({
    message: 'Lấy cấu hình model thành công.',
    data: config,
  });
};

export const getHistories = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 10, search } = req.query as any;
  const result = await predictionHistoryService.getAllHistory({
    page: Number(page),
    limit: Number(limit),
    search,
  });

  const transformedHistories = result.histories.map(h => transformHistoryForAdmin(req, h));

  res.status(200).json({
    data: transformedHistories,
    pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
  });
};

export const browseHistories = async (req: Request, res: Response, next: NextFunction) => {
  const path = req.query.path as string;
  const result = await adminService.browseDirectory(path || "", req.query);

  // Transform histories to the format expected by the admin frontend
  const transformedHistories = result.histories.map((h: any) => {
    // Ensure feedback is populated if it exists on the history document
    return transformHistoryForAdmin(req, h);
  });

  res.status(200).json({
    directories: result.directories,
    histories: transformedHistories, // Return the transformed histories
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

export const getPlans = async (req: Request, res: Response, next: NextFunction) => {
  const plans = await PlanService.getAll();
  res.status(200).json(plans);
};

export const getSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  // Logic này sẽ phức tạp hơn trong thực tế, cần lấy dữ liệu từ DB và có thể từ Stripe
  res.status(501).json({ message: "Chức năng đang được phát triển" });
};
