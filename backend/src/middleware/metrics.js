import client from 'prom-client';

// Initialize Prometheus registry
const register = new client.Registry();

// Collect Node.js process and runtime default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'taskflow_',
});

// Custom HTTP request counter
const httpRequestCounter = new client.Counter({
  name: 'taskflow_http_requests_total',
  help: 'Total number of HTTP requests processed by TaskFlow API',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Custom HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: 'taskflow_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Custom in-progress requests gauge
const httpRequestsInProgress = new client.Gauge({
  name: 'taskflow_http_requests_in_progress',
  help: 'Current number of HTTP requests being processed',
  labelNames: ['method'],
  registers: [register],
});

/**
 * Normalize route paths to keep metric cardinality low and bounded.
 * Replaces MongoDB ObjectIds, UUIDs, and numeric IDs with ':id'.
 */
function normalizeRoute(req) {
  if (req.baseUrl && req.route?.path) {
    const routePath = typeof req.route.path === 'string' ? req.route.path : req.route.path.toString();
    return `${req.baseUrl}${routePath}`;
  }
  if (req.route?.path) {
    return typeof req.route.path === 'string' ? req.route.path : req.route.path.toString();
  }

  let path = req.path || '/';
  // Strip query string if any
  path = path.split('?')[0];
  // Replace MongoDB 24-hex ObjectIDs
  path = path.replace(/[0-9a-fA-F]{24}/g, ':id');
  // Replace standard UUIDs
  path = path.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, ':id');
  return path;
}

/**
 * Express middleware for tracking Prometheus metrics
 */
export const metricsMiddleware = (req, res, next) => {
  // Skip metric recording on /metrics to avoid scrape amplification
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime();
  httpRequestsInProgress.inc({ method: req.method });

  res.on('finish', () => {
    httpRequestsInProgress.dec({ method: req.method });

    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = normalizeRoute(req);
    const statusCode = res.statusCode ? res.statusCode.toString() : '500';

    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      durationSeconds
    );
  });

  next();
};

/**
 * Controller to expose Prometheus format metrics
 */
export const metricsHandler = async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.status(200).send(metrics);
  } catch (error) {
    res.status(500).send(`Error collecting metrics: ${error.message}`);
  }
};

export { register };
