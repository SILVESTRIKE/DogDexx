import { AIModel, AIModelDoc, ModelTaskType } from "../models/ai_models.model";
import {
  CreateAIModelType,
  UpdateAIModelType,
} from "../types/zod/ai_models.zod";
import { Types } from "mongoose";
import { ConflictError } from "../errors";

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
}
