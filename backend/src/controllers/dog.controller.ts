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
            sendQrScanAlert(req, dog, owner).catch(err => {
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
async function sendQrScanAlert(req: Request, dog: any, owner: any) {
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
            // Set key with TTL (auto-expires after 30 min)
            await redisClient.setEx(cacheKey, QR_ALERT_COOLDOWN_SECONDS, Date.now().toString());
        }
    } catch (redisError) {
        console.warn('[QR_ALERT] Redis error, proceeding without rate limit:', redisError);
    }

    // Get scanner IP
    const scannerIp = req.headers['x-forwarded-for'] as string ||
        req.headers['x-real-ip'] as string ||
        req.socket.remoteAddress ||
        'Không xác định';
    const ip = Array.isArray(scannerIp) ? scannerIp[0] : scannerIp.split(',')[0].trim();

    // Get location from IP using free API
    let locationInfo = 'Không xác định được vị trí';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const geoResponse = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon&lang=vi`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        const geoData = await geoResponse.json() as any;

        if (geoData.status === 'success') {
            locationInfo = `${geoData.city || ''}, ${geoData.regionName || ''}, ${geoData.country || ''}`.replace(/^, |, $/g, '');
            if (geoData.lat && geoData.lon) {
                locationInfo += ` (${geoData.lat}, ${geoData.lon})`;
            }
        }
    } catch (geoError) {
        console.warn('[QR_ALERT] Failed to get location from IP:', geoError);
    }

    const scanTime = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'full',
        timeStyle: 'medium'
    });

    const emailContent = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📍 Có người vừa quét mã QR chó của bạn!</h1>
            </div>
            
            <!-- Body -->
            <div style="padding: 24px;">
                <p style="color: #374151; margin: 0 0 16px 0;">
                    Xin chào <strong>${owner.firstName || owner.username}</strong>,
                </p>
                
                <p style="color: #374151; margin: 0 0 24px 0;">
                    Ai đó vừa quét mã QR trên vòng cổ của bé <strong>${dog.name}</strong>! 
                    Đây có thể là dấu hiệu cho thấy bé đang ở gần đó.
                </p>
                
                <!-- Location Card -->
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
                    <p style="margin: 0 0 12px 0; color: #92400e; font-weight: 600; font-size: 16px;">📍 Vị trí ước tính:</p>
                    <p style="margin: 0 0 8px 0; color: #78350f; font-size: 18px; font-weight: bold;">${locationInfo}</p>
                    <p style="margin: 0; color: #92400e; font-size: 13px;">⏰ Thời gian: ${scanTime}</p>
                </div>
                
                <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">
                        <strong>Lưu ý:</strong> Vị trí trên được ước tính từ địa chỉ IP của người quét. 
                        Độ chính xác có thể dao động từ vài trăm mét đến vài km tùy thuộc vào mạng của họ.
                    </p>
                </div>
                
                <p style="color: #374151; margin: 0;">
                    Nếu bạn đang ở gần khu vực đó, hãy thử đến tìm bé nhé! 🏃‍♂️🐕
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} DogDex - Giúp bạn tìm lại thú cưng 🐕💚
                </p>
            </div>
        </div>
    `;

    await emailService.sendEmail(
        owner.email,
        `📍 [DogDex] Có người vừa quét mã QR của ${dog.name}!`,
        emailContent
    );

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

        // Send Email
        const locationStr = location ? `<p>Vị trí: <a href="https://maps.google.com/?q=${location.lat},${location.lng}">${location.address || 'Xem bản đồ'}</a></p>` : '';
        const emailContent = `
            <h2>Thông báo khẩn cấp từ DogDex</h2>
            <p>Xin chào ${owner.firstName || 'bạn'},</p>
            <p>Có người vừa tìm thấy chó của bạn (ID: ${dogId}) và gửi tin nhắn:</p>
            <hr/>
            <p><strong>Người tìm thấy:</strong> ${finderName}</p>
            <p><strong>SĐT liên hệ:</strong> ${finderPhone}</p>
            <p><strong>Lời nhắn:</strong> ${message}</p>
            ${locationStr}
            <hr/>
            <p>Vui lòng liên hệ lại với người tìm thấy ngay nhé!</p>
        `;

        await emailService.sendEmail(owner.email, "⚠️ [DogDex] Có người tìm thấy chó của bạn!", emailContent);

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

        // 5. Notify Owner via Email
        const owner = await UserModel.findById(dog.owner_id);
        if (owner) {
            const evidenceHtml = evidenceUrl ? `<br/><img src="${evidenceUrl}" style="max-width:300px;border-radius:8px;"/><br/>` : '';
            const emailContent = `
                <div style="background:#f0fdf4; padding: 20px; border-radius: 10px; border: 2px solid #22c55e;">
                    <h2 style="color:#166534;">✅ TIN MỪNG: Chó của bạn đã được tìm thấy!</h2>
                    <p>Hệ thống vừa nhận được báo cáo xác thực từ người tìm thấy.</p>
                    <hr/>
                    <p><strong>Người báo tin:</strong> ${parsedContact.name}</p>
                    <p><strong>Số điện thoại:</strong> <a href="tel:${parsedContact.phone}" style="font-size:1.2em; font-weight:bold;">${parsedContact.phone}</a></p>
                    <p><strong>Email:</strong> ${parsedContact.email || 'Không có'}</p>
                    <p><strong>Lời nhắn:</strong> ${parsedContact.message}</p>
                    <p><strong>Phương thức xác thực:</strong> ${verificationType === 'qr' ? 'Quét mã QR (Chính xác 100%)' : 'Chụp ảnh hiện trường'}</p>
                    ${evidenceHtml}
                    <hr/>
                    <p>Hãy liên hệ ngay để đón bé về nhà nhé!</p>
                </div>
            `;
            await emailService.sendEmail(owner.email, "✅ [DogDex] Đã tìm thấy chó của bạn!", emailContent);
        }

        // 6. Send Thank You Email to Finder & Reward Tokens if they have an account
        if (parsedContact.email) {
            // Check if finder has a DogDex account
            const finderAccount = await UserModel.findOne({
                email: parsedContact.email.toLowerCase().trim(),
                isDeleted: false
            });

            let rewardMessage = '';
            if (finderAccount) {
                // Reward 10 tokens
                await UserModel.updateOne(
                    { _id: finderAccount._id },
                    { $inc: { remainingTokens: 10 } }
                );
                rewardMessage = `
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: center;">
                        <p style="font-size: 24px; margin: 0;">🎁</p>
                        <p style="color: #92400e; font-weight: bold; margin: 8px 0 4px 0;">PHẦN THƯỞNG ĐẶC BIỆT!</p>
                        <p style="color: #78350f; margin: 0;">Bạn đã nhận được <strong style="font-size: 1.2em;">+10 tokens</strong> vào tài khoản DogDex của mình!</p>
                    </div>
                `;
            }

            const thankYouEmail = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 32px 24px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🐕 DogDex</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Cảm ơn bạn đã giúp đỡ!</p>
                    </div>
                    
                    <!-- Body -->
                    <div style="padding: 32px 24px;">
                        <h2 style="color: #166534; margin: 0 0 16px 0; font-size: 22px;">💚 Cảm ơn bạn, ${parsedContact.name || 'người bạn tốt bụng'}!</h2>
                        
                        <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0;">
                            Chúng tôi vô cùng biết ơn bạn đã dành thời gian báo cáo việc tìm thấy bé <strong>${dog.name}</strong>! 
                            Nhờ có bạn, một chú chó sẽ sớm được đoàn tụ với gia đình của mình. 🏠
                        </p>
                        
                        <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px 0;">
                            Hành động nhỏ của bạn mang lại niềm vui lớn cho cả người và thú cưng. 
                            Cảm ơn bạn đã là một phần của cộng đồng yêu thương động vật! 🐾
                        </p>
                        
                        ${rewardMessage}
                        
                        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
                            <p style="color: #166534; margin: 0; font-size: 14px;">
                                <strong>Thông tin báo cáo của bạn:</strong><br/>
                                🐕 Chó: ${dog.name} (${dog.breed})<br/>
                                📍 Vị trí: ${parsedLocation.address || 'Không xác định'}<br/>
                                ✅ Xác thực: ${verificationType === 'qr' ? 'Mã QR' : 'AI Camera'}
                            </p>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #f8f9fa; padding: 20px 24px; text-align: center; border-top: 1px solid #e9ecef;">
                        <p style="color: #868e96; font-size: 11px; margin: 0;">
                            © ${new Date().getFullYear()} DogDex. Cùng nhau kết nối yêu thương. 🐕💚<br/>
                            ${finderAccount ? '<a href="https://dogdex.vn" style="color: #22c55e;">Đăng nhập để sử dụng tokens của bạn!</a>' : '<a href="https://dogdex.vn" style="color: #22c55e;">Đăng ký DogDex để nhận thưởng cho lần sau!</a>'}
                        </p>
                    </div>
                </div>
            `;

            try {
                await emailService.sendEmail(
                    parsedContact.email,
                    "💚 [DogDex] Cảm ơn bạn đã giúp tìm chó!" + (finderAccount ? " (+10 Tokens)" : ""),
                    thankYouEmail
                );
            } catch (emailError) {
                console.error("Failed to send thank you email to finder:", emailError);
            }
        }

        res.status(200).send({ message: "Report processed successfully" });

    } catch (error) {
        next(error);
    }
};
