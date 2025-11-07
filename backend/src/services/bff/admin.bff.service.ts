// import { UserModel, UserDoc } from "../../models/user.model";
// import { PredictionHistoryModel, PredictionHistoryDoc } from "../../models/prediction_history.model";
// import { FeedbackModel } from "../../models/feedback.model";
// import { MediaModel, MediaDoc } from "../../models/medias.model";
// import { DirectoryModel } from "../../models/directory.model";
// import { AnalyticsEventModel } from "../../models/analytics_event.model";
// import { userService } from "../user.service";
// import { UserCollectionModel } from "../../models/user_collection.model";
// import { AppError, NotFoundError } from "../../errors";
// import {
//   BrowseResult,
//   DirectoryItem,
// } from "../../types/zod/admin.zod";
// import fs from 'fs/promises';
// import path from 'path';
// import { AnalyticsEventName } from "../../constants/analytics.events";
// import { PlanModel } from "../../models/plan.model";
// import { feedbackService } from '../feedback.service';
// import { predictionHistoryService } from '../prediction_history.service';
// import { PlanService } from '../plan.service';
// import { transformMediaURLs } from '../../utils/media.util';
// import { subscriptionService } from '../subscription.service';
// import { ConfigService } from '../config.service';
// import { AIModelService } from '../ai_models.service';
// import { CreateAIModelSchema } from '../../types/zod/ai_model.zod';
// import { wikiService } from '../dogs_wiki.service';
// import { CreateBreedSchema, UpdateBreedSchema } from '../../types/zod/dog_wiki.zod';
// import { Types } from 'mongoose';

// /**
//  * Lớp này chứa toàn bộ logic nghiệp vụ cho trang Admin.
//  * Nó tổng hợp logic từ AdminService, FeedbackService, UserService, v.v.
//  * và thực hiện các biến đổi dữ liệu cần thiết cho frontend.
//  */
// export class AdminBffService {
//   private configService: ConfigService;

//   constructor() {
//     this.configService = new ConfigService();
//   }

//     /**
//      * Hàm transform để định dạng lại dữ liệu feedback cho admin.
//      * @param req Đối tượng Request để xây dựng URL đầy đủ.
//      * @param feedbackDoc Tài liệu feedback từ database.
//      */
//   private transformFeedbackForAdmin(baseUrl: string, feedbackDoc: any) {
//     const prediction = feedbackDoc.prediction_id;
//     const user = feedbackDoc.user_id;

//     const transformedPrediction = prediction ? transformMediaURLs(baseUrl, prediction.toObject()) : null;

//     return {
//       id: feedbackDoc._id,
//       predictionId: prediction?._id,
//       feedbackTimestamp: feedbackDoc.createdAt,
//       predictionTimestamp: prediction?.createdAt,
//       user: user ? { name: user.username, email: user.email } : { name: 'Guest', email: null },
//       feedbackContent: {
//         isCorrect: feedbackDoc.is_correct,
//         userSubmittedLabel: feedbackDoc.user_submitted_label,
//         notes: feedbackDoc.notes,
//       },
//       aiPrediction: prediction?.predictions?.[0]
//         ? { class: prediction.predictions[0].class, confidence: prediction.predictions[0].confidence }
//         : null,
//       originalMediaUrl: transformedPrediction?.mediaUrl,
//       processedMediaUrl: transformedPrediction?.processedMediaUrl,
//       status: feedbackDoc.status,
//     };
//   }

//     /**
//      * Hàm transform để định dạng lại dữ liệu lịch sử dự đoán cho admin.
//      * @param req Đối tượng Request để xây dựng URL đầy đủ.
//      * @param historyDoc Tài liệu lịch sử dự đoán từ database.
//      */
//   private transformHistoryForAdmin(baseUrl: string, historyDoc: any) {
//     const user = historyDoc.user;
//     const transformedHistory = transformMediaURLs(baseUrl, historyDoc.toObject ? historyDoc.toObject() : historyDoc);

//     return {
//       id: transformedHistory.id,
//       user: user ? { id: user._id, name: user.username, email: user.email } : { id: null, name: 'Guest', email: null },
//       media: {
//         type: transformedHistory.media.type,
//         url: transformedHistory.media.mediaUrl,
//         name: transformedHistory.media.name,
//       },
//       processedMediaUrl: transformedHistory.processedMediaUrl,
//       predictions: (transformedHistory.predictions || []).map((p: any) => ({
//         class: p.class,
//         confidence: p.confidence,
//       })),
//       createdAt: transformedHistory.createdAt,
//       source: transformedHistory.source,
//       feedback: transformedHistory.feedback ? { id: transformedHistory.feedback.toString() } : null,
//     };
//   }

//     /**
//      * Hàm transform để định dạng lại dữ liệu media cho admin.
//      * @param req Đối tượng Request để xây dựng URL đầy đủ.
//      * @param mediaDoc Tài liệu media từ database.
//      */
//   private transformMediaForAdmin(baseUrl: string, mediaDoc: any) {
//     const transformedMedia = transformMediaURLs(baseUrl, mediaDoc.toObject ? mediaDoc.toObject() : mediaDoc);
//     return {
//       id: transformedMedia._id,
//       name: transformedMedia.mediaUrl.split('/').pop(),
//       type: transformedMedia.type.startsWith('image') ? 'image' : 'video',
//       url: transformedMedia.mediaUrl,
//       size: transformedMedia.size,
//       createdAt: transformedMedia.createdAt,
//     };
//   }

//   /**
//    * Tổng hợp dữ liệu cho trang Dashboard của Admin.
//    */
//   public async getDashboardData() {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Lấy 7 ngày bao gồm cả hôm nay

//     const [
//       stats,
//     ] = await Promise.all([
//       PredictionHistoryModel.aggregate([
//         {
//           $facet: {
//             totalPredictions: [{ $count: "count" }],
//             todayPredictions: [{ $match: { createdAt: { $gte: today } } }, { $count: "count" }],
//             weeklyActivity: [
//               { $match: { createdAt: { $gte: sevenDaysAgo } } },
//               { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, predictions: { $sum: 1 } } },
//               { $sort: { _id: 1 } }
//             ],
//             topBreeds: [
//               { $unwind: '$predictions' },
//               { $group: { _id: '$predictions.class', count: { $sum: 1 } } },
//               { $sort: { count: -1 } },
//               { $limit: 5 },
//               { $project: { breed: '$_id', count: 1, _id: 0 } }
//             ]
//           }
//         }
//       ]),
//     ]);

//     const [
//       totalUsers,
//       totalFeedback,
//       correctFeedbackCount,
//       visitsAggregation,
//     ] = await Promise.all([
//       UserModel.countDocuments({ isDeleted: false }),
//       FeedbackModel.countDocuments({ isDeleted: false }),
//       FeedbackModel.countDocuments({ status: 'approved_for_training', isDeleted: false }),
//       AnalyticsEventModel.aggregate([
//         { $match: { eventName: AnalyticsEventName.PAGE_VISIT, date: { $gte: today } } },
//         { $group: { _id: null, total: { $sum: '$count' } } },
//       ]),
//     ]);

//     const totalPredictions = stats[0]?.totalPredictions[0]?.count || 0;
//     const todayPredictions = stats[0]?.todayPredictions[0]?.count || 0;
//     const weeklyActivity = stats[0]?.weeklyActivity || [];
//     const topBreeds = stats[0]?.topBreeds || [];
//     const todayVisits = visitsAggregation[0]?.total || 0;
//     const accuracy = totalFeedback > 0 ? (correctFeedbackCount / totalFeedback) * 100 : 0;

//     const activityMap = new Map(weeklyActivity.map((item: { _id: string; predictions: number }) => [item._id, item.predictions]));
//     const fullWeeklyActivity = [];
//     for (let i = 6; i >= 0; i--) {
//       const d = new Date();
//       d.setDate(d.getDate() - i);
//       const dayString = d.toISOString().split('T')[0];
//       fullWeeklyActivity.push({ day: dayString, predictions: activityMap.get(dayString) || 0, visits: 0 });
//     }

//     return {
//       stats: {
//         totalUsers,
//         totalPredictions,
//         totalFeedback,
//         accuracy: parseFloat(accuracy.toFixed(2)),
//         todayVisits: todayVisits,
//         todayPredictions,
//       },
//       charts: {
//         weeklyActivity: fullWeeklyActivity,
//         topBreeds,
//         accuracyTrend: [],
//       },
//     };
//   }

//   public async getAdminFeedback(baseUrl: string, filters: any, pagination: { page: number; limit: number; }) {
//     const feedbackData = await feedbackService.getAdminFeedbackPageData(filters, pagination);
//     const transformedFeedbacks = feedbackData.feedbacks.data.map((fb: any) => this.transformFeedbackForAdmin(baseUrl, fb as any));
//     return {
//       ...feedbackData,
//       feedbacks: { ...feedbackData.feedbacks, data: transformedFeedbacks },
//     };
//   }

//   public async approveFeedback(baseUrl: string, id: string): Promise<{ message: string; data: any; }> {
//     const updatedFeedback = await feedbackService.approveFeedback(id);
//     return { message: 'Feedback đã được duyệt thành công.', data: this.transformFeedbackForAdmin(baseUrl, updatedFeedback as any) };
//   }

//   public async rejectFeedback(baseUrl: string, id: string): Promise<{ message: string; data: any; }> {
//     const updatedFeedback = await feedbackService.rejectFeedback(id);
//     return { message: 'Feedback đã bị từ chối.', data: this.transformFeedbackForAdmin(baseUrl, updatedFeedback as any) };
//   }

//   /**
//    * Lấy danh sách người dùng và làm giàu dữ liệu.
//    */
//   public async getEnrichedUsers(options: { page?: number, limit?: number, search?: string } = {}): Promise<{ pagination: any; users: any[] }> {
//     const usersResult = await userService.getAll(options);

//     const enrichedUsersPromises = (usersResult.data || []).map(async (user) => {
//       if (!user) return null;

//       const [collectionStats, predictionStats] = await Promise.all([
//         UserCollectionModel.findOne({ user_id: user._id }).lean(),
//         PredictionHistoryModel.aggregate([
//           { $match: { user: user._id } },
//           {
//             $group: {
//               _id: null,
//               total: { $sum: 1 },
//               correct: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] } },
//             },
//           },
//         ]),
//       ]);

//       const totalPredictions = predictionStats[0]?.total || 0;
//       const correctPredictions = predictionStats[0]?.correct || 0;

//       return {
//         id: user.id,
//         name: user.username,
//         email: user.email,
//         role: user.role,
//         createdAt: user.createdAt.toISOString(),
//         stats: {
//           predictions: totalPredictions,
//           collected: collectionStats?.collectedBreeds.length || 0,
//           accuracy: totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0,
//         },
//         status: user.verify ? "active" : "pending_verification",
//       };
//     });

//     const enrichedUsers = await Promise.all(enrichedUsersPromises);

//     // THAY ĐỔI: Lấy thông tin các gói cước để hiển thị
//     const plans = await PlanModel.find({ isDeleted: false });
//     const plansMap = new Map(plans.map(p => [p.slug, p.name]));


//     return {
//       pagination: {
//         total: usersResult.total,
//         page: usersResult.page,
//         limit: usersResult.limit,
//         totalPages: usersResult.totalPages
//       },
//       users: enrichedUsers, // This now contains the fully enriched user data
//     };
//   }

//   /**
//    * Duyệt hệ thống file media ảo cho trang quản lý media.
//    */
//   async browseMedia(baseUrl: string, path: string): Promise<{ directories: DirectoryItem[], media: any[] }> {
//     const parts = path.split("/").filter(Boolean);

//     if (parts.length === 0) {
//       const userDirectoriesFromDB = await DirectoryModel.find({ parent_id: null, creator_id: { $ne: null } })
//         .populate<{ creator_id: UserDoc }>('creator_id', 'username');

//       const directories: DirectoryItem[] = userDirectoriesFromDB
//         .filter((dir) => (dir.creator_id as UserDoc)?.username !== 'guest_uploads' && dir.name !== 'guest_uploads')
//         .map((dir) => {
//           // SỬA LỖI: Thêm type assertion để TypeScript hiểu kiểu dữ liệu
//           const creator = dir.creator_id as UserDoc;
//           return {
//             id: creator?.username || dir.name,
//             name: creator?.username || dir.name,
//             type: "folder",
//           };
//         });

//       directories.push({ id: "guest_uploads", name: "Guest Uploads", type: "folder" });
//       return { directories, media: [] };
//     }

//     const username = parts[0];

//     if (parts.length === 1) {
//       const isGuest = username === 'guest_uploads';
//       const userExists = isGuest || (await UserModel.findOne({ username, isDeleted: false }));
//       if (userExists) {
//         return {
//           directories: [
//             { id: "images", name: "Images", type: "folder" },
//             { id: "videos", name: "Videos", type: "folder" },
//           ],
//           media: [],
//         };
//       }
//     }

//     if (parts.length === 2 && (parts[1] === "images" || parts[1] === "videos")) {
//       const mediaType = parts[1].slice(0, -1);
//       const user = username === 'guest_uploads' ? null : (await UserModel.findOne({ username, isDeleted: false }));
//       if (user || username === 'guest_uploads') {
//         const mediaFiles = await MediaModel.find({ creator_id: user?._id ?? null, type: mediaType }).sort({ createdAt: -1 });
//         return { directories: [], media: mediaFiles.map(m => this.transformMediaForAdmin(baseUrl, m)) };
//       }
//     }
//     throw new NotFoundError(`Path not found: ${path}`);
//   }

//   /**
//    * [Admin] Xóa vĩnh viễn một media file và các bản ghi liên quan.
//    */
//   async deleteMedia(mediaId: string): Promise<{ message: string }> {
//     const media = await MediaModel.findById(mediaId);
//     if (!media) throw new NotFoundError('Không tìm thấy media.');
//     const filePath = path.resolve(media.mediaPath);
//     try {
//       await fs.unlink(filePath);
//     } catch (error: any) {
//       if (error.code !== 'ENOENT') console.error(`Không thể xóa file vật lý: ${filePath}`, error);
//     }
//     const relatedHistories = await PredictionHistoryModel.find({ media: media._id });
//     const historyIds = relatedHistories.map(h => h._id);
//     if (historyIds.length > 0) {
//       await FeedbackModel.deleteMany({ prediction_id: { $in: historyIds } });
//       await PredictionHistoryModel.deleteMany({ _id: { $in: historyIds } });
//     }
//     await media.deleteOne();
//     return { message: `Đã xóa thành công media và ${historyIds.length} bản ghi lịch sử liên quan.` };
//   }

//   public async createUser(data: { username: string; email: string; password: string; role: string; verify: string; }) {
//     const verifyStatus = data.verify === 'active';
//     const newUser = await userService.createUserByAdmin({ ...data, role: data.role as UserRole, verify: verifyStatus });
//     return {
//       success: true,
//       message: 'User created successfully',
//       data: newUser,
//     };
//   }

//   public async updateUser(userId: string, data: { username?: string; email?: string; role?: string; status?: string; }) {
//     const updateData: any = { username: data.username, email: data.email, role: data.role };
//     if (data.status !== undefined) {
//       updateData.verify = data.status === 'active';
//     }
//     const updatedUser = await userService.updateUserById(userId, updateData);
//     return {
//       success: true,
//       message: 'User updated successfully',
//       data: updatedUser,
//     };
//   }

//   /**
//    * Lấy dữ liệu thống kê sử dụng cho trang Usage Tracking.
//    */
//   public async getUsageStats() {
//     const [users, plans] = await Promise.all([
//       UserModel.find({ isDeleted: false }).select('username email plan remainingTokens createdAt').lean(),
//       PlanModel.find({ isDeleted: false }).lean(),
//     ]);

//     const plansMap = new Map(plans.map(p => [p.slug, p]));

//     const usageData = users.map((user) => {
//       const userPlan = plansMap.get(user.plan);
//       return {
//         userId: user._id.toString(),
//         userName: user.username,
//         email: user.email,
//         tokensUsed: (userPlan?.tokenAllotment || 0) - user.remainingTokens,
//         tokensLimit: userPlan?.tokenAllotment || 0,
//         plan: userPlan?.name || user.plan,
//         lastActive: user.createdAt.toISOString(),
//       };
//     });

//     return { usageData, chartData: [] };
//   }

//   public async getModelConfig() {
//     const config = await this.configService.getAiConfig();
//     return {
//       message: 'Lấy cấu hình model thành công.',
//       data: config,
//     };
//   }

//   public async updateModelConfig(modelId: string | undefined, otherConfigData: any) {
//     const promises = [];
//     if (modelId) {
//       promises.push(AIModelService.activateModel(modelId));
//     }
//     if (Object.keys(otherConfigData).length > 0) {
//       promises.push(this.configService.updateAiConfig(otherConfigData));
//     }
//     await Promise.all(promises);
//     const reloadResult = await this.configService.reloadAiService();
//     return {
//       message: 'AI configuration updated and reload triggered successfully.',
//       details: reloadResult.details,
//     };
//   }

//   public async getAdminHistories(baseUrl: string, options: { page?: number; limit?: number; search?: string; }): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number; }; }> {
//     const result = await predictionHistoryService.getAllHistory(options);
//     const transformedHistories = result.histories.map((h: any) => this.transformHistoryForAdmin(baseUrl, h as any));
//     return {
//       data: transformedHistories,
//       pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
//     };
//   }

//     /**
//      * Duyệt hệ thống file ảo để quản lý media.
//      */
//   async browseDirectory(baseUrl: string, path: string, query: any): Promise<BrowseResult> {
//     const parts = path.split("/").filter(Boolean);
//     const { startDate, endDate } = query;

//     const dateQuery: any = {};
//     if (startDate || endDate) {
//       if (startDate) dateQuery.$gte = new Date(startDate);
//       if (endDate) dateQuery.$lte = new Date(endDate);
//     }

//     if (parts.length === 0) {
//       const users = await UserModel.find({ isDeleted: false }).select("username").lean();
//       const directories: DirectoryItem[] = users.map((user) => ({
//         id: user.username,
//         name: user.username,
//         type: "folder",
//       }));
//       directories.push({ id: "guest_predictions", name: "Guest Predictions", type: "folder" });
//       directories.push({ id: "incorrect_predictions", name: "incorrect_predictions", type: "folder" });
//       return { directories, histories: [] };
//     }

//     if (parts[0] === "guest_predictions") {
//       if (parts.length === 1) {
//         return {
//           directories: [
//             { id: "images", name: "images", type: "folder" },
//             { id: "videos", name: "videos", type: "folder" },
//           ],
//           histories: [],
//         };
//       }
//       if (parts.length === 2 && (parts[1] === "images" || parts[1] === "videos")) {
//         const mediaType = parts[1] === "images" ? "image" : "video";
//         const mediaIds = await MediaModel.find({ creator_id: null, type: { $regex: `^${mediaType}/`, $options: 'i' } }).select('_id');
//         const mediaObjectIds = mediaIds.map(m => m._id);
//         const historyQuery: any = { user: null, media: { $in: mediaObjectIds } };
//         if (Object.keys(dateQuery).length > 0) historyQuery.createdAt = dateQuery;
//         const histories = await PredictionHistoryModel.find(historyQuery).populate("media").populate("feedback");
//         return { directories: [], histories: histories.map(h => this.transformHistoryForAdmin(baseUrl, h as any)) as any };
//       }
//     }

//     if (parts[0] === "incorrect_predictions" && parts.length === 1) {
//       const { breed } = query;
//       let feedbackQuery: any = { isCorrect: false };
//       if (breed && breed !== 'all') {
//         feedbackQuery.user_submitted_label = { $regex: `^${breed}$`, $options: 'i' };
//       }
//       const incorrectFeedbacks = await FeedbackModel.find(feedbackQuery).populate({
//         path: 'prediction_id',
//         populate: [{ path: 'media' }, { path: 'feedback' }]
//       });
//       const histories = incorrectFeedbacks.map(fb => fb.prediction_id).filter(Boolean) as unknown as PredictionHistoryDoc[];
//       return { directories: [], histories: histories.map(h => this.transformHistoryForAdmin(baseUrl, h as any)) as any };
//     }

//     if (parts.length === 1) {
//       const username = parts[0];
//       const user = await UserModel.findOne({ username: username, isDeleted: false });
//       if (user) {
//         return {
//           directories: [
//             { id: "images", name: "images", type: "folder" },
//             { id: "videos", name: "videos", type: "folder" },
//           ],
//           histories: [],
//         };
//       }
//     }

//     if (parts.length === 2) {
//       const username = parts[0];
//       const user = await UserModel.findOne({ username: username, isDeleted: false });
//       if (user && (parts[1] === "images" || parts[1] === "videos")) {
//         const mediaType = parts[1] === "images" ? "image" : "video";
//         const mediaIds = await MediaModel.find({ creator_id: user._id, type: mediaType }).select('_id');
//         const mediaObjectIds = mediaIds.map(m => m._id);
//         const historyQuery: any = { user: user._id, media: { $in: mediaObjectIds } };
//         if (Object.keys(dateQuery).length > 0) historyQuery.createdAt = dateQuery;
//         const histories = await PredictionHistoryModel.find(historyQuery).populate("media").populate("feedback");
//         return { directories: [], histories: histories.map(h => this.transformHistoryForAdmin(baseUrl, h as any)) as any };
//       }
//     }

//     throw new NotFoundError(`Path not found: ${path}`);
//   }

//   /**
//    * Lấy các cảnh báo hệ thống, ví dụ như các giống chó mới tiềm năng.
//    */
//   public async getSystemAlerts() {
//     const NEW_BREED_THRESHOLD = 3;
//     const potentialNewBreeds = await FeedbackModel.aggregate([
//       { $match: { status: 'pending_review', user_submitted_label: { $nin: [null, ""] } } },
//       { $group: { _id: "$user_submitted_label", count: { $sum: 1 }, lastReported: { $max: "$createdAt" } } },
//       { $match: { count: { $gte: NEW_BREED_THRESHOLD } } },
//       { $sort: { count: -1 } }
//     ]);
//     return potentialNewBreeds.map((item: any) => ({
//       id: item._id,
//       type: 'new_breed_suggestion',
//       message: `Giống chó '${item._id}' được đề xuất ${item.count} lần.`,
//       lastReported: item.lastReported,
//     }));
//   }

//   public async getAlerts() {
//     const alerts = await this.getSystemAlerts();
//     return { alerts };
//   }

//   public async uploadModel(files: { modelFile: Express.Multer.File[] }, body: any, userId: Types.ObjectId) {
//     if (!files || typeof files !== 'object' || !('modelFile' in files) || !Array.isArray(files.modelFile)) {
//       throw new AppError("Model file is required.");
//     }
//     const data = CreateAIModelSchema.parse(body);
//     const newModel = await AIModelService.uploadAndCreateModel(
//       files as { modelFile: Express.Multer.File[] },
//       data,
//       userId
//     );
//     return { message: "Model uploaded and created successfully.", data: newModel };
//   }

//   public async getPlans(options: { page?: number; limit?: number; search?: string; }) {
//     const plansData = await PlanService.getAllPaginated(options);
//     return plansData;
//   }

//   public async createPlan(planData: any) {
//     const newPlan = await PlanService.create(planData);
//     return { message: "Gói cước đã được tạo thành công.", data: newPlan };
//   }

//   public async updatePlan(id: string, planData: any) {
//     const updatedPlan = await PlanService.update(id, planData);
//     if (!updatedPlan) {
//       throw new NotFoundError("Không tìm thấy gói cước để cập nhật.");
//     }
//     return { message: "Gói cước đã được cập nhật thành công.", data: updatedPlan };
//   }

//   public async deletePlan(id: string) {
//     await PlanService.softDelete(id);
//     return { message: "Yêu cầu xóa gói cước đã được xử lý." };
//   }

//   public async getWikiBreeds(options: { page?: number; limit?: number; search?: string; lang?: 'vi' | 'en'; }) {
//     const result = await wikiService.getAllBreeds(options as any);
//     return result;
//   }

//   public async createWikiBreed(breedData: any, lang: 'vi' | 'en') {
//     const parsedBreedData = CreateBreedSchema.parse(breedData);
//     const newBreed = await wikiService.createBreed(parsedBreedData, lang);
//     return { message: "Giống chó đã được thêm vào Wiki.", data: newBreed };
//   }

//   public async updateWikiBreed(slug: string, breedData: any, lang: 'vi' | 'en') {
//     const parsedBreedData = UpdateBreedSchema.parse(breedData);
//     const updatedBreed = await wikiService.updateBreed(slug, parsedBreedData, lang);
//     return { message: "Thông tin giống chó đã được cập nhật.", data: updatedBreed };
//   }

//   public async deleteWikiBreed(slug: string, lang: 'vi' | 'en') {
//     await wikiService.softDeleteBreed(slug, lang);
//     return { message: "Giống chó đã được xóa (mềm)." };
//   }

//   public async getTransactions(options: { page: number; limit: number; search?: string; status?: string; planId?: string; }) {
//     const transactionsData = await subscriptionService.getAllTransactions(options);
//     return transactionsData;
//   }

//   public async getSubscriptions(options: { page: number; limit: number; search?: string; status?: string; planId?: string; }) {
//     const subscriptionsData = await subscriptionService.getAllSubscriptions(options);
//     return subscriptionsData;
//   }
// }