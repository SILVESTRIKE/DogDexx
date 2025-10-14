import mongoose, { Schema, Document, Types } from 'mongoose';

export interface UserCollectionDoc extends Document {
  user_id: Types.ObjectId; // Liên kết tới User
  breed_id: Types.ObjectId; // Liên kết tới DogBreedWiki
  first_collected_at: Date;
  collection_count: number;
}

const userCollectionSchema = new Schema<UserCollectionDoc>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  breed_id: { type: Schema.Types.ObjectId, ref: 'DogBreedWiki', required: true },
  first_collected_at: { type: Date, default: Date.now },
  collection_count: { type: Number, default: 1 },
}, { timestamps: true, collection: 'user_collections' });

// Rất quan trọng: Đảm bảo một user chỉ có một bản ghi duy nhất cho mỗi giống chó
userCollectionSchema.index({ user_id: 1, breed_id: 1 }, { unique: true });

export const UserCollectionModel = mongoose.model<UserCollectionDoc>('UserCollection', userCollectionSchema);