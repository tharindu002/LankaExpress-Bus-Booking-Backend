export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  // Handle MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 400;
    if (err.message && err.message.includes('email')) {
      message = 'An account with this email address already exists.';
    } else if (err.message && err.message.includes('userId')) {
      message = 'Account ID registration conflict. Please try submitting again.';
    } else {
      message = 'Duplicate field value entered. Please use unique details.';
    }
  }

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, message);
  res.status(statusCode).json({
    error: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
