import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const imageCompressor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return next();

    const outputBuffer = await sharp(req.file.buffer)
      .resize({ width: 1280, withoutEnlargement: true })
      .webp({ quality: 75 }) // convert everything to WebP for better compression
      .toBuffer();

    // Replace the original buffer and update mimetype
    req.file.buffer = outputBuffer;
    req.file.mimetype = 'image/webp';
    req.file.originalname = req.file.originalname.replace(/\.[^.]+$/, '.webp');

    next();
  } catch (error) {
    console.error('Error compressing image:', error);
    res.status(RESPONSE_STATUSES.SERVER).json({
      message: 'Image compression failed',
      data: null,
    });
  }
};
