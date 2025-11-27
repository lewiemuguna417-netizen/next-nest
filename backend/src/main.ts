import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Create HTTP server for WebSocket support
const httpServer = createServer(app);

// Security middleware
app.use(helmet());

// Dynamic CORS configuration for both development and production
const getAllowedOrigins = () => {
  const origins = [];
  
  // Always allow localhost development (important for local testing with production DB)
  origins.push(
    'http://localhost:8081', 
    'http://127.0.0.1:8081',
    'http://localhost:8082', 
    'http://127.0.0.1:8082'
  );
  
  // Add production URL if specified
  if (process.env.CORS_ORIGIN) {
    origins.push(process.env.CORS_ORIGIN);
  }
  
  return origins;
};

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = getAllowedOrigins();
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: process.env.CORS_METHODS?.split(',') || ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Import routes
import authRoutes from './routes/auth';
import appointmentsRoutes from './routes/appointments';
import usersRoutes from './routes/users';
import AppDataSource from './config/database';
import { WebSocketManager } from './websocket/WebSocketManager';

// Initialize database connection
const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');
    
    // Sync database schema if enabled
    if (process.env.DB_SYNCHRONIZE === 'true') {
      try {
        await AppDataSource.synchronize();
        console.log('✅ Database schema synchronized');
      } catch (syncError: any) {
        console.warn('⚠️ Database schema synchronization failed:', syncError.message);
        console.log('📝 Continuing with existing schema - manual schema updates may be required');
        console.log('💡 To fix schema issues, run the database repair script or manually update the database');
      }
    }
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    console.log('🔄 Attempting to continue without database synchronization...');
    
    // Don't exit, just continue with limited functionality
    console.log('⚠️ Application will run with limited database functionality');
  }
};

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/appointments', appointmentsRoutes);
app.use('/api/v1/users', usersRoutes);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: AppDataSource.isInitialized ? 'Connected' : 'Disconnected',
    services: {
      email: !!process.env.SENDGRID_API_KEY,
      calendar: process.env.GOOGLE_CALENDAR_ENABLED === 'true'
    }
  });
});

// API Routes overview
app.get('/api/v1/', (req, res) => {
  res.json({
    message: 'PAXFORM Backend API',
    version: '1.0.0',
    status: 'running',
    services: {
      database: AppDataSource.isInitialized ? 'connected' : 'disconnected',
      email: !!process.env.SENDGRID_API_KEY,
      calendar: process.env.GOOGLE_CALENDAR_ENABLED === 'true',
      jwt: !!process.env.JWT_SECRET
    },
    endpoints: {
      authentication: '/api/v1/auth',
      appointments: '/api/v1/appointments',
      users: '/api/v1/users',
      health: '/api/v1/health',
      docs: '/api/v1/docs'
    }
  });
});

// API Documentation endpoint
app.get('/api/v1/docs', (req, res) => {
  res.json({
    title: 'PAXFORM API Documentation',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    baseUrl: `http://localhost:${PORT}`,
    endpoints: {
      'Authentication': {
        'POST /api/v1/auth/login': 'User login',
        'POST /api/v1/auth/register': 'User registration',
        'GET /api/v1/auth/profile': 'Get user profile (requires auth)'
      },
      'Appointments': {
        'GET /api/v1/appointments': 'Get all appointments (admin only)',
        'GET /api/v1/appointments/:id': 'Get appointment by ID (admin only)',
        'POST /api/v1/appointments': 'Create new appointment',
        'PUT /api/v1/appointments/:id': 'Update appointment status (admin only)'
      },
      'Users': {
        'GET /api/v1/users': 'Get all users (admin only)',
        'GET /api/v1/users/:id': 'Get user by ID (admin only)',
        'POST /api/v1/users/admin': 'Create admin user (admin only)',
        'GET /api/v1/users/admin/all': 'Get all admins (admin only)'
      },
      'System': {
        'GET /api/v1/health': 'Health check',
        'GET /api/v1/': 'API information'
      }
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>'
    },
    documentation: 'https://docs.paxform.com'
  });
});

// Serve static files from frontend build
app.use(express.static(path.join(process.cwd(), '../frontend/dist')));

// SPA fallback: serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`
    });
  }
  res.sendFile(path.join(process.cwd(), '../frontend/dist/index.html'));
  return;
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
const startServer = async () => {
  try {
    await initializeDatabase();
    
    // Initialize WebSocket server
    WebSocketManager.initialize(httpServer);
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 PAXFORM Backend Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1/docs`);
      console.log(`💚 Health Check: http://localhost:${PORT}/api/v1/health`);
      console.log(`📧 Email Service: ${process.env.SENDGRID_API_KEY ? 'Configured' : 'Not configured'}`);
      console.log(`📅 Calendar Service: ${process.env.GOOGLE_CALENDAR_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
      console.log(`🔗 WebSocket: Enabled`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
});

export default app;

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}