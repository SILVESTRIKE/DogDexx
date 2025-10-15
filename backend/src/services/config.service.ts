import { ConfigurationModel, IConfiguration } from '../models/config.model';
import axios from 'axios';

const CONFIG_KEY = 'model_thresholds';

export const configService = {

  async getModelConfig(): Promise<IConfiguration | null> {
    // Tìm hoặc tạo mới nếu chưa có
    return ConfigurationModel.findOneAndUpdate(
      { key: CONFIG_KEY },
      { $setOnInsert: { key: CONFIG_KEY } },
      { new: true, upsert: true }
    );
  },

  async updateModelConfig(data: Partial<IConfiguration>): Promise<IConfiguration> {
    const config = await ConfigurationModel.findOneAndUpdate(
      { key: CONFIG_KEY },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    );

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      await axios.post(`${aiServiceUrl}/config/reload`);
      console.log('Successfully notified AI service to reload configuration.');
    } catch (error) {
      console.error('Failed to notify AI service to reload configuration:', (error as any).message);
    }

    return config;
  },
};