import express, { Express } from 'express';
import hpp from 'hpp';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import DURATIONS from './src/constants/durations';
import { bootstrap } from './src/routes/index.routes';
import { CORS_ORIGINS } from './src/constants/general';
import { isDevelopment } from './src/utils/generalUtils';
import { xssSanitizer } from './src/middlewares/sanitizeInput';
import globalErrorMiddleware from './src/middlewares/globalErrorMiddleware';
import { mongoSanitizeMiddleware } from './src/middlewares/mongoSanitization';

const app: Express = express();

// Set secure HTTP headers to protect against well-known web vulnerabilities
app.use(helmet());

// Log to the console HTTP requests in development for easier debugging
if (isDevelopment) {
  app.use(morgan('dev'));
}

// Limit repeated requests from the same IP to prevent abuse (rate limiting)
const limiter = rateLimit({
  limit: 10000,
  windowMs: DURATIONS.RATE_LIMIT_WINDOW,
  message: 'Too many requests from this IP. Please try again in one hour',
});
app.use('/api', limiter);

// Enable Cross-Origin Resource Sharing (CORS) to allow frontend apps to access the API
const corsOptions: cors.CorsOptions = {
  origin: CORS_ORIGINS,
  credentials: true,
};
app.use(cors(corsOptions));

// Compress HTTP responses to reduce payload size and improve performance
app.use(compression());

// Parse incoming JSON payloads and populate req.body (limit to 100kb to avoid abuse)
app.use(express.json({ limit: '100kb' }));

// Parse URL-encoded form data (e.g., from HTML forms) with a size limit
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Prevent MongoDB query injection by sanitizing request data
app.use(mongoSanitizeMiddleware);

// Clean user input from malicious HTML/JS to prevent XSS attacks
app.use(xssSanitizer);

// Prevent HTTP Parameter Pollution by removing duplicate query parameters
app.use(
  hpp({
    whitelist: ['role'], // allow 'role' to appear multiple times if needed
  }),
);

// Parse cookies and make them accessible via req.cookies
app.use(cookieParser());

// Load and mount all application routes
bootstrap(app);

// Handle all errors in a centralized middleware
app.use(globalErrorMiddleware);

export default app;
