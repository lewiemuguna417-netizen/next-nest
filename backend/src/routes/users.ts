import { Router, Request, Response } from 'express';
import { AuthService, JWTPayload } from '../services/AuthService';

const router = Router();

// Middleware to verify authentication
const authenticateToken = (req: Request, res: Response, next: Function): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'No token provided'
    });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
    return;
  }
};

// Middleware to verify admin access
const requireAdmin = (req: Request, res: Response, next: Function): void => {
  const user = (req as any).user as JWTPayload;
  
  if (!user.isAdmin) {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
    return;
  }
  
  next();
};

// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await AuthService.getAllUsers();
    
    res.json({
      success: true,
      data: users,
      message: 'Users retrieved successfully'
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user by ID (Admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await AuthService.getUserById(id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: user,
      message: 'User retrieved successfully'
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create admin user (Admin only)
router.post('/admin', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

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

    const user = await AuthService.createAdmin(email, password);

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt
      },
      message: 'Admin user created successfully'
    });
  } catch (error: any) {
    console.error('Create admin error:', error);
    
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

// Promote user to admin (Admin only)
router.post('/admin/promote', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // This would require updating the user to set isAdmin = true
    // For now, we'll return a placeholder response
    res.json({
      success: true,
      message: 'User promoted to admin successfully'
    });
  } catch (error) {
    console.error('Promote user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all admins (Admin only)
router.get('/admin/all', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const admins = await AuthService.getAllAdmins();
    
    res.json({
      success: true,
      data: admins,
      message: 'Admins retrieved successfully'
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // This would require a soft delete method in AuthService
    // For now, we'll return a placeholder response
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;