import { AdminService } from '../admin.service';
import { feedbackService } from '../feedback.service';
import { userService } from '../user.service';
import { AppError, NotFoundError } from "../../errors";
import { predictionHistoryService } from '../prediction_history.service';
import { PlanService } from '../plan.service';
import { subscriptionService } from '../subscription.service';
import { ConfigService } from '../config.service';
import { AIModelService } from '../ai_models.service';
import { UserRole } from '../../models/user.model';
import { CreateAIModelSchema } from '../../types/zod/ai_model.zod';
import { wikiService } from '../dogs_wiki.service';
import { CreateBreedSchema, UpdateBreedSchema } from '../../types/zod/dog_wiki.zod';
import { Types } from 'mongoose';
import { DirectoryItem } from '../../types/zod/admin.zod';
import { ReportDateRange, ReportService } from '../report.service';
import * as ExcelJS from 'exceljs';
import { MediaDoc } from '../../models/medias.model';
import { logger } from '../..//utils/logger.util';
export class AdminBffService {
  private adminService: AdminService;
  private configService: ConfigService;
  private reportService: ReportService;

  constructor() {
    this.adminService = new AdminService();
    this.configService = new ConfigService();
    this.reportService = new ReportService();
  }

  public async getDashboardData() {
    return this.adminService.getDashboardData();
  }
  public async getAdminFeedback(filters: any, pagination: { page: number; limit: number; }) {
    return feedbackService.getAdminFeedbackPageData(filters, pagination);
  }

  public async approveFeedback(id: string, adminId: Types.ObjectId, payload: { correctedLabel?: string }) {
    const updatedFeedback = await feedbackService.approveFeedback(id, adminId, payload.correctedLabel);
    return { message: 'Feedback đã được duyệt thành công.', data: updatedFeedback };
  }

  public async rejectFeedback(id: string, adminId: Types.ObjectId, payload: { reason?: string }) {
    const updatedFeedback = await feedbackService.rejectFeedback(id, adminId, payload.reason);
    return { message: 'Feedback đã bị từ chối.', data: updatedFeedback };
  }

  public async getEnrichedUsers(options: { page?: number, limit?: number, search?: string } = {}): Promise<{ pagination: any; users: any[] }> {
    return this.adminService.getEnrichedUsers(options);
  }

  public async createUser(data: { username: string; email: string; password: string; role: string; verify: string; }) {
    const verifyStatus = data.verify === 'active';
    const newUser = await userService.createUserByAdmin({ ...data, role: data.role as UserRole, verify: verifyStatus });
    return {
      success: true,
      message: 'User created successfully',
      data: newUser,
    };
  }

  public async updateUser(userId: string, data: { username?: string; email?: string; role?: string; status?: string; }) {
    const updateData: any = { username: data.username, email: data.email, role: data.role };
    if (data.status !== undefined) {
      updateData.verify = data.status === 'active';
    }
    const updatedUser = await userService.updateUserById(userId, updateData);
    return {
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    };
  }

  public async browseMedia(path: string): Promise<{ directories: DirectoryItem[], media: MediaDoc[] }> {
    logger.info(`\n[BFF_SERVICE] Bắt đầu browseMedia với path: "${path}"`);

    const parts = path.split('/').filter(Boolean);
    const lastPart = parts.length > 0 ? parts[parts.length - 1] : null;

    logger.info(`[BFF_SERVICE] Phân tích path: parts=${JSON.stringify(parts)}, lastPart="${lastPart}"`);

    if (lastPart === 'images' || lastPart === 'videos') {
      const mediaTypeToFilter = lastPart.slice(0, -1);
      const realDirectoryId = parts.slice(0, -1).join('/');

      logger.info(`[BFF_SERVICE] -> Nhánh THƯ MỤC ẢO. Lọc theo type: "${mediaTypeToFilter}", ID thư mục thật: "${realDirectoryId}"`);

      const coreResult = await this.adminService.browseMediaByLogic(realDirectoryId);
      logger.info(`[BFF_SERVICE] Core Service trả về: ${coreResult.directories.length} thư mục con, ${coreResult.media.length} media files.`);
      if (coreResult.media.length > 0) {
        logger.info(`[BFF_SERVICE] Ví dụ media type: "${coreResult.media[0].type}"`);
      }

      const filteredMedia = coreResult.media.filter((m: MediaDoc) => m.type?.startsWith(mediaTypeToFilter));

      logger.info(`[BFF_SERVICE] Sau khi lọc, còn lại: ${filteredMedia.length} media files.`);

      const finalResult = {
        directories: [],
        media: filteredMedia,
      };
      logger.info(`[BFF_SERVICE] Hoàn tất. Trả về ${finalResult.media.length} media.`);
      return finalResult;
    }

    const realDirectoryId = path;
    logger.info(`[BFF_SERVICE] -> Nhánh THƯ MỤC THẬT. ID: "${realDirectoryId}"`);

    const coreResult = await this.adminService.browseMediaByLogic(realDirectoryId);

    logger.info(`[BFF_SERVICE] Core Service trả về: ${coreResult.directories.length} thư mục con, ${coreResult.media.length} media files.`);

    const virtualDirectories: DirectoryItem[] = [];
    const hasImages = coreResult.media.some((m: MediaDoc) => m.type?.startsWith('image'));
    const hasVideos = coreResult.media.some((m: MediaDoc) => m.type?.startsWith('video'));

    logger.info(`[BFF_SERVICE] Kiểm tra media: có ảnh? ${hasImages}, có video? ${hasVideos}`);

    if (hasImages) {
      virtualDirectories.push({
        id: `${path ? path + '/' : ''}images`,
        name: 'images',
        type: 'folder',
      });
    }

    if (hasVideos) {
      virtualDirectories.push({
        id: `${path ? path + '/' : ''}videos`,
        name: 'videos',
        type: 'folder',
      });
    }

    const finalResult = {
      directories: [...coreResult.directories, ...virtualDirectories],
      media: [],
    };

    logger.info(`[BFF_SERVICE] Hoàn tất. Trả về ${finalResult.directories.length} thư mục (bao gồm cả thật và ảo).`);
    return finalResult;
  }
  public async deleteMedia(mediaId: string) {
    return this.adminService.deleteMedia(mediaId);
  }

  public async browseDatasets(path: string) {
    return this.adminService.browseDatasetDirectory(path);
  }

  public async downloadDataset() {
    logger.info('[BFF Service] Yêu cầu tải về dataset archive.');
    return this.adminService.generateDatasetArchiveUrl();
  }

  public async getAdminHistories(options: { page?: number; limit?: number; search?: string; }) {
    return predictionHistoryService.getAllHistory(options);
  }

  public async browseHistories(path: string, query: any) {
    return this.adminService.browseDirectory(path, query);
  }

  // --- System & AI Config ---
  public async getUsageStats() {
    return this.adminService.getUsageStats();
  }

  public async getModelConfig() {
    return this.configService.getFullConfigForAdmin();
  }

  public async updateModelConfig(modelId: string | undefined, otherConfigData: any) {
    const promises = [];
    if (modelId) {
      promises.push(AIModelService.activateModel(modelId));
    }
    if (Object.keys(otherConfigData).length > 0) {
      promises.push(this.configService.updateAiConfig(otherConfigData));
    }
    await Promise.all(promises);
    const reloadResult = await this.configService.reloadAiService();
    return {
      message: 'AI configuration updated and reload triggered successfully.',
      details: reloadResult.details,
    };
  }

  public async uploadModel(file: Express.Multer.File, body: any, userId: Types.ObjectId) {
    const data = CreateAIModelSchema.parse(body);
    const newModel = await AIModelService.uploadAndCreateModel(
      file,
      data,
      userId
    );
    return { message: "Model uploaded and created successfully.", data: newModel };
  }

  public async getAlerts() {
    const alerts = await this.adminService.getSystemAlerts();
    return { alerts };
  }

  public async getPlans(options: { page?: number; limit?: number; search?: string; }) {
    return PlanService.getAllPaginated(options);
  }

  public async createPlan(planData: any) {
    const newPlan = await PlanService.create(planData);
    return { message: "Gói cước đã được tạo thành công.", data: newPlan };
  }

  public async updatePlan(id: string, planData: any) {
    const updatedPlan = await PlanService.update(id, planData);
    if (!updatedPlan) {
      throw new NotFoundError("Không tìm thấy gói cước để cập nhật.");
    }
    return { message: "Gói cước đã được cập nhật thành công.", data: updatedPlan };
  }

  public async deletePlan(id: string) {
    await PlanService.softDelete(id);
    return { message: "Yêu cầu xóa gói cước đã được xử lý." };
  }

  public async getWikiBreeds(options: { page?: number; limit?: number; search?: string; lang?: 'vi' | 'en'; }) {
    return wikiService.getAllBreeds(options as any);
  }

  public async createWikiBreed(breedData: any, lang: 'vi' | 'en') {
    const parsedBreedData = CreateBreedSchema.parse(breedData);
    const newBreed = await wikiService.createBreed(parsedBreedData, lang);
    return { message: "Giống chó đã được thêm vào Wiki.", data: newBreed };
  }

  public async updateWikiBreed(slug: string, breedData: any, lang: 'vi' | 'en') {
    const parsedBreedData = UpdateBreedSchema.parse(breedData);
    const updatedBreed = await wikiService.updateBreed(slug, parsedBreedData, lang);
    return { message: "Thông tin giống chó đã được cập nhật.", data: updatedBreed };
  }

  public async deleteWikiBreed(slug: string, lang: 'vi' | 'en') {
    await wikiService.softDeleteBreed(slug, lang);
    return { message: "Giống chó đã được xóa (mềm)." };
  }

  public async getTransactions(options: { page: number; limit: number; search?: string; status?: string; planId?: string; }) {
    return subscriptionService.getAllTransactions(options);
  }

  public async getSubscriptions(options: { page: number; limit: number; search?: string; status?: import('../../models/subscription.model').SubscriptionStatus; planId?: string; }) {
    return subscriptionService.getAllSubscriptions(options);
  }


  public async getAIModels() {
    const models = await AIModelService.findAll();
    return {
      message: "Lấy danh sách AI models thành công.",
      data: models,
    };
  }

  public async activateAIModel(modelId: string) {
    const activatedModel = await AIModelService.activateModel(modelId);
    if (!activatedModel) {
      throw new NotFoundError("Không tìm thấy model để kích hoạt.");
    }
    await this.configService.reloadAiService();
    return { message: "Model đã được kích hoạt và AI service đã được yêu cầu tải lại.", data: activatedModel };
  }
  public async getReportPreview(range: ReportDateRange) {
    return this.reportService.getReportData(range);
  }

  public async generateExcelReport(range: ReportDateRange): Promise<ExcelJS.Buffer> {
    return this.reportService.generateExcelReport(range);
  }

  public async generateWordReport(range: ReportDateRange): Promise<Buffer> {
    return this.reportService.generateWordReport(range);
  }
}
