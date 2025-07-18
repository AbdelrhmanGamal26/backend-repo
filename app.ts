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

// GLOBAL MIDDLEWARES
app.use(helmet());

if (isDevelopment) {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  limit: 100,
  windowMs: DURATIONS.RATE_LIMIT_WINDOW,
  message: 'Too many requests from this IP. Please try again in one hour',
});

app.use('/api', limiter);

const corsOptions: cors.CorsOptions = {
  origin: CORS_ORIGINS,
  credentials: true,
};

app.use(cors(corsOptions));

app.use(compression());

// this middleware helps parsing incoming requests with a JSON payload and makes the resulting object available on req.body
app.use(express.json({ limit: '100kb' }));

app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(mongoSanitizeMiddleware);

app.use(xssSanitizer);

app.use(
  hpp({
    whitelist: ['role'],
  }),
);

app.use(cookieParser());

// APPLICATION ROUTERS
bootstrap(app);

// GLOBAL ERROR HANDLER
app.use(globalErrorMiddleware);

export default app;
