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
  /**
   * Creates a MoMo payment request for the "Capture Wallet" method.
   * @param amount The amount to be paid.
   * @param orderInfo Information about the order.
   * @param orderId A unique ID for the order.
   * @param requestId A unique ID for the request.
   * @returns A promise that resolves with the payment response from MoMo, including the payUrl.
   */
  async createPaymentRequest(amount: number, orderInfo: string, orderId: string, requestId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const redirectUrl = `${FRONTEND_URL}/profile?upgrade_status=success&orderId=${orderId}`;
      const ipnUrl = `${BACKEND_URL}/api/v1/webhooks/momo`; // URL để MoMo gọi lại server của bạn
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
  }
};