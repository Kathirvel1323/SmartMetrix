import { Request, Response } from 'express';

/**
 * Controller to handle health check requests.
 * Confirms that the SmartMetrix backend is running.
 */
export const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    message: 'SmartMetrix backend is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
};
