interface AppErrorInterface {
  message: string;
  statusCode: number;
  status: 'fail' | 'error';
  isOperational: boolean;
  code?: string;
  detail?: string;
}

class AppError extends Error implements AppErrorInterface {
  public statusCode: number;
  public status: 'fail' | 'error';
  public isOperational: boolean;
  public code?: string;
  public detail?: string;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    detail?: string
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;
    this.detail = detail;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
