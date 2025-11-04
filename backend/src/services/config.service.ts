import axios from 'axios';
import Configuration, {
  IConfiguration,
} from '../models/config.model';
import { AIModelService } from './ai_models.service';
import { AppError } from '../errors';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const CONFIG_KEY = 'model_thresholds';

export class ConfigService {
  /**
   * Lấy cấu hình AI hiện tại từ database, bao gồm cả model đang active.
   */
  public async getAiConfig(): Promise<IConfiguration> {
    const configDoc = await Configuration.findOne({ key: CONFIG_KEY });

    if (!configDoc) {
      // Nếu không có config, tạo một cái mặc định và trả về
      console.warn("Configuration not found, creating a default one.");
      return Configuration.create({ key: CONFIG_KEY });
    }
    return configDoc;
  }

  /**
   * Lấy cấu hình đầy đủ để gửi cho AI Service, bao gồm cả model đang active.
   */
  public async getFullConfigForAIService(): Promise<any> {
    const [config, activeModel] = await Promise.all([
      Configuration.findOne({ key: CONFIG_KEY }),
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
    // Không cho phép thay đổi 'key'
    const { key, ...dataToUpdate } = updateData;

    // Việc thay đổi model_path và huggingface_repo giờ được quản lý bởi AIModelService.activateModel
    // Hàm này chỉ cập nhật các ngưỡng và device.
    if (Object.keys(dataToUpdate).length === 0) {
      const currentConfig = await this.getAiConfig();
      return currentConfig;
    }
    
    const updatedConfig = await Configuration.findOneAndUpdate(
      { key: CONFIG_KEY },
      { $set: dataToUpdate },
      { new: true, upsert: true, runValidators: true }
    );

    if (!updatedConfig) {
      // Trường hợp này hiếm khi xảy ra với upsert: true, nhưng vẫn cần để đảm bảo an toàn
      throw new AppError('Could not update or create configuration.');
    }

    return updatedConfig;
  }

  /**
   * Gửi yêu cầu đến AI service để tải lại cấu hình mới.
   */
  public async reloadAiService(): Promise<{ message: string; details?: any }> {
    // Lấy cấu hình đầy đủ, bao gồm cả model đang active
    const [config, activeModel] = await Promise.all([
      this.getAiConfig(),
      AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION")
    ]);

    const payload = {
      ...config.toObject(),
      model_path: activeModel?.fileName,
      huggingface_repo: activeModel?.huggingFaceRepo,
      labels_path: activeModel?.labelsFileName, // Thêm labels_path
    };

    try {
      const response = await axios.post(`${AI_SERVICE_URL}/config/reload`, payload);
      if (response.status === 200 && response.data.status === 'ok') {
        return { message: 'AI service reloaded successfully.', details: response.data };
      }
      throw new AppError(`AI service returned an error: ${response.data.message}`);
    } catch (error: any) {
      console.error('Error reloading AI service:', error.message);
      const errorMessage = error.response?.data?.message || error.message;
      throw new AppError(`Failed to trigger AI service reload: ${errorMessage}`); // 502 Bad Gateway
    }
  }
}
