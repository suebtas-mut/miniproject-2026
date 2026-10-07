// src/middleware/index.js — export กลางของ middleware ทั้งหมด (T-012)
const { logger, log } = require('./logger');
const { validate } = require('./validate');
const { errorHandler, notFoundHandler, HttpError } = require('./errorHandler');
const { audit } = require('./audit');

module.exports = { logger, log, validate, errorHandler, notFoundHandler, HttpError, audit };
