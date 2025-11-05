// src/services/ai_models.service.ts

import mongoose, { Types } from "mongoose";
import { AIModel, AIModelDoc, ModelTaskType, ModelFormatType } from "../models/ai_models.model";
import Configuration from "../models/config.model";
import { AppError, NotFoundError } from "../errors";
import { uploadFile } from "@huggingface/hub";
import {
  CreateAIModelType,
  UpdateAIModelType,
<<<<<<< Updated upstream
} from "../types/zod/ai_models.zod";
import { Types } from "mongoose";
import { NotFoundError } from "../errors";
=======
} from "../types/zod/ai_model.zod";
>>>>>>> Stashed changes

export class AIModelService {
  static async findById(id: string): Promise<AIModelDoc | null> {
    return AIModel.findById(id);
  }

  static async findAll(): Promise<AIModelDoc[]> {
    return AIModel.find({ isDeleted: false }).sort({ createdAt: -1 });
  }

  /**
   * Tạo một bản ghi model mới trong CSDL.
   */
  static async create(
    data: CreateAIModelType,
    creator_id: Types.ObjectId
  ): Promise<AIModelDoc> {
    const newModel = new AIModel({ ...data, creator_id });
    return newModel.save();
  }

  /**
   * Cập nhật thông tin metadata của một model.
   */
  static async update(
    id: string,
    data: UpdateAIModelType
  ): Promise<AIModelDoc | null> {
    const allowedUpdates = ["name", "description", "version"];
    const finalData = Object.keys(data).reduce((acc, key) => {
      if (allowedUpdates.includes(key)) {
        (acc as any)[key] = (data as any)[key];
      }
      return acc;
    }, {});

    return AIModel.findByIdAndUpdate(id, finalData, { new: true });
  }

  /**
   * Kích hoạt một model và tự động tạo config nếu cần.
   */
<<<<<<< Updated upstream
  static async findById(id: string): Promise<AIModelDoc | null> {
    return AIModel.findById(id);
  }

  /**
   * (Admin) Lấy danh sách tất cả các model trong hệ thống.
   */
  static async findAll(): Promise<AIModelDoc[]> {
    return AIModel.find().sort({ createdAt: -1 });
  }

  /**
   * [QUAN TRỌNG] Tìm model đang ở trạng thái `ACTIVE` cho một tác vụ cụ thể.
   * Đây là hàm mà `PredictionService` sẽ gọi.
   * Nếu có nhiều model cùng `ACTIVE` cho một tác vụ, nó sẽ lấy model được tạo gần nhất.
   * @param taskType Loại tác vụ cần tìm model, ví dụ: 'DOG_BREED_CLASSIFICATION'
=======
  static async activateModel(modelId: string): Promise<AIModelDoc> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const modelToActivate = await AIModel.findById(modelId).session(session);
      if (!modelToActivate) throw new NotFoundError("Model not found.");

      await AIModel.updateMany(
        { taskType: modelToActivate.taskType, _id: { $ne: modelId } },
        { $set: { status: "INACTIVE" } },
        { session }
      );

      if (!modelToActivate.configId) {
        const newConfig = new Configuration({ modelId: modelToActivate._id });
        await newConfig.save({ session });
        modelToActivate.configId = newConfig._id as Types.ObjectId;
      }

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

  /**
   * Tìm model đang ACTIVE cho một tác vụ, populate thêm config.
>>>>>>> Stashed changes
   */
  static async findActiveModelForTask(
    taskType: ModelTaskType
  ): Promise<AIModelDoc | null> {
<<<<<<< Updated upstream
    const model = await AIModel.findOne({
      taskType: taskType,
      status: "ACTIVE",
    }).sort({ createdAt: -1 });

    return model;
=======
    return AIModel.findOne({
      taskType,
      status: "ACTIVE",
      isDeleted: false,
    }).populate("configId");
  }

  /**
   * Tải file lên HuggingFace và tạo document model.
   */
  static async uploadAndCreateModel(
    files: { modelFile: Express.Multer.File[] },
    data: CreateAIModelType,
    creator_id: Types.ObjectId
  ): Promise<AIModelDoc> {
    const { modelFile } = files;
    if (!modelFile || modelFile.length === 0)
      throw new AppError("Model file is required.");

    const hfToken = process.env.HUGGINGFACE_TOKEN;
    const repoId = (data as any).huggingFaceRepo || process.env.HUGGINGFACE_REPO_ID;
    if (!hfToken || !repoId)
      throw new AppError("Hugging Face configuration is missing.");

    try {
      // FIX: Tạo một Uint8Array từ Buffer để đảm bảo kiểu tương thích
      const fileContent = new Blob([new Uint8Array(modelFile[0].buffer)]);

      await uploadFile({
        credentials: { accessToken: hfToken },
        repo: { type: "model", name: repoId as string },
        file: {
          path: (data as any).fileName,
          content: fileContent, // Sử dụng đối tượng Blob đã tạo
        },
      });
      return this.create(data as CreateAIModelType, creator_id);
    } catch (error: any) {
      throw new AppError(`Failed to upload model: ${error.message}`);
    }
>>>>>>> Stashed changes
  }
}
