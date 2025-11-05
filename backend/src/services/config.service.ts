// src/services/config.service.ts

import axios from 'axios';
import { AppError, NotFoundError } from '../errors';
import { ModelTaskType } from '../models/ai_models.model';
import { AIModelService } from './ai_models.service';
import Configuration, { IConfiguration } from '../models/config.model';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export class ConfigService {
  /**
   * Cập nhật một document cấu hình bằng ID của nó.
   */
  public async updateConfig(configId: string, updateData: Partial<IConfiguration>): Promise<IConfiguration | null> {
    const { modelId, ...params } = updateData; // modelId is not updatable this way
    return Configuration.findByIdAndUpdate(configId, { $set: params }, { new: true });
  }

  /**
   * Gộp dữ liệu và gửi yêu cầu reload đến AI service.
   */
  public async reloadAiService(taskType: ModelTaskType): Promise<{ message: string; details?: any }> {
    try {
      const activeModel = await AIModelService.findActiveModelForTask(taskType);
      if (!activeModel || !activeModel.configId) {
        throw new NotFoundError(`No active model or configuration found for task '${taskType}'.`);
      }
      
      const config = activeModel.configId as IConfiguration;

      const payload = {
        model_path: activeModel.path,
        huggingface_repo: activeModel.huggingFaceRepo,
        image_conf: config.image_conf,
        video_conf: config.video_conf,
        stream_conf: config.stream_conf,
        stream_high_conf: config.stream_high_conf,
        device: config.device,
      };

      const response = await axios.post(`${AI_SERVICE_URL}/config/reload`, payload);
      
      if (response.status === 200 && response.data.status === 'ok') {
        return { message: `AI service reloaded successfully.`, details: response.data };
      }
      throw new AppError(`AI service returned an error: ${response.data.message}`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      throw new AppError(`Failed to trigger AI service reload: ${errorMessage}`);
    }
  }
}