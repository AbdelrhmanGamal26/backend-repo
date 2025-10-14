import multer from 'multer';
import AppError from './appError';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError('Only image files are allowed!', RESPONSE_STATUSES.BAD_REQUEST));
    }
    cb(null, true);
  },
});
