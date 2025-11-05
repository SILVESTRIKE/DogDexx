// src/controllers/admin.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AdminBFFService } from '../services/experience/admin.bff.service';
import { transformMediaURLs } from '../utils/media.util';
import { CreateAIModelSchema } from '../types/zod/ai_model.zod';
import { CreateBreedSchema, UpdateBreedSchema } from '../types/zod/dog_wiki.zod';

const adminBffService = new AdminBFFService();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// --- Dashboard ---
export const getDashboard = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const dashboardData = await adminBffService.getDashboardData();
  res.status(200).json(dashboardData);
});

// --- Feedback Management ---
export const getFeedback = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const rawFeedbackData = await adminBffService.getFeedback(req.query);
  
  // Transform dữ liệu tại controller
  const transformedData = {
      ...rawFeedbackData,
      feedbacks: {
          ...rawFeedbackData.feedbacks,
          data: transformMediaURLs(req, rawFeedbackData.feedbacks.data)
      }
  };
  res.status(200).json(transformedData);
});

export const approveFeedback = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const rawUpdatedFeedback = await adminBffService.approveFeedback(id);
  const transformedFeedback = transformMediaURLs(req, rawUpdatedFeedback);
  res.status(200).json({ message: 'Feedback đã được duyệt thành công.', data: transformedFeedback });
});

export const rejectFeedback = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const rawUpdatedFeedback = await adminBffService.rejectFeedback(id);
  const transformedFeedback = transformMediaURLs(req, rawUpdatedFeedback);
  res.status(200).json({ message: 'Feedback đã bị từ chối.', data: transformedFeedback });
});

// --- User Management ---
export const getUsers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const rawUsersData = await adminBffService.getUsers(req.query);
  const transformedData = transformMediaURLs(req, rawUsersData);
  res.status(200).json(transformedData);
});

export const createUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const newUser = await adminBffService.createUser(req.body);
  res.status(201).json({ success: true, message: 'User created successfully', data: newUser });
});

export const updateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updatedUser = await adminBffService.updateUser(id, req.body);
  res.status(200).json({ success: true, message: 'User updated successfully', data: updatedUser });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  await adminBffService.deleteUser(id);
  res.status(200).json({ success: true, message: 'User deleted successfully' });
});

// --- AI Model & Config Management ---
export const getAIModelsAndConfigs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const data = await adminBffService.getAIModelsAndConfigs();
    res.status(200).json({ message: 'Lấy danh sách model và cấu hình thành công.', data });
});

export const updateModelConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { modelId, configId, ...configParams } = req.body;
    const promises = [];

    if (modelId) {
        promises.push(adminBffService.activateModelAndReload(modelId));
    }
    if (configId && Object.keys(configParams).length > 0) {
        promises.push(adminBffService.updateConfigAndReload(configId, configParams));
    }
    
    await Promise.all(promises);

    res.status(200).json({
        message: 'AI configuration updated and services reloaded successfully.',
    });
});

export const uploadModel = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const data = CreateAIModelSchema.parse(req.body);
  const newModel = await adminBffService.uploadModel(req.files, data, (req as any).user.id);
  res.status(201).json({ message: "Model uploaded and created successfully.", data: newModel });
});

// --- History & Media Management ---
export const getHistories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const rawResult = await adminBffService.getHistories(req.query);
  const transformedHistories = transformMediaURLs(req, rawResult.histories);

  res.status(200).json({
    data: transformedHistories,
    pagination: { total: rawResult.total, page: rawResult.page, limit: rawResult.limit, totalPages: rawResult.totalPages },
  });
});

export const browseMedia = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const path = req.query.path as string || "";
  const rawResult = await adminBffService.browseMedia(path);
  
  res.status(200).json({
    directories: rawResult.directories,
    media: transformMediaURLs(req, rawResult.media),
  });
});

export const deleteMedia = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await adminBffService.deleteMedia(req.params.id);
  res.status(200).json(result);
});

export const browseHistories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const rawResult = await adminBffService.browseHistories(req.query);

    res.status(200).json({
        directories: rawResult.directories,
        histories: transformMediaURLs(req, rawResult.histories),
    });
});

// --- Plan Management ---
export const getPlans = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const plansData = await adminBffService.getPlans(req.query);
  res.status(200).json(plansData);
});

export const createPlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const newPlan = await adminBffService.createPlan(req.body);
  res.status(201).json({ message: "Gói cước đã được tạo thành công.", data: newPlan });
});

export const updatePlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const updatedPlan = await adminBffService.updatePlan(id, req.body);
  res.status(200).json({ message: "Gói cước đã được cập nhật thành công.", data: updatedPlan });
});

export const deletePlan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  await adminBffService.deletePlan(id);
  res.status(200).json({ message: "Yêu cầu xóa gói cước đã được xử lý." });
});

// --- Wiki Management ---
export const getWikiBreeds = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await adminBffService.getWikiBreeds(req.query);
    res.status(200).json(result);
});

export const createWikiBreed = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const breedData = CreateBreedSchema.parse(req.body);
    const { lang = 'vi' } = req.query as any;
    const newBreed = await adminBffService.createWikiBreed(breedData, lang);
    res.status(201).json({ message: "Giống chó đã được thêm vào Wiki.", data: newBreed });
});

export const updateWikiBreed = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const { lang = 'vi' } = req.query as any;
    const breedData = UpdateBreedSchema.parse(req.body);
    const updatedBreed = await adminBffService.updateWikiBreed(slug, breedData, lang);
    res.status(200).json({ message: "Thông tin giống chó đã được cập nhật.", data: updatedBreed });
});

export const deleteWikiBreed = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const { lang = 'vi' } = req.query as any;
    await adminBffService.deleteWikiBreed(slug, lang);
    res.status(200).json({ message: "Giống chó đã được xóa (mềm)." });
});

// --- Subscription & Transaction Management ---
export const getTransactions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const transactionsData = await adminBffService.getTransactions(req.query);
  res.status(200).json(transactionsData);
});

export const getSubscriptions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const subscriptionsData = await adminBffService.getSubscriptions(req.query);
  res.status(200).json(subscriptionsData);
});