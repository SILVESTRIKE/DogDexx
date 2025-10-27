import crypto from 'crypto';
import https from 'https';
import { logger } from '../utils/logger.util';

const partnerCode = process.env.MOMO_PARTNER_CODE || "MOMO";
const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";
const secretkey = process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
const hostname = process.env.MOMO_HOSTNAME || 'test-payment.momo.vn';
const path = '/v2/gateway/api/create';

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export const momoService = {

  async createPaymentRequest(amount: number, orderInfo: string, orderId: string, requestId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Thêm các tham số MoMo sẽ trả về vào redirectUrl để frontend có thể xử lý
      // MoMo sẽ tự động nối các tham số như: partnerCode, orderId, requestId, amount, orderInfo, orderType, transId, resultCode, message, payType, responseTime, extraData
      const redirectUrl = `${FRONTEND_URL}/profile?upgrade_status=true`; // Giữ URL đơn giản, MoMo sẽ tự thêm tham số
      const ipnUrl = `${BACKEND_URL}/bff/user/momo-ipn`; // URL để MoMo gọi lại server của bạn
      const requestType = "captureWallet";
      const extraData = ""; // Base64 encoded JSON object, if needed

      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

      const signature = crypto.createHmac('sha256', secretkey)
        .update(rawSignature)
        .digest('hex');

      const requestBody = JSON.stringify({
        partnerCode,
        accessKey,
        requestId,
        amount: amount.toString(),
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature,
        lang: 'vi'
      });

      const options = {
        hostname,
        port: 443,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const req = https.request(options, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            // SỬA LỖI: Chuyển đổi object thành chuỗi JSON để đảm bảo log hiển thị đầy đủ
            logger.info(`[MoMo] Full response from createPaymentRequest for orderId ${orderId}: ${JSON.stringify(response, null, 2)}`);
            if (response.resultCode === 0) {
              logger.info(`[MoMo] Payment request created successfully for orderId: ${orderId}`);
              resolve(response);
            } else {
              logger.error(`[MoMo] Error creating payment request: ${response.message}`, response);
              reject(new Error(response.message));
            }
          } catch (e) {
            logger.error('[MoMo] Failed to parse response from MoMo', e);
            reject(e);
          }
        });
      });

      req.on('error', (e) => {
        logger.error(`[MoMo] Problem with request: ${e.message}`, e);
        reject(e);
      });

      req.write(requestBody);
      req.end();
    });
  },

  /**
   * Verifies the signature of a MoMo IPN (Instant Payment Notification).
   * @param ipnPayload The payload received from MoMo's IPN request.
   * @returns True if the signature is valid, false otherwise.
   */
  verifyIpnSignature(ipnPayload: any): boolean {
    const { signature, ...payload } = ipnPayload;
    if (!signature) {
      logger.warn('[MoMo IPN] Missing signature in IPN payload.');
      return false;
    }
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
    } = ipnPayload;

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const expectedSignature = crypto.createHmac('sha256', secretkey)
      .update(rawSignature)
      .digest('hex');

    logger.info(`[MoMo IPN] Verifying signature. Expected: ${expectedSignature}, Received: ${signature}`);
    return signature === expectedSignature;
  }
};