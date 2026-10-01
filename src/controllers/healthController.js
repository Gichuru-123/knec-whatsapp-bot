function getHealthStatus(req, res) {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}

module.exports = {
  getHealthStatus
};
