import crypto from 'crypto';
import app from '../server';

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    const requestId =
      (typeof req?.headers?.['x-request-id'] === 'string' && req.headers['x-request-id']) ||
      crypto.randomBytes(6).toString('hex');
    console.error('[Vercel Serverless Invocation Error]', {
      requestId,
      path: req?.url,
      method: req?.method,
      error: err?.message || String(err)
    });
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Moderation service encountered an internal error.',
        code: 'SERVERLESS_INVOCATION_ERROR',
        requestId
      });
    }
  }
}
