import { PlainUser } from "../../services/user.service";

interface TrialPayload {
  trialId: string;
  type: 'trial';
}

declare global {
  namespace Express {
    export interface Request {
      user?: PlainUser;
      trial?: TrialPayload;
      fingerprint?: {
        hash: string;
      };
    }
  }
}
