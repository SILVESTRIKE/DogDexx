import { Request, Response, NextFunction } from 'express';
import { AdminBffService } from '../services/bff/admin.bff.service';
import { logger } from '../utils/logger.util';
import { transformMediaURLs } from '../utils/media.util';
import { AppError } from '../errors';
import { sendFileToClient } from '../utils/file.util';
import * as ExcelJS from 'exceljs';

/**
 * Hàm transform để định dạng lại dữ liệu feedback cho admin.
 * @description Hàm này nằm ở controller vì nó cần `req` để tạo URL đầy đủ.
 */
function transformFeedbackForAdmin(req: Request, feedbackDoc: any) {
  if (!feedbackDoc) return null;
  const prediction = feedbackDoc.prediction_id;
  const user = feedbackDoc.user_id;
  const admin = feedbackDoc.admin_id;

  const transformedPrediction = prediction ? transformMediaURLs(req, prediction.toObject()) : null;

  return {
    id: feedbackDoc._id,
    predictionId: prediction?._id,
    feedbackTimestamp: feedbackDoc.createdAt,
    predictionTimestamp: prediction?.createdAt,
    user: user ? { id: user._id, name: user.username, email: user.email } : { id: null, name: 'Guest', email: null },
    admin: admin ? { id: admin._id, name: admin.username, email: admin.email } : null,
    feedbackContent: {
      userSubmittedLabel: feedbackDoc.user_submitted_label,
      notes: feedbackDoc.notes,
      filePath: feedbackDoc.file_path,
    },
    aiPrediction: prediction?.predictions?.[0] 
      ? { class: prediction.predictions[0].class, confidence: prediction.predictions[0].confidence } 
      : null,
    originalMediaUrl: transformedPrediction?.mediaUrl,
    processedMediaUrl: transformedPrediction?.processedMediaUrl,
    status: feedbackDoc.status,
    reason: feedbackDoc.reason,
    isDeleted: feedbackDoc.isDeleted,
  };
}

/**
 * Hàm transform để định dạng lại dữ liệu lịch sử cho admin.
 * @description Hàm này nằm ở controller vì nó cần `req` để tạo URL đầy đủ.
 */
function transformHistoryForAdmin(req: Request, historyDoc: any) {
  if (!historyDoc) return null;
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

/**
 * Hàm transform để định dạng lại dữ liệu media cho admin.
 * @description Hàm này nằm ở controller vì nó cần `req` để tạo URL đầy đủ.
 */
function transformMediaForAdmin(req: Request, mediaDoc: any) {
  if (!mediaDoc) return null;
  const transformedMedia = transformMediaURLs(req, mediaDoc.toObject ? mediaDoc.toObject() : mediaDoc);
  return {
    id: transformedMedia.id, // Sửa: Lấy id đã được transform
    name: transformedMedia.name, // Sửa: Lấy tên trực tiếp từ document
    type: transformedMedia.type.startsWith('image') ? 'image' : 'video',
    url: transformedMedia.mediaUrl,
    size: transformedMedia.size,
    createdAt: transformedMedia.createdAt,
  };
}

const adminBffService = new AdminBffService();

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  const dashboardData = await adminBffService.getDashboardData();
  res.status(200).json(dashboardData);
};

export const getFeedback = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 10, status, search, startDate, endDate } = req.query as any;
  const pagination = { page: Number(page), limit: Number(limit) };
  const filters = { status, username: search, startDate, endDate };
  const feedbackData = await adminBffService.getAdminFeedback(filters, pagination);
  const transformedFeedbacks = feedbackData.feedbacks.data.map(fb => transformFeedbackForAdmin(req, fb));
  res.status(200).json({
    ...feedbackData,
    feedbacks: { ...feedbackData.feedbacks, data: transformedFeedbacks },
  });
};

export const approveFeedback = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const adminId = (req as any).user._id;
  const { correctedLabel } = req.body; // Lấy correctedLabel từ body
  const result = await adminBffService.approveFeedback(id, adminId, { correctedLabel });
  res.status(200).json({ ...result, data: transformFeedbackForAdmin(req, result.data) });
};

export const rejectFeedback = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const adminId = (req as any).user._id;
  const { reason } = req.body; // Lấy reason từ body
  const result = await adminBffService.rejectFeedback(id, adminId, { reason });
  res.status(200).json({ ...result, data: transformFeedbackForAdmin(req, result.data) });
};

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  const usersData = await adminBffService.getEnrichedUsers({
    page: parseInt(req.query.page as string, 10) || 1,
    limit: parseInt(req.query.limit as string, 10) || 10,
    search: req.query.search as string | undefined,
  });
  res.status(200).json(usersData);
};

export const browseMedia = async (req: Request, res: Response, next: NextFunction) => {
  const path = req.query.path as string || "";
  const result = await adminBffService.browseMedia(path);
  res.status(200).json({
    directories: result.directories,
    media: result.media.map(m => transformMediaForAdmin(req, m)),
  });
};

export const deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
  const result = await adminBffService.deleteMedia(req.params.id);
  res.status(200).json(result);
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password, role, verify } = req.body;
  const result = await adminBffService.createUser({ username, email, password, role, verify });
  res.status(201).json(result);
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { username, email, role, status } = req.body;
  const result = await adminBffService.updateUser(id, { username, email, role, status });
  res.status(200).json(result);
};

export const getUsageStats = async (req: Request, res: Response, next: NextFunction) => {
  const usageData = await adminBffService.getUsageStats();
  res.status(200).json(usageData);
};

export const getModelConfig = async (req: Request, res: Response, next: NextFunction) => {
  const fullConfig = await adminBffService.getModelConfig();
  res.status(200).json({
    message: 'Lấy cấu hình model thành công.',
    data: fullConfig,
  });
};

export const getHistories = async (req: Request, res: Response, next: NextFunction) => {
  const { page = 1, limit = 10, search } = req.query as any;
  const result = await adminBffService.getAdminHistories({
    page: Number(page),
    limit: Number(limit),
    search,
  });
  const transformedHistories = result.histories.map((h: any) => transformHistoryForAdmin(req, h));
  res.status(200).json({
    data: transformedHistories,
    pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
  });
};

export const browseHistories = async (req: Request, res: Response, next: NextFunction) => {
  const path = req.query.path as string;
  const result = await adminBffService.browseHistories(path || "", req.query);
  const transformedHistories = result.histories.map((h: any) => transformHistoryForAdmin(req, h));
  res.status(200).json({
    directories: result.directories,
    histories: transformedHistories,
  });
};

export const updateModelConfig = async (req: Request, res: Response, next: NextFunction) => {
  // modelId không còn được quản lý ở đây, nó được xử lý bởi activateAIModel.
  // Hàm này chỉ cập nhật các cấu hình khác như device, thresholds.
  const result = await adminBffService.updateModelConfig(undefined, req.body);
  res.status(200).json(result);
};

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  const result = await adminBffService.getAlerts();
  res.status(200).json(result);
};

export const uploadModel = async (req: Request, res: Response, next: NextFunction) => {
  const file = req.file; // SỬA: Lấy file từ req.file (do dùng multer.single)
  if (!file) {
    throw new AppError("Model file is required.");
  }
  const result = await adminBffService.uploadModel(file, req.body, (req as any).user.id);
  res.status(201).json(result);
};

function transformDatasetFileForAdmin(req: Request, file: any) {
  if (!file) return null;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return {
    ...file,
    url: file.url ? `${baseUrl}${file.url}` : null,
  };
}

export const browseDatasets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const path = req.query.path as string || "";
    const result = await adminBffService.browseDatasets(path);
    res.status(200).json({
      directories: result.directories,
      files: result.files.map(f => transformDatasetFileForAdmin(req, f)),
    });
  } catch (error) {
    next(error);
  }
};

export const downloadDataset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VÔ HIỆU HÓA TIMEOUT: Cho phép server xử lý tác vụ nén file trong thời gian dài.
    req.setTimeout(0);

    const archive = await adminBffService.downloadDataset();
    let connectionClosed = false; // Thêm biến cờ để theo dõi trạng thái kết nối

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=dataset.zip');

    // Khi client đóng kết nối đột ngột (ví dụ: đóng tab), hủy quá trình nén.
    res.on('close', () => {
      logger.warn('[Admin Controller] Client đã đóng kết nối, hủy quá trình tạo archive.');
      connectionClosed = true;
      archive.abort();
    });

    // SỬA LỖI: Xử lý lỗi từ stream một cách an toàn.
    // Thay vì `throw`, hãy chuyển lỗi cho Express xử lý.
    archive.on('error', (err) => {
      logger.error('[Admin Controller] Lỗi trong quá trình tạo archive zip:', err);
      next(err); // Chuyển lỗi đến middleware xử lý lỗi của Express.
    });
    archive.pipe(res);

    // Bắt đầu quá trình nén và gửi đi.
    await archive.finalize();
    // Chỉ ghi log thành công nếu kết nối không bị đóng
    if (!connectionClosed) {
      logger.info('[Admin Controller] Đã gửi file dataset.zip thành công.');
    }
  } catch (error) {
    next(error);
  }
};

export const getPlans = async (req: Request, res: Response, next: NextFunction) => {
  const plansData = await adminBffService.getPlans({
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 10,
      search: req.query.search as string | undefined,
  });
  res.status(200).json(plansData);
};

// THÊM: Hàm controller để tạo Plan mới
export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  const result = await adminBffService.createPlan(req.body);
  res.status(201).json(result);
};

// THÊM: Hàm controller để cập nhật Plan
export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const result = await adminBffService.updatePlan(id, req.body);
  res.status(200).json(result);
};

// THÊM: Hàm controller để xóa Plan
export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const result = await adminBffService.deletePlan(id);
  res.status(200).json(result);
};

// --- THÊM MỚI: CÁC CONTROLLER CHO WIKI ---

export const getWikiBreeds = async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 10, search, lang = 'vi' } = req.query as any;
    const breedsResult = await adminBffService.getWikiBreeds({
        page: Number(page),
        limit: Number(limit),
        search,
        lang
    });
    // SỬA: Transform media URLs để đảm bảo frontend nhận được URL đầy đủ
    const transformedData = transformMediaURLs(req, breedsResult.data);

    res.status(200).json({ ...breedsResult, data: transformedData });
};

export const createWikiBreed = async (req: Request, res: Response, next: NextFunction) => {
    const { lang = 'vi' } = req.query as any;
    const result = await adminBffService.createWikiBreed(req.body, lang);
    res.status(201).json(result);
};

export const updateWikiBreed = async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const { lang = 'vi' } = req.query as any;
    const result = await adminBffService.updateWikiBreed(slug, req.body, lang);
    res.status(200).json(result);
};

export const deleteWikiBreed = async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const { lang = 'vi' } = req.query as any;
    const result = await adminBffService.deleteWikiBreed(slug, lang);
    res.status(200).json(result);
};

/**
 * [Admin] Lấy danh sách các GIAO DỊCH (Transactions).
 */
export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      planId 
    } = req.query as any;

    const options = { page: Number(page), limit: Number(limit), search, status, planId };

    const transactionsData = await adminBffService.getTransactions(options);
    res.status(200).json(transactionsData);
  } catch (error) {
    next(error);
  }
};

/**
 * [Admin] Lấy danh sách các ĐĂNG KÝ (Subscriptions).
 */
export const getSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      planId 
    } = req.query as any;

    const options = { page: Number(page), limit: Number(limit), search, status, planId };

    const subscriptionsData = await adminBffService.getSubscriptions(options);
    res.status(200).json(subscriptionsData);
  } catch (error) {
    next(error);
  }
};

// --- THÊM MỚI: CÁC CONTROLLER CHO AI MODEL MANAGEMENT ---

export const getAIModels = async (req: Request, res: Response, next: NextFunction) => {
  const result = await adminBffService.getAIModels();
  // Trả về mảng data trực tiếp để tương thích với frontend
  res.status(200).json(result.data);
};

export const activateAIModel = async (req: Request, res: Response, next: NextFunction) => {
  const result = await adminBffService.activateAIModel(req.params.id);
  res.status(200).json(result);
};

export const exportReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, format } = req.query as { startDate: string, endDate: string, format: 'excel' | 'word' };

    if (!startDate || !endDate || !format) {
      throw new AppError("Missing required query parameters: startDate, endDate, format");
    }

    const range = { startDate: new Date(startDate), endDate: new Date(endDate) };
    let reportBuffer: Buffer | ExcelJS.Buffer;
    let fileName: string;
    let contentType: string;

    if (format === 'excel') {
      reportBuffer = await adminBffService.generateExcelReport(range);
      fileName = 'DogDex_Report.xlsx';
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (format === 'word') {
      reportBuffer = await adminBffService.generateWordReport(range);
      fileName = 'DogDex_Report.docx';
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      throw new AppError("Invalid format specified. Must be 'excel' or 'word'.");
    }

    // Đảm bảo dữ liệu luôn là Buffer trước khi gửi
    const dataToSend = reportBuffer instanceof Buffer ? reportBuffer : Buffer.from(reportBuffer as ExcelJS.Buffer);
    sendFileToClient({ res, fileName, contentType, data: dataToSend });
  } catch (error) {
    next(error);
  }
};
