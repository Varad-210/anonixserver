const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);
  res.status(status).json({ message: err.message || 'Internal server error.' });
};

module.exports = errorHandler;
