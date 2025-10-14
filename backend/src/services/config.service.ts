import { ConfigModel, IConfig } from '../models/config.model';
import axios from 'axios';

const CONFIG_KEY = 'model_thresholds';

export const configService = {
  async getModelConfig(): Promise<IConfig | null> {
    return ConfigModel.findOne({ key: CONFIG_KEY });
  },

  async updateModelConfig(data: Partial<IConfig>): Promise<IConfig> {
    const config = await ConfigModel.findOneAndUpdate(
      { key: CONFIG_KEY },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    );

    // Notify AI service to reload config
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      await axios.post(`${aiServiceUrl}/config/reload`);
      console.log('Successfully notified AI service to reload configuration.');
    } catch (error) {
      console.error('Failed to notify AI service to reload configuration:', error);
    }

    return config;
  },
};
