import { AIModel, AIModelDoc, ModelTaskType } from "../models/ai_models.model";
import {
  CreateAIModelType,
  UpdateAIModelType,
} from "../types/zod/ai_model.zod";
import mongoose, { Types, mongo } from "mongoose";
import { ConflictError } from "../errors";
import { uploadFile } from '@huggingface/hub';
import { AppError } from '../errors';
import { logger } from "../utils/logger.util";
import { PredictionHistoryModel } from "../models/prediction_history.model";
export class AIModelService {
  static async create(
    data: CreateAIModelType,
    creator_id: Types.ObjectId
  ): Promise<AIModelDoc> {
    const newModel = new AIModel({ ...data, creator_id });
    return newModel.save();
  }

  static async update(
    id: string,
    data: UpdateAIModelType
  ): Promise<AIModelDoc | null> {
    return AIModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async findById(id: string): Promise<AIModelDoc | null> {
    return AIModel.findById(id);
  }

  static async findAll(): Promise<any[]> {
    const models = await AIModel.find().sort({ createdAt: -1 }).lean();

    const stats = await PredictionHistoryModel.aggregate([
      {
        $group: {
          _id: "$modelUsed",
          avgProcessingTime: { $avg: "$processingTime" }
        }
      }
    ]);

    const statsMap = new Map(stats.map(s => [s._id, s.avgProcessingTime]));

    return models.map(model => ({
      ...model,
      id: model._id.toString(),
      averageProcessingTime: Math.round(statsMap.get(model.name) || 0)
    }));
  }

  static async findActiveModelForTask(
    taskType: ModelTaskType
  ): Promise<AIModelDoc | null> {
    const model = await AIModel.findOne({
      taskType: taskType,
      status: "ACTIVE",
    }).sort({ createdAt: -1 });

    return model;
  }

  static async activateModel(modelId: string): Promise<AIModelDoc | null> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const modelToActivate = await AIModel.findById(modelId).session(session);
      if (!modelToActivate) {
        await session.endSession();
        return null;
      }
      await AIModel.updateMany(
        { taskType: modelToActivate.taskType, _id: { $ne: modelId } },
        { $set: { status: "INACTIVE" } },
        { session }
      );

      modelToActivate.status = "ACTIVE";
      const savedModel = await modelToActivate.save({ session });

      await session.commitTransaction();
      return savedModel;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async uploadAndCreateModel(
    modelFile: Express.Multer.File,
    data: CreateAIModelType,
    creator_id: Types.ObjectId
  ): Promise<AIModelDoc> {

    const hfToken = process.env.HUGGINGFACE_TOKEN;
    const repoId = process.env.HUGGINGFACE_REPO_ID;

    if (!hfToken || !repoId) {
      throw new AppError("Hugging Face token or repository ID is not configured in .env file.");
    }

    try {
      logger.info(`Uploading model file '${modelFile.originalname}' to Hugging Face repo '${repoId}'...`);
      await uploadFile({
        credentials: { accessToken: hfToken },
        repo: { type: 'model', name: repoId },
        file: {
          path: data.path,
          content: new Blob([new Uint8Array(modelFile.buffer)]),
        },
      });
      logger.info("Model file uploaded successfully.");
      const newModel = new AIModel({ ...data, creator_id, huggingFaceRepo: repoId, status: 'INACTIVE' }); // Mặc định là INACTIVE
      await newModel.save();
      logger.info(`New AI model record created in DB with ID: ${newModel._id}`);

      return newModel;
    } catch (error: any) {
      logger.error("Error during Hugging Face upload or DB creation:", error);
      throw new AppError(`Failed to upload model: ${error.message}`);
    }
  }
}
