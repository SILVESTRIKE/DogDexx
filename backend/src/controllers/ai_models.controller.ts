import { Request, Response, NextFunction } from "express";
import { AIModelService } from "../services/ai_models.service";
import { NotFoundError } from "../errors";
import { ConfigService } from "../services/config.service";
import {
  CreateAIModelSchema,
  UpdateAIModelSchema,
} from "../types/zod/ai_model.zod";
import { AppError } from "../errors";
import { AdminBffService } from "../services/bff/admin.bff.service";
const adminBffService = new AdminBffService();
const configService = new ConfigService();

export class AIModelController {
  static async create(req: Request, res: Response, next: NextFunction) {
    const data = CreateAIModelSchema.parse(req.body);
    const newModel = await AIModelService.create(data, (req as any).user.id);
    res.status(201).json(newModel);
  }

  static async findAll(req: Request, res: Response, next: NextFunction) {
    const models = await AIModelService.findAll();
    res.status(200).json(models);
  }

  static async findById(req: Request, res: Response, next: NextFunction) {
    const model = await AIModelService.findById(req.params.id);
    if (!model) throw new NotFoundError("Model not found");
    res.status(200).json(model);
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    const data = UpdateAIModelSchema.parse(req.body);
    const updatedModel = await AIModelService.update(req.params.id, data);
    if (!updatedModel) throw new NotFoundError("Model not found");
    res.status(200).json(updatedModel);
  }

  static async activate(req: Request, res: Response, next: NextFunction) {
    const modelId = req.params.id;
    const activatedModel = await AIModelService.activateModel(modelId);
    if (!activatedModel) throw new NotFoundError("Model not found");

    // Trigger AI service to reload
    await configService.reloadAiService();

    res.status(200).json({ message: "Model activated successfully and AI service reload triggered.", data: activatedModel });
  }

  /**
   * (Admin) Nhận file model và metadata, sau đó gọi service để upload và tạo bản ghi.
   */

  static async uploadModel(req: Request, res: Response, next: NextFunction) {
    const file = req.file;
    if (!file) {
      throw new AppError("Model file is required.");
    }
    const result = await adminBffService.uploadModel(file, req.body, (req as any).user.id);
    res.status(201).json(result);
  };
}