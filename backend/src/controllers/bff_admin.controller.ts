import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';
import { feedbackService } from '../services/feedback.service';
import { userService } from '../services/user.service';
import { AppError, NotFoundError} from '../errors';
import { predictionHistoryService } from '../services/prediction_history.service';
import { PlanService } from '../services/plan.service';
import { transformMediaURLs } from '../utils/media.util';
import { ConfigService } from '../services/config.service';
import { AIModelService } from '../services/ai_models.service';
import { CreateAIModelSchema } from '../types/zod/ai_model.zod';

/**
 * Hàm transform để định dạng lại dữ liệu feedback cho admin.
 */
function transformFeedbackForAdmin(req: Request, feedbackDoc: any) {
  const prediction = feedbackDoc.prediction_id;
  const user = feedbackDoc.user_id;

  const transformedPrediction = prediction ? transformMediaURLs(req, prediction.toObject()) : null;

  return {
    id: feedbackDoc._id,
    predictionId: prediction?._id,
    feedbackTimestamp: feedbackDoc.createdAt,
    predictionTimestamp: prediction?.createdAt,
    user: user ? { name: user.username, email: user.email } : { name: 'Guest', email: null },
    feedbackContent: {
      isCorrect: feedbackDoc.is_correct,
      userSubmittedLabel: feedbackDoc.user_submitted_label,
      notes: feedbackDoc.notes,
    },
    aiPrediction: prediction?.predictions?.[0] 
      ? { class: prediction.predictions[0].class, confidence: prediction.predictions[0].confidence } 
      : null,
    originalMediaUrl: transformedPrediction?.mediaUrl,
    processedMediaUrl: transformedPrediction?.processedMediaUrl,
    status: feedbackDoc.status,
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
      url: transformedHistory.media.mediaUrl,
      name: transformedHistory.media.name,
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

export const browseMedia = async (req: Request, res: Response, next: NextFunction) => {
  const path = req.query.path as string || "";
  const result = await adminService.browseMedia(path);
  res.status(200).json({
    directories: result.directories,
    media: result.media.map(m => transformMediaForAdmin(req, m)),
  });
};

export const deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
  const result = await adminService.deleteMedia(req.params.id);
  res.status(200).json(result);
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password, role, verify } = req.body;
  const verifyStatus = verify === 'active';
  const newUser = await userService.createUserByAdmin({ username, email, password, role, verify: verifyStatus });
  res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser,
  });
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { username, email, role, status } = req.body;
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
  const transformedHistories = result.histories.map((h: any) => transformHistoryForAdmin(req, h));
  res.status(200).json({
    directories: result.directories,
    histories: transformedHistories,
  });
};

export const updateModelConfig = async (req: Request, res: Response, next: NextFunction) => {
  const { modelId, ...otherConfigData } = req.body;
  const promises = [];
  if (modelId) {
    promises.push(AIModelService.activateModel(modelId));
  }
  if (Object.keys(otherConfigData).length > 0) {
    promises.push(configService.updateAiConfig(otherConfigData));
  }
  await Promise.all(promises);
  const reloadResult = await configService.reloadAiService();
  res.status(200).json({
    message: 'AI configuration updated and reload triggered successfully.',
    details: reloadResult.details,
  });
};

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  const alerts = await adminService.getSystemAlerts();
  res.status(200).json({ alerts });
};

export const uploadModel = async (req: Request, res: Response, next: NextFunction) => {
  const files = req.files;
  if (!files || typeof files !== 'object' || !('modelFile' in files) || !Array.isArray(files.modelFile)) {
    throw new AppError("Model file is required.");
  }
  const data = CreateAIModelSchema.parse(req.body);
  const newModel = await AIModelService.uploadAndCreateModel(
    files as { modelFile: Express.Multer.File[] },
    data,
    (req as any).user.id
  );
  res.status(201).json({ message: "Model uploaded and created successfully.", data: newModel });
};

export const getPlans = async (req: Request, res: Response, next: NextFunction) => {
  const plansData = await PlanService.getAllPaginated({
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 10,
      search: req.query.search as string | undefined,
  });
  res.status(200).json(plansData);
};

// THÊM: Hàm controller để tạo Plan mới
export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  // Trong một ứng dụng thực tế, bạn nên có một lớp validation (ví dụ: Zod) ở đây
  const newPlan = await PlanService.create(req.body);
  res.status(201).json({ message: "Gói cước đã được tạo thành công.", data: newPlan });
};

// THÊM: Hàm controller để cập nhật Plan
export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updatedPlan = await PlanService.update(id, req.body);
  if (!updatedPlan) {
    // Vẫn cần kiểm tra này để trả về 404 một cách tường minh
    throw new NotFoundError("Không tìm thấy gói cước để cập nhật.");
  }
  res.status(200).json({ message: "Gói cước đã được cập nhật thành công.", data: updatedPlan });
};

// THÊM: Hàm controller để xóa Plan
export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  // Lưu ý: PlanService nên xử lý soft delete (đặt isDeleted = true) thay vì xóa cứng
  await PlanService.softDelete(id);
  res.status(200).json({ message: "Yêu cầu xóa gói cước đã được xử lý." });
};

export const getSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  res.status(501).json({ message: "Chức năng đang được phát triển" });
};