import axios from 'axios';
import Configuration, {
  IConfiguration,
} from '../models/config.model';
import { AIModelService } from './ai_models.service';
import { CONFIG_KEYS } from '../constants/config.constants';
import { AppError } from '../errors';
import { logger } from '../utils/logger.util';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export class ConfigService {
  /**
   * Lấy cấu hình AI hiện tại từ database, bao gồm cả model đang active.
   */
  public async getAiConfig(): Promise<IConfiguration> {
    const configDoc = await Configuration.findOne({ key: CONFIG_KEYS.MODEL_THRESHOLDS });

    if (!configDoc) {
      logger.warn("Configuration not found, creating a default one.");
      return Configuration.create({ key: CONFIG_KEYS.MODEL_THRESHOLDS });
    }
    return configDoc;
  }

  /**
   * Lấy cấu hình đầy đủ cho trang Admin, bao gồm cả model đang active.
   */
  public async getFullConfigForAdmin(): Promise<any> {
    const [configDoc, activeModel] = await Promise.all([
      this.getAiConfig(),
      AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION")
    ]);

    const configObject = configDoc.toObject();

    if (activeModel) {
      configObject.model_path = activeModel.path;
    }

    return configObject;
  }

  /**
   * Lấy cấu hình đầy đủ để gửi cho AI Service, bao gồm cả model đang active.
   */
  public async getFullConfigForAIService(): Promise<any> {
    const [config, activeModel] = await Promise.all([
      Configuration.findOne({ key: CONFIG_KEYS.MODEL_THRESHOLDS }),
      AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION")
    ]);

    return { ...config?.toObject(), activeModel };
  }

  /**
   * Cập nhật cấu hình AI trong database.
   * @param updateData Dữ liệu cần cập nhật.
   */
  public async updateAiConfig(
    updateData: Partial<IConfiguration>
  ): Promise<IConfiguration> {
    const { key, ...dataToUpdate } = updateData;

    if (Object.keys(dataToUpdate).length === 0) {
      const currentConfig = await this.getAiConfig();
      return currentConfig;
    }

    const updatedConfig = await Configuration.findOneAndUpdate(
      { key: CONFIG_KEYS.MODEL_THRESHOLDS },
      { $set: dataToUpdate },
      { new: true, upsert: true, runValidators: true }
    );

    if (!updatedConfig) {
      throw new AppError('Could not update or create configuration.');
    }

    return updatedConfig;
  }

  /**
   * Gửi yêu cầu đến AI service để tải lại cấu hình mới.
   */
  public async reloadAiService(): Promise<{ message: string; details?: any }> {
    const fullConfig = await this.getFullConfigForAIService();
    const { activeModel, ...config } = fullConfig;

    const payload = {
      ...config,
      model_path: activeModel?.fileName,
      huggingface_repo: activeModel?.huggingFaceRepo,
      labels_path: activeModel?.labelsFileName,
    };

    try {
      const response = await axios.post(`${AI_SERVICE_URL}/config/reload`, payload);
      if (response.status === 200 && response.data.status === 'ok') {
        return { message: 'AI service reloaded successfully.', details: response.data };
      }
      throw new AppError(`AI service returned an error: ${response.data.message}`);
    } catch (error: any) {
      logger.error('Error reloading AI service:', error.message);
      const errorMessage = error.response?.data?.message || error.message;
      throw new AppError(`Failed to trigger AI service reload: ${errorMessage}`); // 502 Bad Gateway
    }
  }
}
