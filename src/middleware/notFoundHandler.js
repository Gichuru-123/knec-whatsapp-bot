function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Cannot ${req.method} ${req.originalUrl}`,
      code: 404
    }
  });
}

module.exports = notFoundHandler;
