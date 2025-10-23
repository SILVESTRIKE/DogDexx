import mongoose, { Document, Schema, Types } from "mongoose";

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'pending_approval';
export type BillingPeriod = 'monthly' | 'yearly';

export type SubscriptionDoc = Document & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  planSlug: string;
  provider: 'momo' | 'stripe' | 'napas'; // Cổng thanh toán
  providerSubscriptionId: string; // ID của subscription trên hệ thống của provider
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const subscriptionSchema = new Schema<SubscriptionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    planSlug: { type: String, required: true },
    provider: { type: String, enum: ['momo', 'stripe', 'napas'], required: true },
    providerSubscriptionId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'canceled', 'past_due', 'unpaid', 'trialing', 'pending_approval'], required: true },
    billingPeriod: { type: String, enum: ['monthly', 'yearly'], required: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    canceledAt: { type: Date },
    isDeleted: { type: Boolean, default: false, select: false },
  },
  {
    timestamps: true,
    collection: "subscriptions",
  }
);

export const SubscriptionModel = mongoose.model<SubscriptionDoc>(
  "Subscription",
  subscriptionSchema
);