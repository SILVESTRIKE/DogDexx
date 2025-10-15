import mongoose, { Schema, Document } from 'mongoose';

export interface IConfiguration extends Document {
  key: string;
  image_conf: number;
  video_conf: number;
  stream_conf: number;
  stream_high_conf: number;
  device: string;
  model_path: string;
  huggingface_repo: string;
}

const ConfigurationSchema: Schema = new Schema({
  key: { type: String, required: true, unique: true},
  image_conf: { type: Number, default: 0.25 },
  video_conf: { type: Number, default: 0.5 },
  stream_conf: { type: Number, default: 0.4 },
  stream_high_conf: { type: Number, default: 0.8 },
  device: { type: String, default: 'cpu', enum: ['cpu', 'cuda'] },
  model_path: { type: String, default: 'models/epoch90.pt' },
  huggingface_repo: { type: String, default: 'HakuDevon/Dog_Breed_ID' },
}, { timestamps: true });


export const ConfigurationModel = mongoose.model<IConfiguration>('configuration', ConfigurationSchema);
