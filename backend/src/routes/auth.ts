import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { EmailService } from '../services/EmailService';

const router = Router();

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    const result = await AuthService.authenticateUser(email, password);
    
    if (!result) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
      return;
    }

    const { user, token } = result;

    res.json({
      success: true,
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Handle database connection errors with appropriate status code
    if (error.message?.includes('Database connection unavailable')) {
      res.status(503).json({
        success: false,
        message: 'Database connection unavailable. Please try again later.'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Register endpoint
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, isAdmin = false } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
      return;
    }

    const user = await AuthService.createUser(email, password, isAdmin);
    
    // Send welcome email
    await EmailService.sendWelcomeEmail(email, email.split('@')[0]);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.message === 'User already exists') {
      res.status(409).json({
        success: false,
        message: 'User already exists'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get profile endpoint
router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided'
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    
    const user = await AuthService.getUserById(payload.userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

export default router;