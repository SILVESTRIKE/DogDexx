// src/services/bff_admin.service.ts

import { Types } from "mongoose";

// Import tất cả các service con cần thiết
import { AIModelService } from "../ai_models.service";
import { ConfigService } from "../config.service";
import { feedbackService } from "../feedback.service";
import { userService } from "../user.service";
import { predictionHistoryService } from "../prediction_history.service";
import { PlanService } from "../plan.service";
import { subscriptionService } from "../subscription.service";
import { wikiService } from "../dogs_wiki.service";
import { AdminService as CoreAdminService } from "../admin.service";

// Import các model và schema
import { AIModel } from "../../models/ai_models.model";
import { IConfiguration } from "../../models/config.model";
import { CreateAIModelType, CreateAIModelSchema } from "../../types/zod/ai_model.zod";
import {
  CreateBreedSchema,
  UpdateBreedSchema,
} from "../../types/zod/dog_wiki.zod";

// Import các tiện ích và lỗi
import { AppError, NotFoundError } from "../../errors";
import { z } from "zod";

// Khởi tạo các service
const configService = new ConfigService();
const coreAdminService = new CoreAdminService();

export class AdminBFFService {
  // --- Dashboard ---
  async getDashboardData() {
    return coreAdminService.getDashboardData();
  }

  // --- Feedback Management ---
  async getFeedback(query: any) {
    const { page = 1, limit = 10, status, search, startDate, endDate } = query;
    const pagination = { page: Number(page), limit: Number(limit) };
    const filters = { status, username: search, startDate, endDate };
    return feedbackService.getAdminFeedbackPageData(filters, pagination);
  }

  async approveFeedback(id: string) {
    return feedbackService.approveFeedback(id);
  }

  async rejectFeedback(id: string) {
    return feedbackService.rejectFeedback(id);
  }

  // --- User Management ---
  async getUsers(query: any) {
    return coreAdminService.getEnrichedUsers({
      page: parseInt(query.page as string, 10) || 1,
      limit: parseInt(query.limit as string, 10) || 10,
      search: query.search as string | undefined,
    });
  }

  async createUser(data: any) {
    const { username, email, password, role, verify } = data;
    const verifyStatus = verify === "active";
    return userService.createUserByAdmin({
      username,
      email,
      password,
      role,
      verify: verifyStatus,
    });
  }

  async updateUser(id: string, data: any) {
    const { username, email, role, status } = data;
    const updateData: any = { username, email, role };
    if (status !== undefined) {
      updateData.verify = status === "active";
    }
    return userService.updateUserById(id, updateData);
  }

  // --- AI Model & Config Management ---
  async getAIModelsAndConfigs() {
    const models = await AIModel.find({ isDeleted: false })
      .populate("configId")
      .sort({ createdAt: -1 });
    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const currentConfig = activeModel ? activeModel.configId : null;
    return { models, currentConfig };
  }

  async activateModelAndReload(modelId: string) {
    const activatedModel = await AIModelService.activateModel(modelId);
    if (!activatedModel) {
      throw new NotFoundError("Model not found or could not be activated.");
    }
    return configService.reloadAiService(activatedModel.taskType);
  }

  async updateConfigAndReload(configId: string, params: Partial<IConfiguration>) {
    const updatedConfig = await configService.updateConfig(configId, params);
    if (!updatedConfig) throw new NotFoundError("Configuration not found or could not be updated.");
    const model = await AIModel.findOne({ configId: updatedConfig._id });
    if (!model) throw new NotFoundError("Could not find model associated with the configuration.");
    return configService.reloadAiService(model.taskType);
  }

  async uploadModel(
    files: any,
    data: CreateAIModelType,
    creator_id: Types.ObjectId
  ) {
    if (!files || typeof files !== "object" || !("modelFile" in files)) {
      throw new AppError("Model file is required ('modelFile').");
    }
    return AIModelService.uploadAndCreateModel(files, data, creator_id);
  }

  // --- History & Media Management ---
  async getHistories(query: any) {
    const { page = 1, limit = 10, search } = query;
    return predictionHistoryService.getAllHistory({
      page: Number(page),
      limit: Number(limit),
      search,
    });
  }

  async browseMedia(path: string) {
    return coreAdminService.browseMedia(path);
  }

  async deleteMedia(mediaId: string) {
    return coreAdminService.deleteMedia(mediaId);
  }

  async browseHistories(query: any) {
    const path = query.path as string;
    return coreAdminService.browseDirectory(path || "", query);
  }

  // --- Plan Management ---
  async getPlans(query: any) {
    return PlanService.getAllPaginated({
      page: parseInt(query.page as string, 10) || 1,
      limit: parseInt(query.limit as string, 10) || 10,
      search: query.search as string | undefined,
    });
  }

  async createPlan(data: any) {
    return PlanService.create(data);
  }

  async updatePlan(id: string, data: any) {
    const updatedPlan = await PlanService.update(id, data);
    if (!updatedPlan) {
      throw new NotFoundError("Không tìm thấy gói cước để cập nhật.");
    }
    return updatedPlan;
  }

  async deletePlan(id: string) {
    return PlanService.softDelete(id);
  }

  // --- Wiki Management ---
  async getWikiBreeds(query: any) {
    const { page = 1, limit = 10, search, lang = "vi" } = query;
    return wikiService.getAllBreeds({
      page: Number(page),
      limit: Number(limit),
      search,
      lang: lang as any,
    });
  }

  async createWikiBreed(data: z.infer<typeof CreateBreedSchema>, lang: string) {
    return wikiService.createBreed(data, lang as any);
  }

  async updateWikiBreed(slug: string, data: z.infer<typeof UpdateBreedSchema>, lang: string) {
    return wikiService.updateBreed(slug, data, lang as any);
  }

  async deleteWikiBreed(slug: string, lang: string) {
    return wikiService.softDeleteBreed(slug, lang as any);
  }

  // --- Subscription & Transaction Management ---
  async getTransactions(query: any) {
    const { page = 1, limit = 10, search, status, planId } = query;
    const options = {
      page: Number(page),
      limit: Number(limit),
      search,
      status,
      planId,
    };
    return subscriptionService.getAllTransactions(options);
  }

  async getSubscriptions(query: any) {
    const { page = 1, limit = 10, search, status, planId } = query;
    const options = {
      page: Number(page),
      limit: Number(limit),
      search,
      status,
      planId,
    };
    return subscriptionService.getAllSubscriptions(options);
  }
}
