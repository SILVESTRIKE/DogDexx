// src/models/config.model.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * IConfiguration: Chứa các tham số vận hành (operational parameters) cho MỘT model cụ thể.
 */
export interface IConfiguration extends Document {
  modelId: Types.ObjectId;
  image_conf: number;
  video_conf: number;
  stream_conf: number;
  stream_high_conf: number;
  device: 'cpu' | 'cuda';
}

const ConfigurationSchema: Schema = new Schema(
  {
    modelId: {
      type: Schema.Types.ObjectId,
      ref: 'AIModel',
      required: true,
      unique: true,
    },
    image_conf: { type: Number, default: 0.25, min: 0, max: 1 },
    video_conf: { type: Number, default: 0.5, min: 0, max: 1 },
    stream_conf: { type: Number, default: 0.4, min: 0, max: 1 },
    stream_high_conf: { type: Number, default: 0.8, min: 0, max: 1 },
    device: { type: String, default: 'cpu', enum: ['cpu', 'cuda'] },
  },
  {
    timestamps: true,
    collection: 'configurations',
    toJSON: {
      transform: (doc: any, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

const Configuration = mongoose.model<IConfiguration>(
  'Configuration',
  ConfigurationSchema
);

export default Configuration;