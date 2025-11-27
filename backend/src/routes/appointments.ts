import { Router, Request, Response } from 'express';
import { Appointment, AppointmentStatus } from '../models/Appointment';
import { AuthService, JWTPayload } from '../services/AuthService';
import { EmailService } from '../services/EmailService';
import { CalendarService } from '../services/CalendarService';
import AppDataSource from '../config/database';

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

// Get all appointments (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if database is initialized
    if (!AppDataSource.isInitialized) {
      console.warn('Database not initialized, returning empty appointments list');
      res.json({
        success: true,
        data: [],
        message: 'Database not available, showing empty appointments list'
      });
      return;
    }

    const appointmentRepository = AppDataSource.getRepository(Appointment);
    
    const { status, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    // Validate sortBy to prevent SQL injection
    const allowedSortFields = ['createdAt', 'updatedAt', 'appointmentDateTime', 'name', 'email', 'status'];
    const safeSortBy = allowedSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';
    const safeSortOrder = (sortOrder === 'ASC' || sortOrder === 'DESC') ? sortOrder as 'ASC' | 'DESC' : 'DESC';
    
    const queryBuilder = appointmentRepository.createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.user', 'user');

    if (status && status !== 'all') {
      queryBuilder.andWhere('appointment.status = :status', { status });
    }

    queryBuilder.orderBy(`appointment.${safeSortBy}`, safeSortOrder);
    queryBuilder.orderBy(`appointment.${sortBy}`, sortOrder as 'ASC' | 'DESC');

    const appointments = await queryBuilder.getMany();

    res.json({
      success: true,
      data: appointments,
      message: 'Appointments retrieved successfully'
    });
  } catch (error: any) {
    console.error('Get appointments error:', error);
    // If database operation fails, return empty list instead of 500 error
    console.warn('Database operation failed, returning empty appointments list');
    res.json({
      success: true,
      data: [],
      message: 'Database temporarily unavailable, showing empty appointments list'
    });
  }
});

// Get appointment by ID (Admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Check if database is initialized
    if (!AppDataSource.isInitialized) {
      console.warn('Database not initialized, cannot fetch appointment');
      res.status(503).json({
        success: false,
        message: 'Database service unavailable'
      });
      return;
    }

    const { id } = req.params;
    const appointmentRepository = AppDataSource.getRepository(Appointment);
    
    const appointment = await appointmentRepository.findOne({
      where: { id },
      relations: ['user']
    });

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
      return;
    }

    res.json({
      success: true,
      data: appointment,
      message: 'Appointment retrieved successfully'
    });
  } catch (error: any) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new appointment (Public)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, appointmentDateTime, notes } = req.body;

    if (!name || !email || !appointmentDateTime) {
      res.status(400).json({
        success: false,
        message: 'Name, email, and appointment date/time are required'
      });
      return;
    }

    // Validate appointment date is in the future
    const appointmentDate = new Date(appointmentDateTime);
    const now = new Date();
    
    if (appointmentDate <= now) {
      res.status(400).json({
        success: false,
        message: 'Appointment date must be in the future'
      });
      return;
    }

    // Check if database is initialized
    if (!AppDataSource.isInitialized) {
      console.warn('Database not initialized, cannot create appointment');
      res.status(503).json({
        success: false,
        message: 'Database service unavailable, appointment cannot be created'
      });
      return;
    }

    const appointmentRepository = AppDataSource.getRepository(Appointment);
    
    const appointment = appointmentRepository.create({
      name,
      email,
      appointmentDateTime: appointmentDate,
      notes,
      status: AppointmentStatus.UPCOMING
    });

    const savedAppointment = await appointmentRepository.save(appointment);

    // Create Google Calendar event
    const calendarEventId = await CalendarService.createAppointmentEvent(
      name,
      email,
      appointmentDateTime,
      notes
    );

    if (calendarEventId) {
      savedAppointment.googleEventId = calendarEventId;
      await appointmentRepository.save(savedAppointment);
    }

    // Send confirmation email
    await EmailService.sendAppointmentConfirmation(
      email,
      name,
      appointmentDateTime,
      savedAppointment.id
    );

    res.status(201).json({
      success: true,
      data: savedAppointment,
      message: 'Appointment created successfully'
    });
  } catch (error: any) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update appointment status (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(AppointmentStatus).includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
      return;
    }

    // Check if database is initialized
    if (!AppDataSource.isInitialized) {
      console.warn('Database not initialized, cannot update appointment');
      res.status(503).json({
        success: false,
        message: 'Database service unavailable'
      });
      return;
    }

    const appointmentRepository = AppDataSource.getRepository(Appointment);
    
    const appointment = await appointmentRepository.findOne({
      where: { id }
    });

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
      return;
    }

    appointment.status = status;
    const updatedAppointment = await appointmentRepository.save(appointment);

    // Update Google Calendar event if it exists
    if (appointment.googleEventId) {
      if (status === AppointmentStatus.CANCELLED) {
        await CalendarService.deleteEvent(appointment.googleEventId);
      } else if (status === AppointmentStatus.COMPLETED) {
        // You could update the calendar event to mark it as completed
        // This is optional and depends on your calendar setup
      }
    }

    // Send status update email
    await EmailService.sendAppointmentUpdate(
      appointment.email,
      appointment.name,
      appointment.appointmentDateTime?.toISOString() || new Date().toISOString(),
      status,
      appointment.id
    );

    res.json({
      success: true,
      data: updatedAppointment,
      message: 'Appointment updated successfully'
    });
  } catch (error: any) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;