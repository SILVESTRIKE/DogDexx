import dotenv from "dotenv";
import { logger } from "../utils/logger.util";
dotenv.config();

// ============================================
// TYPES & INTERFACES
// ============================================
export type EmailLanguage = 'vi' | 'en';

interface OtpEmailOptions {
  to: string;
  otp: string;
  userName?: string;
  language?: EmailLanguage;
}

interface QrScanAlertOptions {
  to: string;
  ownerName: string;
  dogName: string;
  locationInfo: string;
  scanTime: string;
  language?: EmailLanguage;
}

interface FoundDogNotificationOptions {
  to: string;
  ownerName: string;
  dogId: string;
  finderName: string;
  finderPhone: string;
  finderEmail?: string;
  message?: string;
  location?: { lat: number; lng: number; address?: string };
  verificationType?: 'qr' | 'camera';
  evidenceUrl?: string;
  language?: EmailLanguage;
}

interface ThankFinderOptions {
  to: string;
  finderName: string;
  dogName: string;
  dogBreed: string;
  location?: string;
  verificationType: 'qr' | 'camera';
  hasAccount: boolean;
  language?: EmailLanguage;
}

interface MatchNotificationOptions {
  to: string;
  userName: string;
  breed: string;
  matchCount: number;
  isLost: boolean;
  distanceKm: number;
  matchListHtml: string;
  language?: EmailLanguage;
}

interface HealthReminderOptions {
  to: string;
  ownerName: string;
  dogName: string;
  recordTitle: string;
  recordType: string;
  formattedDate: string;
  isToday: boolean;
  language?: EmailLanguage;
}

interface FeedbackApprovedOptions {
  to: string;
  userName: string;
  breedLabel: string;
  language?: EmailLanguage;
}

interface ContactFormPayload {
  fromEmail: string;
  message: string;
}

// ============================================
// I18N TRANSLATIONS
// ============================================
const translations = {
  vi: {
    common: {
      footer: 'Ứng dụng nhận diện giống chó thông minh bằng AI.',
      autoEmail: 'Email này được gửi tự động, vui lòng không trả lời trực tiếp.',
      ctaViewDetails: 'Xem chi tiết',
      ctaViewAll: 'Xem tất cả',
    },
    passwordReset: {
      subject: '🔐 Đặt lại mật khẩu DogDex',
      greeting: (name: string) => `Xin chào ${name} 👋`,
      intro: 'Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>DogDex</strong> của mình.',
      instruction: 'Vui lòng sử dụng mã xác thực bên dưới để hoàn tất quá trình:',
      otpLabel: 'Mã đặt lại mật khẩu',
      expiry: 'Mã này sẽ hết hạn sau <strong>10 phút</strong>.',
      securityNote: 'Vui lòng không chia sẻ mã này với bất kỳ ai.',
      ignoreNote: 'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.',
    },
    emailVerification: {
      subject: '🔐 Xác thực tài khoản DogDex - Mã OTP của bạn',
      greeting: (name: string) => `Xin chào ${name} 👋`,
      intro: 'Cảm ơn bạn đã đăng ký tài khoản trên <strong>DogDex</strong>!',
      instruction: 'Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã xác thực bên dưới:',
      otpLabel: 'Mã xác thực của bạn',
      expiry: 'Mã này sẽ hết hạn sau <strong>10 phút</strong>.',
      securityNote: 'Vui lòng không chia sẻ mã này với bất kỳ ai.',
      ignoreNote: 'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Tài khoản của bạn sẽ không bị ảnh hưởng.',
    },
    qrScanAlert: {
      subject: (dogName: string) => `📍 [DogDex] Có người vừa quét mã QR của ${dogName}!`,
      title: '📍 Có người vừa quét mã QR chó của bạn!',
      greeting: (name: string) => `Xin chào ${name},`,
      intro: (dogName: string) => `Ai đó vừa quét mã QR trên vòng cổ của bé <strong>${dogName}</strong>! Đây có thể là dấu hiệu cho thấy bé đang ở gần đó.`,
      locationLabel: '📍 Vị trí ước tính:',
      timeLabel: '⏰ Thời gian:',
      note: 'Vị trí trên được ước tính từ địa chỉ IP của người quét. Độ chính xác có thể dao động từ vài trăm mét đến vài km.',
      cta: 'Nếu bạn đang ở gần khu vực đó, hãy thử đến tìm bé nhé! 🏃‍♂️🐕',
    },
    dogFound: {
      subject: '✅ [DogDex] Đã tìm thấy chó của bạn!',
      subjectUrgent: '⚠️ [DogDex] Có người tìm thấy chó của bạn!',
      title: '✅ TIN MỪNG: Chó của bạn đã được tìm thấy!',
      intro: 'Hệ thống vừa nhận được báo cáo xác thực từ người tìm thấy.',
      finderLabel: 'Người báo tin:',
      phoneLabel: 'Số điện thoại:',
      emailLabel: 'Email:',
      messageLabel: 'Lời nhắn:',
      verificationLabel: 'Phương thức xác thực:',
      verificationQr: 'Quét mã QR (Chính xác 100%)',
      verificationCamera: 'Chụp ảnh hiện trường',
      cta: 'Hãy liên hệ ngay để đón bé về nhà nhé!',
    },
    thankFinder: {
      subject: (hasToken: boolean) => `💚 [DogDex] Cảm ơn bạn đã giúp tìm chó!${hasToken ? ' (+10 Tokens)' : ''}`,
      title: (name: string) => `💚 Cảm ơn bạn, ${name}!`,
      intro: (dogName: string) => `Chúng tôi vô cùng biết ơn bạn đã dành thời gian báo cáo việc tìm thấy bé <strong>${dogName}</strong>! Nhờ có bạn, một chú chó sẽ sớm được đoàn tụ với gia đình của mình. 🏠`,
      body: 'Hành động nhỏ của bạn mang lại niềm vui lớn cho cả người và thú cưng. Cảm ơn bạn đã là một phần của cộng đồng yêu thương động vật! 🐾',
      rewardTitle: 'PHẦN THƯỞNG ĐẶC BIỆT!',
      rewardBody: 'Bạn đã nhận được <strong style="font-size: 1.2em;">+10 tokens</strong> vào tài khoản DogDex của mình!',
      reportLabel: 'Thông tin báo cáo của bạn:',
      dogLabel: '🐕 Chó:',
      locationLabel: '📍 Vị trí:',
      verificationLabel: '✅ Xác thực:',
      ctaWithAccount: 'Đăng nhập để sử dụng tokens của bạn!',
      ctaWithoutAccount: 'Đăng ký DogDex để nhận thưởng cho lần sau!',
    },
    matchNotification: {
      subject: (count: number, breed: string) => `🔔 [DOGDEX] ${count} manh mối cho ${breed}!`,
      title: (action: string, count: number) => `${action} ${count} manh mối!`,
      greeting: (name: string) => `Xin chào ${name},`,
      intro: (count: number, type: string, breed: string, distance: number) => `Hệ thống đã tìm thấy <strong>${count}</strong> bài đăng ${type} phù hợp với giống <strong>${breed}</strong> trong bán kính ${distance}km.`,
      lostType: 'chó được tìm thấy',
      foundType: 'chó bị mất',
      lostAction: 'Tìm thấy',
      foundAction: 'Báo mất',
      ctaMap: 'Xem tất cả trên bản đồ Radar',
      unknownBreed: 'Không rõ giống',
      unknownAddress: 'Không rõ địa chỉ',
    },
    healthReminder: {
      subject: (urgency: string, title: string, dogName: string) => `🔔 [DogDex] Nhắc lịch hẹn ${urgency}: ${title} - ${dogName}`,
      title: '🐕 DogDex - Nhắc lịch hẹn',
      today: 'HÔM NAY',
      tomorrow: 'NGÀY MAI',
      greeting: (name: string) => `Xin chào ${name},`,
      intro: (dogName: string) => `Đây là lời nhắc về lịch hẹn sức khỏe sắp tới cho bé <strong>${dogName}</strong>:`,
      infoLabel: 'Thông tin lịch hẹn',
      dateLabel: '📅 Ngày:',
      typeLabel: '🏥 Loại:',
      typeLabels: {
        vaccine: 'Tiêm chủng',
        checkup: 'Khám định kỳ',
        medicine: 'Thuốc',
        surgery: 'Phẫu thuật',
        hygiene: 'Vệ sinh',
        other: 'Khác',
      } as Record<string, string>,
    },
    feedbackThankYou: {
      subject: '🎉 Cảm ơn bạn đã đóng góp cho DogDex!',
      title: 'Cảm ơn bạn đã đóng góp! 🙏',
      greeting: (name: string) => `Xin chào ${name} 👋`,
      intro: (breed: string) => `Chúng tôi đã nhận được phản hồi của bạn cho giống chó <strong>${breed}</strong>.`,
      body: 'Sự đóng góp của bạn rất quý giá và sẽ giúp chúng tôi cải thiện độ chính xác của hệ thống nhận diện giống chó. Cảm ơn bạn rất nhiều!',
      reviewNote: 'Phản hồi của bạn sẽ được đội ngũ của chúng tôi xem xét và sử dụng để huấn luyện AI tốt hơn.',
      closing: 'Cảm ơn bạn đã đồng hành cùng DogDex!',
    },
  },
  en: {
    common: {
      footer: 'Smart Dog Breed Identification App powered by AI.',
      autoEmail: 'This email was sent automatically, please do not reply directly.',
      ctaViewDetails: 'View Details',
      ctaViewAll: 'View All',
    },
    passwordReset: {
      subject: '🔐 Reset Your DogDex Password',
      greeting: (name: string) => `Hello ${name} 👋`,
      intro: 'You have requested to reset your <strong>DogDex</strong> account password.',
      instruction: 'Please use the verification code below to complete the process:',
      otpLabel: 'Password Reset Code',
      expiry: 'This code will expire in <strong>10 minutes</strong>.',
      securityNote: 'Please do not share this code with anyone.',
      ignoreNote: 'If you did not request a password reset, please ignore this email. Your account is still secure.',
    },
    emailVerification: {
      subject: '🔐 Verify Your DogDex Account - Your OTP Code',
      greeting: (name: string) => `Hello ${name} 👋`,
      intro: 'Thank you for signing up for <strong>DogDex</strong>!',
      instruction: 'To complete your registration, please use the verification code below:',
      otpLabel: 'Your Verification Code',
      expiry: 'This code will expire in <strong>10 minutes</strong>.',
      securityNote: 'Please do not share this code with anyone.',
      ignoreNote: 'If you did not make this request, please ignore this email. Your account will not be affected.',
    },
    qrScanAlert: {
      subject: (dogName: string) => `📍 [DogDex] Someone just scanned ${dogName}'s QR code!`,
      title: '📍 Someone just scanned your dog\'s QR code!',
      greeting: (name: string) => `Hello ${name},`,
      intro: (dogName: string) => `Someone just scanned the QR code on <strong>${dogName}</strong>'s collar! This could be a sign that they are nearby.`,
      locationLabel: '📍 Estimated location:',
      timeLabel: '⏰ Time:',
      note: 'The location above is estimated from the scanner\'s IP address. Accuracy may vary from a few hundred meters to several kilometers.',
      cta: 'If you are near that area, try to find them! 🏃‍♂️🐕',
    },
    dogFound: {
      subject: '✅ [DogDex] Your dog has been found!',
      subjectUrgent: '⚠️ [DogDex] Someone found your dog!',
      title: '✅ GREAT NEWS: Your dog has been found!',
      intro: 'We just received a verified report from the finder.',
      finderLabel: 'Finder:',
      phoneLabel: 'Phone:',
      emailLabel: 'Email:',
      messageLabel: 'Message:',
      verificationLabel: 'Verification method:',
      verificationQr: 'QR Code Scan (100% accurate)',
      verificationCamera: 'Photo verification',
      cta: 'Contact them immediately to bring your pet home!',
    },
    thankFinder: {
      subject: (hasToken: boolean) => `💚 [DogDex] Thank you for helping find a dog!${hasToken ? ' (+10 Tokens)' : ''}`,
      title: (name: string) => `💚 Thank you, ${name}!`,
      intro: (dogName: string) => `We are deeply grateful that you took the time to report finding <strong>${dogName}</strong>! Thanks to you, a dog will soon be reunited with their family. 🏠`,
      body: 'Your small action brings great joy to both people and pets. Thank you for being part of our animal-loving community! 🐾',
      rewardTitle: 'SPECIAL REWARD!',
      rewardBody: 'You have received <strong style="font-size: 1.2em;">+10 tokens</strong> in your DogDex account!',
      reportLabel: 'Your report information:',
      dogLabel: '🐕 Dog:',
      locationLabel: '📍 Location:',
      verificationLabel: '✅ Verification:',
      ctaWithAccount: 'Log in to use your tokens!',
      ctaWithoutAccount: 'Sign up for DogDex to get rewards next time!',
    },
    matchNotification: {
      subject: (count: number, breed: string) => `🔔 [DOGDEX] ${count} leads found for ${breed}!`,
      title: (action: string, count: number) => `${action} ${count} leads!`,
      greeting: (name: string) => `Hello ${name},`,
      intro: (count: number, type: string, breed: string, distance: number) => `We found <strong>${count}</strong> ${type} posts matching breed <strong>${breed}</strong> within ${distance}km.`,
      lostType: 'found dog',
      foundType: 'lost dog',
      lostAction: 'Found',
      foundAction: 'Lost',
      ctaMap: 'View all on Radar map',
      unknownBreed: 'Unknown breed',
      unknownAddress: 'Unknown address',
    },
    healthReminder: {
      subject: (urgency: string, title: string, dogName: string) => `🔔 [DogDex] Reminder ${urgency}: ${title} - ${dogName}`,
      title: '🐕 DogDex - Health Reminder',
      today: 'TODAY',
      tomorrow: 'TOMORROW',
      greeting: (name: string) => `Hello ${name},`,
      intro: (dogName: string) => `This is a reminder about an upcoming health appointment for <strong>${dogName}</strong>:`,
      infoLabel: 'Appointment Details',
      dateLabel: '📅 Date:',
      typeLabel: '🏥 Type:',
      typeLabels: {
        vaccine: 'Vaccination',
        checkup: 'Regular checkup',
        medicine: 'Medicine',
        surgery: 'Surgery',
        hygiene: 'Hygiene',
        other: 'Other',
      } as Record<string, string>,
    },
    feedbackThankYou: {
      subject: '🎉 Thank you for contributing to DogDex!',
      title: 'Thank you for contributing! 🙏',
      greeting: (name: string) => `Hello ${name} 👋`,
      intro: (breed: string) => `We have received your feedback for the breed <strong>${breed}</strong>.`,
      body: 'Your contribution is invaluable and will help us improve the accuracy of our dog breed identification system. Thank you so much!',
      reviewNote: 'Your feedback will be reviewed by our team and used to train our AI for better accuracy.',
      closing: 'Thank you for being part of the DogDex community!',
    },
  },
};

// ============================================
// EMAIL TEMPLATE BUILDERS
// ============================================
const LOGO_URL = process.env.LOGO_URL || 'https://res.cloudinary.com/dtlp3p1sa/image/upload/public/assets/LogoWebWhite';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function getYear(): number {
  return new Date().getFullYear();
}

function baseTemplate(headerBg: string, headerContent: string, bodyContent: string, footerContent: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);">
      <div style="background: ${headerBg}; padding: 32px 24px; text-align: center;">
        ${headerContent}
      </div>
      <div style="padding: 32px 24px;">
        ${bodyContent}
      </div>
      <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px 24px; text-align: center; border-top: 1px solid #e9ecef;">
        ${footerContent}
      </div>
    </div>
  `;
}

function buildOtpEmailTemplate(otp: string, userName: string, type: 'passwordReset' | 'emailVerification', lang: EmailLanguage = 'vi'): { subject: string; html: string } {
  const t = translations[lang][type];
  const c = translations[lang].common;

  const headerContent = `
    <img src="${LOGO_URL}" alt="DogDex Logo" style="height: 60px; margin-bottom: 12px;" />
    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; font-weight: 500;">${c.footer}</p>
  `;

  const bodyContent = `
    <h2 style="color: #1a1a2e; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">${t.greeting(userName)}</h2>
    <p style="color: #4a4a4a; line-height: 1.7; margin: 0 0 16px 0; font-size: 15px;">${t.intro}</p>
    <p style="color: #4a4a4a; line-height: 1.7; margin: 0 0 28px 0; font-size: 15px;">${t.instruction}</p>
    <div style="background: linear-gradient(135deg, #f8f9ff 0%, #eef1ff 100%); border: 2px solid #667eea; border-radius: 16px; padding: 28px; text-align: center; margin: 28px 0;">
      <p style="color: #667eea; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">${t.otpLabel}</p>
      <div style="font-size: 42px; font-weight: 700; color: #667eea; letter-spacing: 10px; font-family: 'Courier New', monospace;">${otp}</div>
    </div>
    <div style="background: #f8f9fa; border-radius: 12px; padding: 16px 20px; margin: 24px 0;">
      <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 0;">⏱️ ${t.expiry}<br/>🔒 ${t.securityNote}</p>
    </div>
    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 28px 0;"/>
    <p style="color: #868e96; font-size: 13px; line-height: 1.6; margin: 0;">${t.ignoreNote}</p>
  `;

  const footerContent = `<p style="color: #868e96; font-size: 12px; margin: 0; line-height: 1.6;">© ${getYear()} DogDex. ${c.footer}<br/>${c.autoEmail}</p>`;

  return {
    subject: t.subject,
    html: baseTemplate('linear-gradient(135deg, #667eea 0%, #764ba2 100%)', headerContent, bodyContent, footerContent),
  };
}

function buildQrScanAlertTemplate(options: QrScanAlertOptions): { subject: string; html: string } {
  const lang = options.language || 'vi';
  const t = translations[lang].qrScanAlert;
  const c = translations[lang].common;

  const headerContent = `<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${t.title}</h1>`;

  const bodyContent = `
    <p style="color: #374151; margin: 0 0 16px 0;">${t.greeting(options.ownerName)}</p>
    <p style="color: #374151; margin: 0 0 24px 0;">${t.intro(options.dogName)}</p>
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
      <p style="margin: 0 0 12px 0; color: #92400e; font-weight: 600; font-size: 16px;">${t.locationLabel}</p>
      <p style="margin: 0 0 8px 0; color: #78350f; font-size: 18px; font-weight: bold;">${options.locationInfo}</p>
      <p style="margin: 0; color: #92400e; font-size: 13px;">${t.timeLabel} ${options.scanTime}</p>
    </div>
    <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0; color: #6b7280; font-size: 13px;"><strong>${lang === 'vi' ? 'Lưu ý:' : 'Note:'}</strong> ${t.note}</p>
    </div>
    <p style="color: #374151; margin: 0;">${t.cta}</p>
  `;

  const footerContent = `<p style="color: #9ca3af; font-size: 11px; margin: 0;">© ${getYear()} DogDex - ${lang === 'vi' ? 'Giúp bạn tìm lại thú cưng' : 'Helping you find your pets'} 🐕💚</p>`;

  return {
    subject: t.subject(options.dogName),
    html: baseTemplate('linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', headerContent, bodyContent, footerContent),
  };
}

function buildDogFoundTemplate(options: FoundDogNotificationOptions): { subject: string; html: string } {
  const lang = options.language || 'vi';
  const t = translations[lang].dogFound;
  const c = translations[lang].common;

  const locationHtml = options.location ? `<p><strong>${lang === 'vi' ? 'Vị trí:' : 'Location:'}</strong> <a href="https://maps.google.com/?q=${options.location.lat},${options.location.lng}">${options.location.address || (lang === 'vi' ? 'Xem bản đồ' : 'View map')}</a></p>` : '';
  const evidenceHtml = options.evidenceUrl ? `<br/><img src="${options.evidenceUrl}" style="max-width:300px;border-radius:8px;"/><br/>` : '';
  const verificationText = options.verificationType === 'qr' ? t.verificationQr : t.verificationCamera;

  const bodyContent = `
    <h2 style="color:#166534;">${t.title}</h2>
    <p>${t.intro}</p>
    <hr/>
    <p><strong>${t.finderLabel}</strong> ${options.finderName}</p>
    <p><strong>${t.phoneLabel}</strong> <a href="tel:${options.finderPhone}" style="font-size:1.2em; font-weight:bold;">${options.finderPhone}</a></p>
    <p><strong>${t.emailLabel}</strong> ${options.finderEmail || (lang === 'vi' ? 'Không có' : 'Not provided')}</p>
    <p><strong>${t.messageLabel}</strong> ${options.message || ''}</p>
    <p><strong>${t.verificationLabel}</strong> ${verificationText}</p>
    ${evidenceHtml}
    ${locationHtml}
    <hr/>
    <p>${t.cta}</p>
  `;

  return {
    subject: t.subject,
    html: `<div style="background:#f0fdf4; padding: 20px; border-radius: 10px; border: 2px solid #22c55e;">${bodyContent}</div>`,
  };
}

function buildThankFinderTemplate(options: ThankFinderOptions): { subject: string; html: string } {
  const lang = options.language || 'vi';
  const t = translations[lang].thankFinder;
  const c = translations[lang].common;

  const verificationText = options.verificationType === 'qr' ? (lang === 'vi' ? 'Mã QR' : 'QR Code') : (lang === 'vi' ? 'AI Camera' : 'AI Camera');

  const rewardHtml = options.hasAccount ? `
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: center;">
      <p style="font-size: 24px; margin: 0;">🎁</p>
      <p style="color: #92400e; font-weight: bold; margin: 8px 0 4px 0;">${t.rewardTitle}</p>
      <p style="color: #78350f; margin: 0;">${t.rewardBody}</p>
    </div>
  ` : '';

  const headerContent = `
    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🐕 DogDex</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${lang === 'vi' ? 'Cảm ơn bạn đã giúp đỡ!' : 'Thank you for helping!'}</p>
  `;

  const bodyContent = `
    <h2 style="color: #166534; margin: 0 0 16px 0; font-size: 22px;">${t.title(options.finderName || (lang === 'vi' ? 'người bạn tốt bụng' : 'kind friend'))}</h2>
    <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0;">${t.intro(options.dogName)}</p>
    <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 24px 0;">${t.body}</p>
    ${rewardHtml}
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
      <p style="color: #166534; margin: 0; font-size: 14px;">
        <strong>${t.reportLabel}</strong><br/>
        ${t.dogLabel} ${options.dogName} (${options.dogBreed})<br/>
        ${t.locationLabel} ${options.location || (lang === 'vi' ? 'Không xác định' : 'Unknown')}<br/>
        ${t.verificationLabel} ${verificationText}
      </p>
    </div>
  `;

  const ctaText = options.hasAccount ? t.ctaWithAccount : t.ctaWithoutAccount;
  const footerContent = `
    <p style="color: #868e96; font-size: 11px; margin: 0;">
      © ${getYear()} DogDex. ${lang === 'vi' ? 'Cùng nhau kết nối yêu thương.' : 'Connecting love together.'} 🐕💚<br/>
      <a href="${FRONTEND_URL}" style="color: #22c55e;">${ctaText}</a>
    </p>
  `;

  return {
    subject: t.subject(options.hasAccount),
    html: baseTemplate('linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', headerContent, bodyContent, footerContent),
  };
}

function buildMatchNotificationTemplate(options: MatchNotificationOptions): { subject: string; html: string } {
  const lang = options.language || 'vi';
  const t = translations[lang].matchNotification;
  const c = translations[lang].common;

  const actionText = options.isLost ? t.lostAction : t.foundAction;
  const typeText = options.isLost ? t.lostType : t.foundType;
  const emoji = options.isLost ? '🔔' : '📢';

  const bodyContent = `
    <h2 style="color: #e53e3e;">${emoji} DOGDEX: ${t.title(actionText, options.matchCount)}</h2>
    <p>${t.greeting(options.userName)}</p>
    <p>${t.intro(options.matchCount, typeText, options.breed, options.distanceKm)}</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      ${options.matchListHtml}
    </table>
    ${options.matchCount > 5 ? `<p style="color: #666;">... ${lang === 'vi' ? 'và' : 'and'} ${options.matchCount - 5} ${lang === 'vi' ? 'kết quả khác.' : 'more results.'}</p>` : ''}
    <p style="margin-top: 20px;">
      <a href="${FRONTEND_URL}/community/lost-found" style="background: #e53e3e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        ${t.ctaMap}
      </a>
    </p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
    <p style="color: #999; font-size: 12px;">${c.autoEmail}</p>
  `;

  return {
    subject: t.subject(options.matchCount, options.breed),
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${bodyContent}</div>`,
  };
}

function buildHealthReminderTemplate(options: HealthReminderOptions): { subject: string; html: string } {
  const lang = options.language || 'vi';
  const t = translations[lang].healthReminder;
  const c = translations[lang].common;

  const urgency = options.isToday ? t.today : t.tomorrow;
  const urgencyColor = options.isToday ? '#dc2626' : '#f59e0b';
  const recordTypeLabel = t.typeLabels[options.recordType] || options.recordType;

  const headerContent = `<h1 style="color: #fff; margin: 0; font-size: 24px;">${t.title}</h1>`;
  const urgencyBanner = `<div style="background: ${urgencyColor}; color: white; padding: 12px; text-align: center;"><strong style="font-size: 16px;">⏰ ${urgency}</strong></div>`;

  const bodyContent = `
    <p style="color: #374151; margin: 0 0 16px 0;">${t.greeting(options.ownerName)}</p>
    <p style="color: #374151; margin: 0 0 24px 0;">${t.intro(options.dogName)}</p>
    <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; border-left: 4px solid ${urgencyColor};">
      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">${t.infoLabel}</p>
      <p style="margin: 0 0 8px 0; color: #111827; font-size: 18px; font-weight: 600;">${options.recordTitle}</p>
      <p style="margin: 0 0 4px 0; color: #374151;">${t.dateLabel} ${options.formattedDate}</p>
      <p style="margin: 0; color: #374151;">${t.typeLabel} ${recordTypeLabel}</p>
    </div>
  `;

  const footerContent = `<p style="color: #9ca3af; font-size: 11px; margin: 0;">© ${getYear()} DogDex 🐕💚</p>`;

  const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; text-align: center;">${headerContent}</div>
      ${urgencyBanner}
      <div style="padding: 24px;">${bodyContent}</div>
      <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">${footerContent}</div>
    </div>
  `;

  return {
    subject: t.subject(urgency, options.recordTitle, options.dogName),
    html,
  };
}

function buildFeedbackThankYouTemplate(options: FeedbackApprovedOptions): { subject: string; html: string } {
  const lang = options.language || 'vi';
  const t = translations[lang].feedbackThankYou;
  const c = translations[lang].common;

  const headerContent = `
    <img src="${LOGO_URL}" alt="DogDex Logo" style="height: 60px; margin-bottom: 12px;" />
    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; font-weight: 500;">${t.title}</p>
  `;

  const bodyContent = `
    <h2 style="color: #1a1a2e; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">${t.greeting(options.userName)}</h2>
    <p style="color: #4a4a4a; line-height: 1.7; margin: 0 0 16px 0; font-size: 15px;">${t.intro(options.breedLabel)}</p>
    <p style="color: #4a4a4a; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">${t.body}</p>
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0;">
      <p style="color: #166534; margin: 0 0 8px 0; font-size: 24px;">🐕</p>
      <p style="color: #166534; margin: 0; font-size: 14px; font-weight: 500;">${t.reviewNote}</p>
    </div>
    <p style="color: #4a4a4a; line-height: 1.7; margin: 0; font-size: 15px;">${t.closing}</p>
  `;

  const footerContent = `<p style="color: #868e96; font-size: 12px; margin: 0; line-height: 1.6;">© ${getYear()} DogDex. ${c.footer}<br/>${c.autoEmail}</p>`;

  return {
    subject: t.subject,
    html: baseTemplate('linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', headerContent, bodyContent, footerContent),
  };
}

// ============================================
// EMAIL SENDING FUNCTIONS
// ============================================
/**
 * Hàm gửi email sử dụng Brevo API (HTTP) thay vì SMTP
 * Cách này khắc phục triệt để lỗi Timeout trên Render.
 */
async function sendGenericEmail(
  to: string,
  subject: string,
  content: string
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_FROM || "ctytest8@gmail.com";
  const senderName = "DogBreed Support";

  if (!apiKey) {
    throw new Error("Chưa cấu hình BREVO_API_KEY trong biến môi trường.");
  }

  const url = "https://api.brevo.com/v3/smtp/email";
  
  const body = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: `<html><body>${content}</body></html>`, // Brevo hỗ trợ HTML content
  };

  try {
    logger.info(`[EmailService] Đang gọi API Brevo gửi mail đến: ${to}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error("[EmailService] Brevo API Error:", JSON.stringify(errorData));
      throw new Error(`Lỗi từ Brevo: ${response.statusText}`);
    }

    const data = await response.json();
    logger.info(`[EmailService] Gửi thành công! MessageId: ${data.messageId}`);
  } catch (error) {
    logger.error(`[EmailService] Lỗi kết nối API:`, error);
    throw new Error("Không thể gửi email qua API.");
  }
}

// ============================================
// PUBLIC API FUNCTIONS
// ============================================
async function sendPasswordResetOtp(options: OtpEmailOptions): Promise<void> {
  const { to, otp, userName = 'bạn', language = 'vi' } = options;
  const { subject, html } = buildOtpEmailTemplate(otp, userName, 'passwordReset', language);
  await sendGenericEmail(to, subject, html);
}

async function sendVerificationOtp(options: OtpEmailOptions): Promise<void> {
  const { to, otp, userName = 'bạn', language = 'vi' } = options;
  const { subject, html } = buildOtpEmailTemplate(otp, userName, 'emailVerification', language);
  await sendGenericEmail(to, subject, html);
}

async function sendQrScanAlert(options: QrScanAlertOptions): Promise<void> {
  const { subject, html } = buildQrScanAlertTemplate(options);
  await sendGenericEmail(options.to, subject, html);
}

async function sendDogFoundNotification(options: FoundDogNotificationOptions): Promise<void> {
  const { subject, html } = buildDogFoundTemplate(options);
  await sendGenericEmail(options.to, subject, html);
}

async function sendThankFinderEmail(options: ThankFinderOptions): Promise<void> {
  const { subject, html } = buildThankFinderTemplate(options);
  await sendGenericEmail(options.to, subject, html);
}

async function sendMatchNotification(options: MatchNotificationOptions): Promise<void> {
  const { subject, html } = buildMatchNotificationTemplate(options);
  await sendGenericEmail(options.to, subject, html);
}

async function sendHealthReminder(options: HealthReminderOptions): Promise<void> {
  const { subject, html } = buildHealthReminderTemplate(options);
  await sendGenericEmail(options.to, subject, html);
}

async function sendFeedbackThankYouEmail(options: FeedbackApprovedOptions): Promise<void> {
  const { subject, html } = buildFeedbackThankYouTemplate(options);
  await sendGenericEmail(options.to, subject, html);
}

async function sendContactFormEmail(payload: ContactFormPayload): Promise<void> {
  const receiverEmail = process.env.EMAIL_FROM;
  if (!receiverEmail) return;

  const htmlBody = `
    <h2>Feedback mới</h2>
    <p><strong>Từ:</strong> ${payload.fromEmail}</p>
    <p><strong>Nội dung:</strong></p>
    <pre>${payload.message}</pre>
  `;
  await sendGenericEmail(receiverEmail, `[Feedback] Từ ${payload.fromEmail}`, htmlBody);
}

// ============================================
// EXPORTS
// ============================================
export const emailService = {
  // Base
  sendEmail: sendGenericEmail,

  // OTP Emails
  sendPasswordResetOtp,
  sendVerificationOtp,

  // Lost & Found Emails
  sendQrScanAlert,
  sendDogFoundNotification,
  sendThankFinderEmail,
  sendMatchNotification,

  // Other Emails
  sendHealthReminder,
  sendFeedbackThankYouEmail,
  sendContactFormEmail,
};

// Export types for use in other files
export type {
  OtpEmailOptions,
  QrScanAlertOptions,
  FoundDogNotificationOptions,
  ThankFinderOptions,
  MatchNotificationOptions,
  HealthReminderOptions,
  FeedbackApprovedOptions,
};