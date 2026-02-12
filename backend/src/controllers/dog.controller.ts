import { Request, Response, NextFunction } from "express";
import { DogService } from "../services/dog.service";
import { predictionService } from "../services/prediction.service";
import { emailService } from "../services/email.service";
import { UserModel } from "../models/user.model";
import { DogProfile } from "../models/dog_profile.model";
import { DirectoryService } from "../services/directory.service";
import { DirectoryModel } from "../models/directory.model";
import { CommunityPost } from "../models/community_post.model";
import { NotFoundError } from "../errors";
import { uploadFileToCloudinary, uploadMultipleFilesToCloudinary, transformMediaURLs } from "../utils/media.util";
import path from "path";
import fs from "fs";

// --- Dog Profile Management ---

export const createDog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file = req.file;
        let data = { ...req.body };

        // Handle file upload if present
        if (file) {
            const userDirectory = await DirectoryModel.findOne({ creator_id: req.user!.id, parent_id: null });
            if (!userDirectory) throw new Error("Không tìm thấy thư mục người dùng.");
            await DirectoryService.ensureDirectory("My Dogs", userDirectory._id.toString(), req.user!.id as any);

            const filenameWithoutExt = path.parse(file.originalname).name;
            const uploadResult = await uploadFileToCloudinary(
                file.path,
                `${filenameWithoutExt}_${Date.now()}`,
                'public/uploads/images',
                'image',
                'private'
            );

            data.avatarPath = `${uploadResult.public_id}.${uploadResult.format}`;

            if (file.path && fs.existsSync(file.path)) {
                await fs.promises.unlink(file.path).catch(() => { });
            }
        }



        const dog = await DogService.createDog(data, req.user!.id);
        res.status(201).send(dog);
    } catch (err) {
        next(err);
    }
};

export const getMyDogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dogs = await DogService.getDogsByOwner(req.user!.id);
        const dogsWithUrls = dogs.map(dog => transformMediaURLs(req, dog.toJSON()));
        res.send(dogsWithUrls);
    } catch (err) {
        next(err);
    }
};

// ... (getDog, updateDog, deleteDog skipped for brevity, assumed unchanged in replacement chunk or use multi-replace if strictly replacing createDog)



// --- New Features (Analysis & Public Profile) ---

export const analyzeForCreation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            res.status(400).send({ message: "No file uploaded" });
            return;
        }
        // Ephemeral Prediction (No DB Save)
        const result = await predictionService.makeEphemeralPrediction(req.file, req.user?.id as any);
        res.status(200).send(result);

    } catch (err) {
        next(err);
    }
};
export const getDog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dog = await DogService.getDogById(req.params.id);
        if (!dog) {
            throw new NotFoundError("Dog not found");
        }
        const dogWithUrls = transformMediaURLs(req, dog.toJSON());
        res.send(dogWithUrls);
    } catch (err) {
        next(err);
    }
};

export const updateDog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dog = await DogService.updateDog(req.params.id, req.user!.id, req.body);
        res.send(dog);
    } catch (err) {
        next(err);
    }
};

export const deleteDog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await DogService.deleteDog(req.params.id, req.user!.id);
        res.status(204).send({});
    } catch (error) {
        next(error);
    }
};

export const reportLost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { location, contact, title, content } = req.body;
        // Basic validation
        if (!location || !location.lat || !location.lng || !location.address) {
            return res.status(400).send({ message: "Location (lat, lng, address) is required." });
        }
        if (!contact || !contact.name) {
            return res.status(400).send({ message: "Contact info (name) is required." });
        }

        const dog = await DogService.reportLost(req.params.id, req.user!.id, location, contact, req, { title, content });
        res.status(200).send(dog);
    } catch (error) {
        next(error);
    }
};


// --- Health Records ---

// --- Health Records ---

export const addHealthRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dogId = req.params.dogId;
        const files = req.files as Express.Multer.File[];

        let attachments: string[] = [];
        if (files && files.length > 0) {
            attachments = await uploadMultipleFilesToCloudinary(files, 'health_records');
        }

        const data = {
            ...req.body,
            attachments: attachments,
            cost: req.body.cost ? Number(req.body.cost) : undefined,
            weight: req.body.weight ? Number(req.body.weight) : undefined,
            date: req.body.date ? new Date(req.body.date) : new Date(),
            nextDueDate: req.body.nextDueDate ? new Date(req.body.nextDueDate) : undefined
        };

        const record = await DogService.addHealthRecord(dogId, req.user!.id, data);
        res.status(201).send(record);
    } catch (err) {
        next(err);
    }
};

export const updateHealthRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const recordId = req.params.recordId;
        // Handle potential new file uploads for update? 
        // For simplicity, let's assume update metadata mostly. 
        // If files are sent, we can append or replace. Let's append if sent.

        const files = req.files as Express.Multer.File[];
        let newAttachments: string[] = [];
        if (files && files.length > 0) {
            newAttachments = await uploadMultipleFilesToCloudinary(files, 'health_records');
        }

        const currentData = { ...req.body };
        if (newAttachments.length > 0) {
            currentData.attachments = newAttachments;
        }

        const data = {
            ...currentData,
            cost: req.body.cost ? Number(req.body.cost) : undefined,
            weight: req.body.weight ? Number(req.body.weight) : undefined,
            date: req.body.date ? new Date(req.body.date) : undefined,
            nextDueDate: req.body.nextDueDate ? new Date(req.body.nextDueDate) : undefined
        };
        // Clean undefined
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

        const record = await DogService.updateHealthRecord(recordId, req.user!.id, data);
        res.send(record);
    } catch (err) {
        next(err);
    }
};

export const deleteHealthRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await DogService.deleteHealthRecord(req.params.recordId, req.user!.id);
        res.status(204).send({});
    } catch (err) {
        next(err);
    }
};

export const getHealthRecords = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const records = await DogService.getHealthRecords(req.params.dogId);
        res.send(records);
    } catch (err) {
        next(err);
    }
};

// --- Lost & Found Search ---

export const searchLostDogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { breed, color, lat, lng } = req.query;
        const dogs = await DogService.searchLostDogs({
            breed: breed as string,
            color: color as string,
            lat: lat ? Number(lat) : undefined,
            lng: lng ? Number(lng) : undefined,
        });
        res.send(dogs);
    } catch (err) {
        next(err);
    }
};

export const getPublicDogInfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dog = await DogService.getPublicDogById(req.params.id);
        if (!dog) {
            res.status(404).send({ message: "Dog not found" });
            return;
        }

        const owner = await UserModel.findById(dog.owner_id).select('username avatarUrl avatarPath email firstName');

        let ownerAvatar = null;
        if (owner) {
            const ownerObj = transformMediaURLs(req, owner.toObject());
            ownerAvatar = ownerObj.avatarUrl || ownerObj.avatarPath;
        }

        // ALERT: If dog is lost, send scan notification to owner
        if (dog.isLost && owner && owner.email) {
            sendQrScanAlertEmail(req, dog, owner).catch(err => {
                console.error('[QR_ALERT] Failed to send scan alert:', err);
            });
        }

        let responseData = {
            ...dog.toJSON(),
            showSystemForm: dog.isLost,
            owner_id: dog.owner_id?.toString(),
            ownerName: owner ? owner.username : "Unknown",
            ownerEmail: owner ? owner.email : null,
            ownerAvatar: ownerAvatar
        };

        responseData = transformMediaURLs(req, responseData);

        res.send(responseData);
    } catch (err) {
        next(err);
    }
};

// Rate limiting for QR scan alerts using Redis
const QR_ALERT_COOLDOWN_SECONDS = 30 * 60; // 30 minutes

// Helper function to send QR scan alert email
async function sendQrScanAlertEmail(req: Request, dog: any, owner: any) {
    const dogId = dog._id.toString();
    const cacheKey = `qr_alert:${dogId}`;

    // Check rate limit using Redis
    try {
        const { redisClient } = await import('../utils/redis.util');
        if (redisClient) {
            const lastAlert = await redisClient.get(cacheKey);
            if (lastAlert) {
                console.log(`[QR_ALERT] Skipped (cooldown) for dog ${dogId}`);
                return;
            }
            await redisClient.setEx(cacheKey, QR_ALERT_COOLDOWN_SECONDS, Date.now().toString());
        }
    } catch (redisError) {
        console.warn('[QR_ALERT] Redis error, proceeding without rate limit:', redisError);
    }

    // Get scanner IP
    const scannerIp = req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || req.socket.remoteAddress || 'Unknown';
    const ip = Array.isArray(scannerIp) ? scannerIp[0] : scannerIp.split(',')[0].trim();

    // Get location from IP using free API
    let locationInfo = 'Không xác định được vị trí';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon&lang=vi`, { signal: controller.signal });
        clearTimeout(timeoutId);
        const geoData = await geoResponse.json() as any;
        if (geoData.status === 'success') {
            locationInfo = `${geoData.city || ''}, ${geoData.regionName || ''}, ${geoData.country || ''}`.replace(/^, |, $/g, '');
            if (geoData.lat && geoData.lon) locationInfo += ` (${geoData.lat}, ${geoData.lon})`;
        }
    } catch (geoError) {
        console.warn('[QR_ALERT] Failed to get location from IP:', geoError);
    }

    const scanTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'full', timeStyle: 'medium' });

    await emailService.sendQrScanAlert({
        to: owner.email,
        ownerName: owner.firstName || owner.username,
        dogName: dog.name,
        locationInfo,
        scanTime,
        language: 'vi',
    });

    console.log(`[QR_ALERT] Sent scan alert for dog ${dog._id} to ${owner.email} (IP: ${ip})`);
}

export const contactOwner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { dogId, finderName, finderPhone, message, location } = req.body;

        const dog = await DogProfile.findById(dogId);
        if (!dog) {
            res.status(404).send({ message: "Dog not found" });
            return;
        }

        const owner = await UserModel.findById(dog.owner_id);
        if (!owner) {
            res.status(404).send({ message: "Owner not found" });
            return;
        }

        // Send Email using new consolidated email service
        await emailService.sendDogFoundNotification({
            to: owner.email,
            ownerName: owner.firstName || 'bạn',
            dogId: dogId,
            finderName: finderName,
            finderPhone: finderPhone,
            message: message,
            location: location,
            language: 'vi',
        });

        res.status(200).send({ message: "Email sent to owner successfully" });
    } catch (err) {
        next(err);
    }
};

export const reportFoundWithVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { dogId, verificationType, verificationData, contact, location } = req.body;
        const file = req.file;

        // 1. Validation
        if (!dogId || !contact) {
            return res.status(400).send({ message: "Missing required fields" });
        }

        // Parse JSON strings if from FormData
        const parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
        const parsedContact = typeof contact === 'string' ? JSON.parse(contact) : contact;

        const dog = await DogProfile.findById(dogId);
        if (!dog) {
            return res.status(404).send({ message: "Dog not found" });
        }

        // 2. Handle Verification Logic
        // In a real app, we would process the image with AI or verify the QR code signature.
        // For now, we trust the client logic but enforce file presence for camera mode.
        if (verificationType === 'camera' && !file) {
            return res.status(400).send({ message: "Photo evidence is required for camera verification." });
        }

        // 3. Upload text/image evidence
        let evidenceUrl = "";
        if (file) {
            const uploadResult = await uploadFileToCloudinary(file.path, `verify_${dogId}_${Date.now()}`, 'verification', 'image', 'private');
            evidenceUrl = uploadResult.secure_url;

            // Clean up
            if (fs.existsSync(file.path)) fs.promises.unlink(file.path).catch(() => { });
        }

        // 4. Create "FOUND" Community Post automatically
        // Transform dog to get avatarUrl properly (handling Cloudinary paths)
        const dogWithUrl = transformMediaURLs(req, dog.toJSON());

        const communityPost = new CommunityPost({
            author_id: req.user ? req.user.id : undefined, // Optional for public reporters
            type: "FOUND",
            status: "OPEN",
            title: `[XÁC THỰC] Bé ${dog.name} đã được tìm thấy!`,
            content: `Người tìm thấy: ${parsedContact.name || 'Ẩn danh'}. \nLời nhắn: ${parsedContact.message || 'Không có'}. \n(Tin nhắn được gửi từ báo cáo xác thực)`,
            photos: evidenceUrl ? [evidenceUrl] : (dogWithUrl.avatarUrl ? [dogWithUrl.avatarUrl] : []),
            dog_id: dogId,
            location: {
                type: 'Point',
                coordinates: [Number(parsedLocation.lng), Number(parsedLocation.lat)],
                address: parsedLocation.address
            },
            contact_info: parsedContact,
            ai_metadata: {
                breed: dog.breed, // Display name
                breed_slug: dog.breed.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').trim(), // For matching
                confidence: verificationType === 'qr' ? 1.0 : (Number(req.body.aiConfidence) || 0.8), // QR = 100%, Camera = AI confidence
                verificationType: verificationType // 'camera' or 'qr'
            }
        });

        await communityPost.save();

        // 5. Notify Owner via Email using consolidated email service
        const owner = await UserModel.findById(dog.owner_id);
        if (owner) {
            await emailService.sendDogFoundNotification({
                to: owner.email,
                ownerName: owner.firstName || 'bạn',
                dogId: dogId,
                finderName: parsedContact.name,
                finderPhone: parsedContact.phone,
                finderEmail: parsedContact.email,
                message: parsedContact.message,
                location: parsedLocation,
                verificationType: verificationType,
                evidenceUrl: evidenceUrl,
                language: 'vi',
            });
        }

        // 6. Send Thank You Email to Finder & Reward Tokens if they have an account
        if (parsedContact.email) {
            const finderAccount = await UserModel.findOne({
                email: parsedContact.email.toLowerCase().trim(),
                isDeleted: false
            });

            if (finderAccount) {
                // Reward 10 tokens
                await UserModel.updateOne(
                    { _id: finderAccount._id },
                    { $inc: { remainingTokens: 10 } }
                );
            }

            try {
                await emailService.sendThankFinderEmail({
                    to: parsedContact.email,
                    finderName: parsedContact.name || 'người bạn tốt bụng',
                    dogName: dog.name,
                    dogBreed: dog.breed,
                    location: parsedLocation.address,
                    verificationType: verificationType,
                    hasAccount: !!finderAccount,
                    language: 'vi',
                });
            } catch (emailError) {
                console.error("Failed to send thank you email to finder:", emailError);
            }
        }

        res.status(200).send({ message: "Report processed successfully" });

    } catch (error) {
        next(error);
    }
};
