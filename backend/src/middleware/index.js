// src/middleware/index.js — export กลางของ middleware ทั้งหมด (T-012/T-015)
const { logger, log } = require('./logger');
const { validate } = require('./validate');
const { errorHandler, notFoundHandler, HttpError, errorBody } = require('./errorHandler');
const { audit, redactPath } = require('./audit');
const {
  createAuthMiddleware,
  loginRateLimiter,
  recordLoginFailure,
  clearLoginAttempts,
  resetLoginAttempts,
} = require('./auth');

module.exports = {
  logger,
  log,
  validate,
  errorHandler,
  notFoundHandler,
  HttpError,
  errorBody,
  audit,
  redactPath,
  createAuthMiddleware,
  loginRateLimiter,
  recordLoginFailure,
  clearLoginAttempts,
  resetLoginAttempts,
};
