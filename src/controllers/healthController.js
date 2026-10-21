class HealthController {
  getHealth(req, res) {
    return res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }
}

module.exports = new HealthController();
