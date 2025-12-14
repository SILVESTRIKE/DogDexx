import { logger } from '../utils/logger.util';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined in environment variables.");
    }
    await mongoose.connect(mongoUri, {
      dbName: process.env.DB_NAME
    });
    logger.info('MongoDB Connected on:' + mongoUri + ' with DB name: ' + process.env.DB_NAME);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};