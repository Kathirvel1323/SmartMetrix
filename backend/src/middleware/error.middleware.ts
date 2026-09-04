import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  statusCode?: number;
}

/**
 * Middleware to handle 404 Not Found routes
 */
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    status: 'error',
    message: `Route not found - ${req.method} ${req.originalUrl}`
  });
};

/**
 * Centralized error-handling middleware
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account with this ${field} already exists.`;
  }

  // Handle Mongoose schema validation errors
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e: any) => e.message)
      .join('; ');
  }

  // Handle JSON parsing errors (syntax error in body)
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON request body.';
  }

  // Handle Multer errors (file size limit, file count limit, unexpected fields)
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.message;
  }

  // Internal diagnostic logging (safe from logging user passwords)
  if (statusCode >= 500) {
    console.error(`[Server Error] ${statusCode}:`, err);
    // Generic message for unexpected 500 responses (do not expose raw err.message or stack trace)
    message = 'Internal server error';
  } else {
    console.warn(`[Client Error] ${statusCode} - ${message}`);
  }

  res.status(statusCode).json({
    status: 'error',
    message
  });
};
