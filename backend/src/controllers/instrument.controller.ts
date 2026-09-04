import { Request, Response, NextFunction } from 'express';
import { instrumentService } from '../services/instrument.service';

/**
 * Register a new instrument
 * Access: OWNER (self only) or ADMIN (for a valid OWNER)
 */
export const registerInstrument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const forbiddenFields = [
      'instrumentId',
      'lifecycleHistory',
      'currentCertificate',
      'isArchived',
      'archivedAt',
      'createdBy',
      'updatedBy'
    ];

    for (const field of forbiddenFields) {
      if (req.body[field] !== undefined) {
        delete req.body[field];
      }
    }

    const instrument = await instrumentService.registerInstrument(req.body, req.user!);

    res.status(201).json({
      status: 'success',
      message: 'Instrument registered successfully',
      data: { instrument }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List instruments with pagination and filters
 * Access: OWNER (own only), INSPECTOR and ADMIN (all permitted)
 */
export const listInstruments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, limit, status, city, type, category, includeArchived } = req.query;

    const result = await instrumentService.listInstruments(
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string,
        city: city as string,
        type: type as string,
        category: category as string,
        includeArchived: includeArchived === 'true'
      },
      req.user!
    );

    res.status(200).json({
      status: 'success',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single instrument details by instrumentId
 * Access: OWNER (own only), INSPECTOR and ADMIN (permitted)
 */
export const getInstrumentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instrumentId = String(req.params.instrumentId);
    const instrument = await instrumentService.getInstrumentById(instrumentId, req.user!);

    res.status(200).json({
      status: 'success',
      data: { instrument }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update permitted details of an instrument
 * Access: OWNER (safe editable fields on own), ADMIN (administrative updates)
 */
export const updateInstrument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instrumentId = String(req.params.instrumentId);

    // Strict client override protection
    const forbiddenFields = [
      'instrumentId',
      'owner',
      'lifecycleHistory',
      'createdBy',
      'currentCertificate',
      'isArchived',
      'archivedAt'
    ];

    for (const field of forbiddenFields) {
      if (req.body[field] !== undefined) {
        delete req.body[field];
      }
    }

    const instrument = await instrumentService.updateInstrument(
      instrumentId,
      req.body,
      req.user!
    );

    res.status(200).json({
      status: 'success',
      message: 'Instrument updated successfully',
      data: { instrument }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft-archive an instrument
 * Access: ADMIN only
 */
export const archiveInstrument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instrumentId = String(req.params.instrumentId);
    const instrument = await instrumentService.archiveInstrument(instrumentId, req.user!);

    res.status(200).json({
      status: 'success',
      message: 'Instrument archived successfully',
      data: { instrument }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Digital Instrument Passport
 * Access: OWNER (own only), INSPECTOR and ADMIN (permitted)
 */
export const getPassport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const instrumentId = String(req.params.instrumentId);
    const passport = await instrumentService.getPassport(instrumentId, req.user!);

    res.status(200).json({
      status: 'success',
      data: { passport }
    });
  } catch (error) {
    next(error);
  }
};
