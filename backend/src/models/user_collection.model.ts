import mongoose, { Schema, Document, Types } from 'mongoose';

export interface CollectedBreed {
  breed_id: Types.ObjectId;
  first_prediction_id: Types.ObjectId;
  collection_count: number;
}

export interface UserCollectionDoc extends Document {
  user_id: Types.ObjectId;
  collectedBreeds: CollectedBreed[];
  isDeleted: boolean;
}

const collectedBreedSchema = new Schema<CollectedBreed>({
  breed_id: { type: Schema.Types.ObjectId, ref: 'DogBreedWiki', required: true },
  first_prediction_id: { type: Schema.Types.ObjectId, ref: 'PredictionHistory', required: true },
  collection_count: { type: Number, default: 1 },
}, { _id: false });

const userCollectionSchema = new Schema<UserCollectionDoc>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  collectedBreeds: [collectedBreedSchema],
  isDeleted: { type: Boolean, default: false, select: false },
}, {
  timestamps: true,
  collection: 'user_collections',
  toJSON: {
    virtuals: true,
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.isDeleted;
    },
  },
  toObject: {
    virtuals: true,
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
    },
  },
});

userCollectionSchema.index({ 'collectedBreeds.breed_id': 1 });

export const UserCollectionModel = mongoose.model<UserCollectionDoc>('UserCollection', userCollectionSchema);