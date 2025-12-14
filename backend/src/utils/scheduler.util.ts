import cron from "node-cron";
import { usageService } from "../services/usage.service";
import { AnalyticsAggregatorService } from "../services/analytics_summary.service";
import { subscriptionService } from "../services/subscription.service";
import { HealthRecord } from "../models/health_record.model";
import { DogProfile } from "../models/dog_profile.model";
import { UserModel } from "../models/user.model";
import { emailService } from "../services/email.service";
import { logger } from "./logger.util";

const tasks: cron.ScheduledTask[] = [];

export const startSchedulers = () => {
  // Chạy vào 00:00 Chủ Nhật hàng tuần để reset token
  tasks.push(cron.schedule(
    "0 0 * * 0",
    () => {
      usageService.resetAllUsersTokens();
    },
    {
      scheduled: true,
      timezone: "Asia/Ho_Chi_Minh",
    }
  ));
  // Chạy vào 01:00 ngày 1 hàng tháng để tổng hợp dữ liệu
  tasks.push(cron.schedule(
    "0 1 1 * *",
    () => {
      AnalyticsAggregatorService.runMonthlyRollup();
    },
    {
      scheduled: true,
      timezone: "Asia/Ho_Chi_Minh",
    }
  ));

  // Chạy vào 00:00 hàng ngày để kiểm tra gói hết hạn
  tasks.push(cron.schedule(
    "0 0 * * *",
    () => {
      subscriptionService.checkExpiredSubscriptions();
    },
    {
      scheduled: true,
      timezone: "Asia/Ho_Chi_Minh",
    }
  ));

  // Chạy vào 08:00 hàng ngày để nhắc lịch hẹn sức khỏe
  tasks.push(cron.schedule(
    "0 8 * * *",
    () => {
      sendHealthReminders();
    },
    {
      scheduled: true,
      timezone: "Asia/Ho_Chi_Minh",
    }
  ));

  logger.info("[SCHEDULER] All scheduled tasks started");
};

export const stopSchedulers = () => {
  tasks.forEach(task => task.stop());
  logger.info("[SCHEDULER] All scheduled tasks stopped");
};

// --- Health Reminder Logic ---
async function sendHealthReminders() {
  logger.info('[SCHEDULER] Starting health reminder check...');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // Find records with nextDueDate today or tomorrow that haven't been reminded yet
    const upcomingRecords = await HealthRecord.find({
      nextDueDate: {
        $gte: today,
        $lt: dayAfterTomorrow
      },
      reminderSent: { $ne: true }
    });

    logger.info(`[SCHEDULER] Found ${upcomingRecords.length} upcoming health records to remind`);

    for (const record of upcomingRecords) {
      try {
        const dog = await DogProfile.findById(record.dog_id);
        if (!dog) continue;

        const owner = await UserModel.findById(dog.owner_id);
        if (!owner || !owner.email) continue;

        const dueDate = new Date(record.nextDueDate!);
        dueDate.setHours(0, 0, 0, 0);
        const isToday = dueDate.getTime() === today.getTime();
        const urgency = isToday ? 'HÔM NAY' : 'NGÀY MAI';
        const urgencyColor = isToday ? '#dc2626' : '#f59e0b';

        const formattedDate = dueDate.toLocaleDateString('vi-VN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const emailContent = `
          <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 24px;">🐕 DogDex - Nhắc lịch hẹn</h1>
            </div>
            <div style="background: ${urgencyColor}; color: white; padding: 12px; text-align: center;">
              <strong style="font-size: 16px;">⏰ ${urgency}</strong>
            </div>
            <div style="padding: 24px;">
              <p style="color: #374151; margin: 0 0 16px 0;">Xin chào <strong>${owner.firstName || owner.username}</strong>,</p>
              <p style="color: #374151; margin: 0 0 24px 0;">Đây là lời nhắc về lịch hẹn sức khỏe sắp tới cho bé <strong>${dog.name}</strong>:</p>
              <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; border-left: 4px solid ${urgencyColor};">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Thông tin lịch hẹn</p>
                <p style="margin: 0 0 8px 0; color: #111827; font-size: 18px; font-weight: 600;">${record.title}</p>
                <p style="margin: 0 0 4px 0; color: #374151;">📅 <strong>Ngày:</strong> ${formattedDate}</p>
                <p style="margin: 0; color: #374151;">🏥 <strong>Loại:</strong> ${getRecordTypeLabel(record.type)}</p>
              </div>
            </div>
            <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} DogDex 🐕💚</p>
            </div>
          </div>
        `;

        await emailService.sendEmail(
          owner.email,
          `🔔 [DogDex] Nhắc lịch hẹn ${urgency}: ${record.title} - ${dog.name}`,
          emailContent
        );

        await HealthRecord.updateOne({ _id: record._id }, { $set: { reminderSent: true } });
        logger.info(`[SCHEDULER] Sent reminder for record ${record._id} to ${owner.email}`);

      } catch (recordError) {
        logger.error(`[SCHEDULER] Error processing record ${record._id}:`, recordError);
      }
    }

    logger.info('[SCHEDULER] Health reminder check completed');
  } catch (error) {
    logger.error('[SCHEDULER] Error in health reminder:', error);
  }
}

function getRecordTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'vaccine': 'Tiêm chủng', 'checkup': 'Khám định kỳ', 'medicine': 'Thuốc',
    'surgery': 'Phẫu thuật', 'hygiene': 'Vệ sinh', 'other': 'Khác'
  };
  return labels[type] || type;
}
