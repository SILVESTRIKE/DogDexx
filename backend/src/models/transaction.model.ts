import { Schema, model, Document, Types } from 'mongoose';

export interface TransactionDoc extends Document {
  orderId: string; // Unique ID for this transaction, sent to MoMo
  user: Types.ObjectId;
  plan: Types.ObjectId;
  subscriptionId?: Types.ObjectId; // ID của subscription mà giao dịch này thuộc về (cho việc gia hạn)
  planSlug: string;
  amount: number;
  billingPeriod: 'monthly' | 'yearly';
  status: 'pending' | 'completed' | 'failed';
  paymentGateway: 'momo';
  gatewayTransactionId?: string; // ID from MoMo after completion
  rawIpnResponse?: string; // Store raw IPN response for debugging
}

const transactionSchema = new Schema<TransactionDoc>({
  orderId: { type: String, required: true, unique: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
  planSlug: { type: String, required: true },
  amount: { type: Number, required: true },
  billingPeriod: { type: String, enum: ['monthly', 'yearly'], required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  paymentGateway: { type: String, enum: ['momo'], required: true },
  gatewayTransactionId: { type: String },
  rawIpnResponse: { type: String },
}, {
  timestamps: true,
});

export const TransactionModel = model<TransactionDoc>('Transaction', transactionSchema);