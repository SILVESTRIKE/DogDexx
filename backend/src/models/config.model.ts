import mongoose, { Schema, Document } from 'mongoose';

export interface IConfiguration extends Document {
  key: string;
  image_conf: number;
  video_conf: number;
  stream_conf: number;
  stream_high_conf: number;
  device: 'cpu' | 'cuda';
}

const ConfigurationSchema: Schema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    image_conf: { type: Number, default: 0.25 },
    video_conf: { type: Number, default: 0.5 },
    stream_conf: { type: Number, default: 0.4 },
    stream_high_conf: { type: Number, default: 0.8 },
    device: { type: String, default: 'cpu', enum: ['cpu', 'cuda'] },
  },
  {
    autoCreate: true,
    versionKey: false,
    timestamps: true,
    collection: 'configurations', 
  }
);

const Configuration = mongoose.model<IConfiguration>(
  'Configuration',
  ConfigurationSchema
);

export default Configuration;
