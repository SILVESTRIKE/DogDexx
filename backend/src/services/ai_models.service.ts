import { AIModel, AIModelDoc, ModelTaskType } from "../models/ai_models.model";
import {
  CreateAIModelType,
  UpdateAIModelType,
} from "../types/zod/ai_model.zod";
import mongoose, { Types, mongo } from "mongoose";
import { ConflictError } from "../errors";
import { uploadFile } from '@huggingface/hub';
import { AppError } from '../errors';
export class AIModelService {
  /**
   * (Admin) Tạo một bản ghi model mới trong CSDL.
   */
  static async create(
    data: CreateAIModelType,
    creator_id: Types.ObjectId
  ): Promise<AIModelDoc> {
    const newModel = new AIModel({ ...data, creator_id });
    return newModel.save();
  }

  /**
   * (Admin) Cập nhật thông tin của một bản ghi model.
   */
  static async update(
    id: string,
    data: UpdateAIModelType
  ): Promise<AIModelDoc | null> {
    return AIModel.findByIdAndUpdate(id, data, { new: true });
  }

  /**
   * (Admin) Lấy thông tin một model bằng ID.
   */
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
   */
  static async findActiveModelForTask(
    taskType: ModelTaskType
  ): Promise<AIModelDoc | null> {
    const model = await AIModel.findOne({
      taskType: taskType,
      status: "ACTIVE",
    }).sort({ createdAt: -1 });

    return model;
  }

  /**
   * [QUAN TRỌNG] Kích hoạt một model và vô hiệu hóa các model khác cùng tác vụ.
   * @param modelId ID của model cần kích hoạt.
   */
  static async activateModel(modelId: string): Promise<AIModelDoc | null> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const modelToActivate = await AIModel.findById(modelId).session(session);
      if (!modelToActivate) {
        // Không cần abort transaction vì không có thay đổi nào được thực hiện
        await session.endSession();
        return null;
      }

      // 1. Vô hiệu hóa tất cả các model khác có cùng taskType trong cùng transaction
      await AIModel.updateMany(
        { taskType: modelToActivate.taskType, _id: { $ne: modelId } },
        { $set: { status: "INACTIVE" } },
        { session }
      );

      // 2. Kích hoạt model được chọn
      modelToActivate.status = "ACTIVE";
      const savedModel = await modelToActivate.save({ session });

      // Nếu tất cả thành công, commit transaction
      await session.commitTransaction();
      return savedModel;
    } catch (error) {
      // Nếu có bất kỳ lỗi nào, abort transaction
      await session.abortTransaction();
      throw error; // Ném lại lỗi để controller xử lý
    } finally {
      // Luôn đảm bảo session được đóng
      session.endSession();
    }
  }

  /**
   * [Admin] Tải model và file labels lên Hugging Face, sau đó tạo bản ghi trong DB.
   * @param modelFile File model (.pt)
   * @param labelsFile File nhãn (.json)
   * @param data Dữ liệu metadata cho model
   * @param creator_id ID của người tải lên
   */
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
      console.log(`Uploading model file '${modelFile.originalname}' to Hugging Face repo '${repoId}'...`);
      // 1. Upload file model
      await uploadFile({
        credentials: { accessToken: hfToken },
        repo: { type: 'model', name: repoId },
        file: {
          path: data.path, // This is the path within the repository
          content: new Blob([new Uint8Array(modelFile.buffer)]), // Convert Buffer to Uint8Array before creating Blob
        },
      });
      console.log("Model file uploaded successfully.");

      // 3. Tạo bản ghi trong CSDL sau khi upload thành công
      const newModel = new AIModel({ ...data, creator_id, huggingFaceRepo: repoId, status: 'INACTIVE' }); // Mặc định là INACTIVE
      await newModel.save();
      console.log(`New AI model record created in DB with ID: ${newModel._id}`);

      return newModel;
    } catch (error: any) {
      console.error("Error during Hugging Face upload or DB creation:", error);
      throw new AppError(`Failed to upload model: ${error.message}`);
    }
  }
}
