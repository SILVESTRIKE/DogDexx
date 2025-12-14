import { CommunityPost, CommunityPostDoc, PostType } from "../models/community_post.model";
import { UserModel } from "../models/user.model";
import { emailService } from "./email.service";
import { logger } from "../utils/logger.util";

// Helper: Convert breed name to slug format for consistent comparison
function toSlug(str: string): string {
    return str.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').trim();
}

interface IMatchingCriteria {
    type: PostType;
    breed: string;
    longitude: number; // Kinh độ
    latitude: number;  // Vĩ độ
    distanceInKm?: number;
    authorId?: string; // ID của người tạo post gốc để gửi email
}

export const MatchingService = {
    findPotentialMatches: async function (criteria: IMatchingCriteria): Promise<CommunityPostDoc[]> {
        const targetType = criteria.type === PostType.LOST ? PostType.FOUND : PostType.LOST;
        const distanceInMeters = (criteria.distanceInKm || 10) * 1000;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        try {
            const matches = await CommunityPost.find({
                type: targetType,
                // Query GeoSpatial chuẩn
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: [criteria.longitude, criteria.latitude]
                        },
                        $maxDistance: distanceInMeters
                    }
                },
                // Use breed_slug for exact matching
                "ai_metadata.breed_slug": toSlug(criteria.breed),
                // Time Query
                createdAt: { $gte: thirtyDaysAgo }
            }).limit(10);

            // --- EMAIL NOTIFICATION ---
            if (matches.length > 0 && criteria.authorId) {
                this.sendMatchNotification(criteria, matches).catch(err => {
                    logger.error("[MatchingService] Failed to send notification email:", err);
                });
            }

            return matches;
        } catch (error) {
            console.error("MatchingService Error:", error);
            return [];
        }
    },

    /**
     * Gửi email thông báo cho author khi tìm thấy matches
     */
    sendMatchNotification: async function (criteria: IMatchingCriteria, matches: CommunityPostDoc[]): Promise<void> {
        if (!criteria.authorId) return;

        try {
            const author = await UserModel.findById(criteria.authorId).select("email firstName username");
            if (!author || !author.email) {
                logger.warn(`[MatchingService] Author ${criteria.authorId} has no email, skipping notification.`);
                return;
            }

            const isLost = criteria.type === PostType.LOST;
            const actionText = isLost ? "Tìm thấy" : "Báo mất";
            const subjectEmoji = isLost ? "🔔" : "📢";

            // Build match list HTML
            const matchListHtml = matches.slice(0, 5).map((match, idx) => {
                const thumbnail = match.photos && match.photos.length > 0 ? match.photos[0] : "";
                const address = match.location?.address || "Không rõ địa chỉ";
                const postLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/community/${match._id}`;

                return `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">
                            ${thumbnail ? `<img src="${thumbnail}" alt="Dog" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;" />` : '<div style="width:80px;height:80px;background:#eee;border-radius:8px;"></div>'}
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">
                            <strong>${match.ai_metadata?.breed || "Không rõ giống"}</strong><br/>
                            <span style="color: #666; font-size: 12px;">${address}</span><br/>
                            <a href="${postLink}" style="color: #e53e3e; text-decoration: none; font-weight: bold;">Xem chi tiết →</a>
                        </td>
                    </tr>
                `;
            }).join("");

            const emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #e53e3e;">${subjectEmoji} DOGDEX: ${actionText} ${matches.length} manh mối!</h2>
                    <p>Xin chào <strong>${author.firstName || author.username || "bạn"}</strong>,</p>
                    <p>Hệ thống đã tìm thấy <strong>${matches.length}</strong> bài đăng ${isLost ? "chó được tìm thấy" : "chó bị mất"} phù hợp với giống <strong>${criteria.breed}</strong> trong bán kính ${criteria.distanceInKm || 10}km.</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        ${matchListHtml}
                    </table>

                    ${matches.length > 5 ? `<p style="color: #666;">... và ${matches.length - 5} kết quả khác.</p>` : ""}

                    <p style="margin-top: 20px;">
                        <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/community/lost-found" 
                           style="background: #e53e3e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                            Xem tất cả trên bản đồ Radar
                        </a>
                    </p>

                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
                    <p style="color: #999; font-size: 12px;">Email này được gửi tự động từ hệ thống DOGDEX. Vui lòng không reply.</p>
                </div>
            `;

            await emailService.sendEmail(
                author.email,
                `${subjectEmoji} [DOGDEX] ${matches.length} manh mối cho ${criteria.breed}!`,
                emailContent
            );

            logger.info(`[MatchingService] Sent notification to ${author.email} with ${matches.length} matches.`);

        } catch (error) {
            logger.error("[MatchingService] Email notification error:", error);
        }
    }
};
