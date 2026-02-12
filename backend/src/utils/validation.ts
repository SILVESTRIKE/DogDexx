import { z } from "zod";
import { PostType, PostStatus } from "../models/community_post.model";

// --- Dog Profile Schemas ---

export const createDogSchema = z.object({
    name: z.string().min(1, "Name is required").max(50),
    breed: z.string().min(1, "Breed is required"),
    birthday: z.string().datetime().optional(), // Expect ISO string from frontend
    gender: z.enum(["male", "female"]),
    avatarPath: z.string().optional(), // Can be partial path or URL
    photos: z.array(z.string()).optional(),
    sterilized: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    attributes: z.object({
        color: z.string().optional(),
        pattern: z.string().optional(),
        size: z.string().optional(),
    }).optional(),
});

export const updateDogSchema = createDogSchema.partial().extend({
    isLost: z.boolean().optional(),
    lostAt: z.string().datetime().optional(),
    lastSeenLocation: z.object({
        lat: z.number(),
        lng: z.number(),
        address: z.string(),
    }).optional(),
});

export const contactOwnerSchema = z.object({
    finderName: z.string().min(1, "Name is required"),
    finderPhone: z.string().regex(/^[0-9]{10,15}$/, "Invalid phone number"),
    message: z.string().min(1, "Message is required"),
    location: z.object({
        lat: z.number().optional(),
        lng: z.number().optional(),
        address: z.string().optional(),
    }).optional(),
    dogId: z.string().min(1, "Dog ID is required"),
});

// --- Health Record Schemas ---

export const createHealthRecordSchema = z.object({
    type: z.enum(["vaccine", "checkup", "medicine", "surgery", "hygiene", "other"]),
    title: z.string().min(1, "Title is required"),
    date: z.coerce.date(),
    nextDueDate: z.coerce.date().optional(),
    notes: z.string().optional(),
    vetName: z.string().optional(),
    cost: z.coerce.number().min(0).optional(),
    weight: z.coerce.number().min(0).optional(),
    symptoms: z.string().optional(),
    diagnosis: z.string().optional(),
    attachments: z.array(z.string().url()).optional(),
});

export const updateHealthRecordSchema = createHealthRecordSchema.partial();

// --- Community Post Schemas ---

export const createPostSchema = z.object({
    type: z.nativeEnum(PostType),
    title: z.string().min(5, "Title must be at least 5 characters").max(100),
    content: z.string().min(10, "Content must be at least 10 characters"),
    photos: z.array(z.string().url()).optional(),
    dog_id: z.string().optional(), // ObjectId validation could be added if using a custom validator

    tags: z.object({
        breed: z.string().optional(),
        color: z.string().optional(),
        price: z.number().min(0).optional(),
    }).optional(),

    location: z.object({
        lat: z.number(),
        lng: z.number(),
        address: z.string(),
    }).optional(),

    contact_info: z.object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        facebook: z.string().url().optional(),
    }).refine(data => data.phone || data.email || data.facebook, {
        message: "At least one contact method is required",
    }),
});

export const updatePostSchema = createPostSchema.partial().extend({
    status: z.nativeEnum(PostStatus).optional(),
});
