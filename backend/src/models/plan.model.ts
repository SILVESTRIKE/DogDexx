import mongoose, { Document, Schema, Types } from "mongoose";

export type PlanDoc = Document & {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  
  tokenAllotment: number;
  
  apiAccess: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const planSchema = new Schema<PlanDoc>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    priceMonthly: { type: Number, required: true, min: 0 },
    priceYearly: { type: Number, required: true, min: 0 },
    
    tokenAllotment: { type: Number, required: true, min: 0 },

    apiAccess: { type: Boolean, required: true, default: false },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "plans",
    toJSON: {
      transform: (doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
      },
    },
  }
);

export const PlanModel = mongoose.model<PlanDoc>(
  "Plan",
  planSchema
);