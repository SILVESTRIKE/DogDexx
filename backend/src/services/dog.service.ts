import { DogProfile, DogProfileDoc } from "../models/dog_profile.model";
import { HealthRecord, HealthRecordDoc } from "../models/health_record.model";
import { NotFoundError, NotAuthorizedError, BadRequestError } from "../errors";
import { uploadToCloudinary } from "../utils/media.util";
import { PostService } from "./post.service";
import { PostType } from "../models/community_post.model";
import { UserModel } from "../models/user.model";
import { PlanModel } from "../models/plan.model";

export class DogService {
    // --- Dog Profile Operations ---

    static async createDog(data: Partial<DogProfileDoc>, ownerId: string): Promise<DogProfileDoc> {
        // Check dog limit based on user's plan
        const user = await UserModel.findById(ownerId);
        if (!user) throw new NotFoundError("User not found");

        const userPlan = await PlanModel.findOne({ slug: user.plan });
        const dogLimit = userPlan?.dogLimit || 1; // Default to 1 if plan not found

        const currentDogCount = await DogProfile.countDocuments({
            owner_id: ownerId,
            isDeleted: { $ne: true }
        });

        if (currentDogCount >= dogLimit) {
            throw new BadRequestError(
                `Gói ${userPlan?.name || 'Free'} chỉ cho phép tối đa ${dogLimit} chú chó. ` +
                `Vui lòng nâng cấp gói để thêm chó mới.`
            );
        }

        const dog = await DogProfile.create({
            ...data,
            owner_id: ownerId,
        });
        return dog;
    }

    static async getDogsByOwner(ownerId: string): Promise<DogProfileDoc[]> {
        return await DogProfile.find({ owner_id: ownerId, isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    }

    static async getDogById(dogId: string): Promise<DogProfileDoc | null> {
        return await DogProfile.findById(dogId);
    }

    static async getPublicDogById(dogId: string): Promise<DogProfileDoc | null> {
        return await DogProfile.findById(dogId);
    }

    static async updateDog(dogId: string, ownerId: string, updateData: Partial<DogProfileDoc>): Promise<DogProfileDoc> {
        const dog = await DogProfile.findById(dogId);
        if (!dog) {
            throw new NotFoundError("Dog not found");
        }
        if (dog.owner_id !== ownerId) {
            throw new NotAuthorizedError();
        }

        // 1. Check if we are marking as found (isLost: true -> false)
        if (dog.isLost && updateData.isLost === false) {
            // Auto resolve related LOST posts
            await PostService.resolvePostsByDogId(dogId);
        }

        Object.assign(dog, updateData);
        await dog.save();
        return dog;
    }

    static async deleteDog(id: string, ownerId: string): Promise<void> {
        const dog = await DogProfile.findById(id);
        if (!dog) throw new NotFoundError("Dog not found");
        if (dog.owner_id !== ownerId) throw new NotAuthorizedError();

        dog.isDeleted = true;
        await dog.save();
    }

    static async reportLost(id: string, ownerId: string, location: { lat: number; lng: number; address: string }, contact: { name: string; phone?: string; email?: string }, req: any, additionalInfo: { title?: string; content?: string } = {}): Promise<DogProfileDoc> {
        const dog = await DogProfile.findById(id);
        if (!dog) throw new NotFoundError("Dog not found");
        if (dog.owner_id !== ownerId) throw new NotAuthorizedError();

        // 1. Update Dog Profile
        dog.isLost = true;
        dog.lastSeenLocation = location;
        dog.lostAt = new Date();
        await dog.save();

        // 2. Create LOST Post automatically
        // Prepare data
        const postData = {
            type: PostType.LOST,
            title: additionalInfo.title || `KHẨN CẤP: Tìm chó lạc ${dog.name} - Giống ${dog.breed}`,
            content: additionalInfo.content || `Bé ${dog.name} bị lạc tại khu vực ${location.address}. \nĐặc điểm: ${dog.attributes.color || 'Không rõ màu'}, ${dog.attributes.size || 'Không rõ kích thước'}. \nGiống: ${dog.breed}. \nXin hãy giúp đỡ!`,
            photos: dog.photos.length > 0 ? dog.photos : (dog.avatarPath ? [dog.avatarPath] : []),
            dog_id: dog._id.toString(),
            location: location,
            contact_info: contact
        };

        // Trusted Metadata (Skip AI check because this comes from our own Profile system)
        const trustedAiMetadata = {
            breed: dog.breed,
            breed_slug: dog.breed.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').trim(),
            confidence: 1.0,
            color: dog.attributes.color
        };

        // Call PostService to create post & trigger matching
        try {
            await PostService.createPost(postData, ownerId, req, trustedAiMetadata);
        } catch (error) {
            console.error("Failed to auto-create LOST post:", error);
            // Don't fail the whole request, just log it. The user status is updated.
        }

        return dog;
    }

    // --- Health Record Operations ---

    static async addHealthRecord(dogId: string, ownerId: string, data: Partial<HealthRecordDoc>): Promise<HealthRecordDoc> {
        const dog = await DogProfile.findById(dogId);
        if (!dog) {
            throw new NotFoundError("Dog not found");
        }
        if (dog.owner_id !== ownerId) {
            throw new NotAuthorizedError();
        }

        // Check health record limit based on user's plan
        const user = await UserModel.findById(ownerId);
        if (!user) throw new NotFoundError("User not found");

        const userPlan = await PlanModel.findOne({ slug: user.plan });
        const recordLimit = userPlan?.healthRecordLimitPerDog || 3; // Default to 3

        const currentRecordCount = await HealthRecord.countDocuments({ dog_id: dogId });

        if (currentRecordCount >= recordLimit) {
            throw new BadRequestError(
                `Gói ${userPlan?.name || 'Free'} chỉ cho phép tối đa ${recordLimit} bản ghi sức khỏe mỗi chó. ` +
                `Vui lòng nâng cấp gói để thêm bản ghi mới.`
            );
        }

        const record = await HealthRecord.create({
            dog_id: dogId,
            ...data,
        });
        return record;
    }

    static async getHealthRecords(dogId: string): Promise<HealthRecordDoc[]> {
        return await HealthRecord.find({ dog_id: dogId }).sort({ date: -1 });
    }

    static async updateHealthRecord(recordId: string, ownerId: string, data: Partial<HealthRecordDoc>): Promise<HealthRecordDoc> {
        // 1. Find Record
        const record = await HealthRecord.findById(recordId);
        if (!record) {
            throw new NotFoundError("Health record not found");
        }

        // 2. Check Ownership (via Dog)
        const dog = await DogProfile.findById(record.dog_id);
        if (!dog) {
            throw new NotFoundError("Associated dog profile not found");
        }
        if (dog.owner_id !== ownerId) {
            throw new NotAuthorizedError("You are not authorized to update this record");
        }

        // 3. Update
        Object.assign(record, data);
        await record.save();
        return record;
    }

    static async deleteHealthRecord(recordId: string, ownerId: string): Promise<void> {
        // 1. Find Record
        const record = await HealthRecord.findById(recordId);
        if (!record) {
            throw new NotFoundError("Health record not found");
        }

        // 2. Check Ownership
        const dog = await DogProfile.findById(record.dog_id);
        if (!dog) {
            // Orphaned record? Just delete or throw?
            // If dog is gone, record technically invalid but let's just delete.
            // But for security, if someone tries to delete a record of a dog that doesn't exist?
            // Let's assume strict consistency or delete anyway.
            await record.deleteOne();
            return;
        }

        if (dog.owner_id !== ownerId) {
            throw new NotAuthorizedError("You are not authorized to delete this record");
        }

        await record.deleteOne();
    }

    // --- Search Operations ---

    static async searchLostDogs(filters: { breed?: string; color?: string; lat?: number; lng?: number }): Promise<DogProfileDoc[]> {
        const query: any = { isLost: true, isDeleted: { $ne: true } };

        if (filters.breed) {
            query.breed = { $regex: filters.breed, $options: "i" };
        }
        if (filters.color) {
            query["attributes.color"] = { $regex: filters.color, $options: "i" };
        }

        // Future: Geo-spatial query

        return await DogProfile.find(query).sort({ updatedAt: -1 }).limit(50);
    }


}
