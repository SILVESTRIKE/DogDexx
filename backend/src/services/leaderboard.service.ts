import { UserCollectionModel } from "../models/user_collection.model";
import { redisClient } from "../utils/redis.util";

const CACHE_TTL = 60 * 15; // 15 phút

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarPath?: string;
  role?: string;
  country?: string;
  city?: string;
  totalCollected: number;
  rank: number;
}

export const leaderboardService = {
  async getLeaderboard(
    scope: 'global' | 'country' | 'city',
    value: string | null = null,
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    // 1. Tạo Cache Key
    const cleanValue = value ? value.trim().toUpperCase().replace(/\s+/g, '_') : 'ALL';
    const cacheKey = `leaderboard:${scope}:${cleanValue}:top${limit}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    // 2. Pipeline Aggregation
    const pipeline: any[] = [];
    pipeline.push({ $match: { isDeleted: { $ne: true } } });
    pipeline.push({ $addFields: { collectionSize: { $size: "$collectedBreeds" } } });
    pipeline.push({
      $lookup: {
        from: "users", localField: "user_id", foreignField: "_id", as: "userInfo"
      }
    });
    pipeline.push({ $unwind: "$userInfo" });
    pipeline.push({ $match: { "userInfo.isDeleted": false } });

    // Lọc bỏ người dùng có vai trò 'admin' hoặc 'dev'
    pipeline.push({ $match: { "userInfo.role": { $nin: ["admin", "dev"] } } });

    // Lọc theo Country/City
    if (scope === 'country' && value) {
      pipeline.push({ $match: { "userInfo.country": { $regex: new RegExp(`^${value}$`, 'i') } } });
    } else if (scope === 'city' && value) {
      pipeline.push({ $match: { "userInfo.city": { $regex: new RegExp(`^${value}$`, 'i') } } });
    }

    pipeline.push({ $sort: { collectionSize: -1, updatedAt: 1 } });
    pipeline.push({ $limit: limit });
    pipeline.push({
      $project: {
        _id: 0,
        userId: "$userInfo._id",
        username: "$userInfo.username",
        firstName: "$userInfo.firstName",
        lastName: "$userInfo.lastName",
        avatarPath: "$userInfo.avatarPath",
        role: "$userInfo.role",
        country: "$userInfo.country",
        city: "$userInfo.city",
        totalCollected: "$collectionSize"
      }
    });

    const result = await UserCollectionModel.aggregate(pipeline);

    const leaderboard: LeaderboardEntry[] = result.map((item, index) => ({
      userId: item.userId.toString(),
      username: item.username,
      displayName: (item.firstName && item.lastName) ? `${item.firstName} ${item.lastName}` : item.username,
      avatarPath: item.avatarPath,
      role: item.role,
      country: item.country,
      city: item.city,
      totalCollected: item.totalCollected,
      rank: index + 1
    }));

    if (redisClient) {
      await redisClient.set(cacheKey, JSON.stringify(leaderboard), { EX: CACHE_TTL });
    }

    return leaderboard;
  },

  async getLocations(type: 'country' | 'city'): Promise<string[]> {
    const cacheKey = `leaderboard:locations:${type}`;
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const result = await UserCollectionModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: "users", localField: "user_id", foreignField: "_id", as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },
      { $match: { "userInfo.isDeleted": false } },
      { $group: { _id: type === 'country' ? "$userInfo.country" : "$userInfo.city" } },
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: 1 } }
    ]);

    const locations = result.map(item => item._id);
    if (redisClient) {
      await redisClient.set(cacheKey, JSON.stringify(locations), { EX: 60 * 60 });
    }
    return locations;
  }
};