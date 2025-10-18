declare module 'express-fingerprint' {
  import { RequestHandler } from 'express';
  const fingerprint: () => RequestHandler;
  export default fingerprint;
}