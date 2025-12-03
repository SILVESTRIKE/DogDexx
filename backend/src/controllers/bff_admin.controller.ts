import { Request, Response, NextFunction } from 'express';
import { AdminBffService } from '../services/bff/admin.bff.service';
import { logger } from '../utils/logger.util';
import { transformMediaURLs } from '../utils/media.util';
import { AppError } from '../errors';
import { sendFileToClient } from '../utils/file.util';
import * as ExcelJS from 'exceljs';
import { userController } from './user.controller';
import { DatabaseService } from '../services/database.service';

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

function transformHistoryForAdmin(req: Request, historyDoc: any) {
  if (!historyDoc) return null;
  const user = historyDoc.user;
  const transformedHistory = transformMediaURLs(req, historyDoc.toObject ? historyDoc.toObject() : historyDoc);

  return {
    id: transformedHistory.id,
    user: user ? { id: user._id, name: user.username, email: user.email } : { id: null, name: 'Guest', email: null },
    media: {
      type: transformedHistory.media.type.startsWith('image') ? 'image' : 'video',
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
  if (!mediaDoc) return null;
  const transformedMedia = transformMediaURLs(req, mediaDoc.toObject ? mediaDoc.toObject() : mediaDoc);
  return {
    id: transformedMedia.id,
    name: transformedMedia.name,
    type: transformedMedia.type.startsWith('image') ? 'image' : 'video',
    url: transformedMedia.mediaUrl,
    size: transformedMedia.size,
    createdAt: transformedMedia.createdAt,
  };
}

const adminBffService = new AdminBffService();

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboardData = await adminBffService.getDashboardData();
    res.status(200).json(dashboardData);
  } catch (error) {
    next(error);
  }
};

export const getFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, status, search, startDate, endDate } = req.query as any;
    const pagination = { page: Number(page), limit: Number(limit) };
    const filters = { status, username: search, startDate, endDate };
    const feedbackData = await adminBffService.getAdminFeedback(filters, pagination);
    const transformedFeedbacks = feedbackData.feedbacks.data.map(fb => transformFeedbackForAdmin(req, fb));
    res.status(200).json({
      ...feedbackData,
      feedbacks: { ...feedbackData.feedbacks, data: transformedFeedbacks },
    });
  } catch (error) {
    next(error);
  }
};

export const approveFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user._id;
    const { correctedLabel } = req.body;
    const result = await adminBffService.approveFeedback(id, adminId, { correctedLabel });
    res.status(200).json({ ...result, data: transformFeedbackForAdmin(req, result.data) });
  } catch (error) {
    next(error);
  }
};

export const rejectFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user._id;
    const { reason } = req.body;
    const result = await adminBffService.rejectFeedback(id, adminId, { reason });
    res.status(200).json({ ...result, data: transformFeedbackForAdmin(req, result.data) });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usersData = await adminBffService.getEnrichedUsers({
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 10,
      search: req.query.search as string | undefined,
    });
    res.status(200).json(usersData);
  } catch (error) {
    next(error);
  }
};

export const browseMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const path = req.query.path as string || "";
    const result = await adminBffService.browseMedia(path);
    res.status(200).json({
      directories: result.directories,
      media: result.media.map(m => transformMediaForAdmin(req, m)),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminBffService.deleteMedia(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password, role, verify } = req.body;
    const result = await adminBffService.createUser({ username, email, password, role, verify });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { username, email, role, status } = req.body;
    const result = await adminBffService.updateUser(id, { username, email, role, status });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getUsageStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usageData = await adminBffService.getUsageStats();
    res.status(200).json(usageData);
  } catch (error) {
    next(error);
  }
};

export const getModelConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fullConfig = await adminBffService.getModelConfig();
    res.status(200).json({
      message: 'Lấy cấu hình model thành công.',
      data: fullConfig,
    });
  } catch (error) {
    next(error);
  }
};

export const getHistories = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

export const browseHistories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const path = req.query.path as string;
    const result = await adminBffService.browseHistories(path || "", req.query);
    const transformedHistories = result.histories.map((h: any) => transformHistoryForAdmin(req, h));
    res.status(200).json({
      directories: result.directories,
      histories: transformedHistories,
    });
  } catch (error) {
    next(error);
  }
};

export const updateModelConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminBffService.updateModelConfig(undefined, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminBffService.getAlerts();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const uploadModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError("Model file is required.");
    }
    const result = await adminBffService.uploadModel(file, req.body, (req as any).user.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

function transformDatasetFileForAdmin(req: Request, file: any) {
  if (!file) return null;
  return {
    ...file,
    url: file.url ? `${file.url}` : null,
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
    const downloadUrl = await adminBffService.downloadDataset();

    res.status(200).json({ downloadUrl });
    logger.info('[Admin Controller] Sent dataset download URL to client.');
  } catch (error) {
    next(error);
  }
};

export const getPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plansData = await adminBffService.getPlans({
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 10,
      search: req.query.search as string | undefined,
    });
    res.status(200).json(plansData);
  } catch (error) {
    next(error);
  }
};


export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminBffService.createPlan(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};


export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await adminBffService.updatePlan(id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};


export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await adminBffService.deletePlan(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};



export const getWikiBreeds = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, search, lang = 'vi' } = req.query as any;
    const breedsResult = await adminBffService.getWikiBreeds({
      page: Number(page),
      limit: Number(limit),
      search,
      lang
    });
    const transformedData = transformMediaURLs(req, breedsResult.data);

    res.status(200).json({ ...breedsResult, data: transformedData });
  } catch (error) {
    next(error);
  }
};

export const createWikiBreed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lang = 'vi' } = req.query as any;
    const result = await adminBffService.createWikiBreed(req.body, lang);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateWikiBreed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const { lang = 'vi' } = req.query as any;
    const result = await adminBffService.updateWikiBreed(slug, req.body, lang);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteWikiBreed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const { lang = 'vi' } = req.query as any;
    const result = await adminBffService.deleteWikiBreed(slug, lang);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return userController.adminDeleteUser(req as any, res as any);
  } catch (error) {
    next(error);
  }
};

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



export const getAIModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminBffService.getAIModels();
    res.status(200).json(result.data);
  } catch (error) {
    next(error);
  }
};

export const activateAIModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminBffService.activateAIModel(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
export const getReportPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query as { startDate: string, endDate: string };

    if (!startDate || !endDate) {
      throw new AppError("Missing required query parameters: startDate, endDate");
    }

    const range = { startDate: new Date(startDate), endDate: new Date(endDate) };

    const data = await adminBffService.getReportPreview(range);

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
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

    const dataToSend = reportBuffer instanceof Buffer ? reportBuffer : Buffer.from(reportBuffer as ExcelJS.Buffer);
    sendFileToClient({ res, fileName, contentType, data: dataToSend });
  } catch (error) {
    next(error);
  }
};



const databaseService = new DatabaseService();

export const backupDatabase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('[Admin] Starting database backup...');

    const backupPath = await databaseService.createBackup();
    const fileName = backupPath.split(/[/\\]/).pop() || 'backup.archive';

    const fs = require('fs');
    const fileBuffer = fs.readFileSync(backupPath);

    sendFileToClient({
      res,
      fileName,
      contentType: 'application/gzip',
      data: fileBuffer,
    });

    logger.info(`[Admin] Database backup sent to client: ${fileName}`);

    databaseService.cleanOldBackups(10).catch(err => {
      logger.warn('Failed to clean old backups:', err);
    });
  } catch (error) {
    logger.error('[Admin] Database backup failed:', error);
    next(error);
  }
};

export const restoreDatabase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;

    if (!file) {
      throw new AppError('Backup file is required');
    }

    logger.info(`[Admin] Starting database restore from: ${file.originalname}`);

    await databaseService.restoreFromBackup(file.path);

    logger.info('[Admin] Database restore completed successfully');

    res.status(200).json({
      message: 'Database restored successfully',
      filename: file.originalname,
    });
  } catch (error) {
    logger.error('[Admin] Database restore failed:', error);
    next(error);
  }
};

