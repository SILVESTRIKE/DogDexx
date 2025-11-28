import { DogProfile, DogProfileDoc } from "../models/dog_profile.model";
import { HealthRecord, HealthRecordDoc } from "../models/health_record.model";
import { NotFoundError, NotAuthorizedError } from "../errors"; // Assuming these exist in your project

export class DogService {
    // --- Dog Profile Operations ---

    static async createDog(data: Partial<DogProfileDoc>, ownerId: string): Promise<DogProfileDoc> {
        const dog = await DogProfile.create({
            ...data,
            owner_id: ownerId,
        });
        return dog;
    }

    static async getDogsByOwner(ownerId: string): Promise<DogProfileDoc[]> {
        return await DogProfile.find({ owner_id: ownerId }).sort({ createdAt: -1 });
    }

    static async getDogById(dogId: string): Promise<DogProfileDoc | null> {
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

        Object.assign(dog, updateData);
        await dog.save();
        return dog;
    }

    static async deleteDog(dogId: string, ownerId: string): Promise<void> {
        const dog = await DogProfile.findById(dogId);
        if (!dog) {
            throw new NotFoundError("Dog not found");
        }
        if (dog.owner_id !== ownerId) {
            throw new NotAuthorizedError();
        }

        await dog.deleteOne();
        await HealthRecord.deleteMany({ dog_id: dogId });
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

        const record = await HealthRecord.create({
            dog_id: dogId,
            ...data,
        });
        return record;
    }

    static async getHealthRecords(dogId: string): Promise<HealthRecordDoc[]> {
        // Note: We might want to check ownership here too, or allow public read if lost?
        // For now, assuming standard access.
        return await HealthRecord.find({ dog_id: dogId }).sort({ date: -1 });
    }

    // --- Search Operations ---

    static async searchLostDogs(filters: { breed?: string; color?: string; lat?: number; lng?: number }): Promise<DogProfileDoc[]> {
        const query: any = { isLost: true };

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
