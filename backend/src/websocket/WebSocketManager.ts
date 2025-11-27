import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server } from 'http';

export interface WebSocketEvents {
  'appointment:created': (data: any) => void;
  'appointment:updated': (data: any) => void;
  'appointment:deleted': (data: any) => void;
  'calendar:sync': (data: any) => void;
  'calendar:error': (error: string) => void;
}

export class WebSocketManager {
  private static io: SocketIOServer | null = null;

  static initialize(httpServer: Server) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`🔗 WebSocket client connected: ${socket.id}`);

      // Handle subscription to appointment updates
      socket.on('subscribe:appointments', () => {
        socket.join('appointments');
        console.log(`📢 Client ${socket.id} subscribed to appointment updates`);
      });

      // Handle subscription to calendar updates
      socket.on('subscribe:calendar', () => {
        socket.join('calendar');
        console.log(`📅 Client ${socket.id} subscribed to calendar updates`);
      });

      // Handle ping-pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      socket.on('disconnect', (reason: string) => {
        console.log(`❌ WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
      });

      socket.on('error', (error: Error) => {
        console.error(`🚫 WebSocket error for client ${socket.id}:`, error);
      });
    });

    console.log('✅ WebSocket server initialized');
    return this.io;
  }

  // Broadcast appointment events to all connected clients
  static broadcastAppointmentCreated(appointment: any) {
    if (this.io) {
      this.io.to('appointments').emit('appointment:created', appointment);
      console.log(`📢 Broadcasted appointment created: ${appointment.id}`);
    }
  }

  static broadcastAppointmentUpdated(appointment: any) {
    if (this.io) {
      this.io.to('appointments').emit('appointment:updated', appointment);
      console.log(`📢 Broadcasted appointment updated: ${appointment.id}`);
    }
  }

  static broadcastAppointmentDeleted(appointmentId: string) {
    if (this.io) {
      this.io.to('appointments').emit('appointment:deleted', { id: appointmentId });
      console.log(`📢 Broadcasted appointment deleted: ${appointmentId}`);
    }
  }

  // Broadcast calendar sync events
  static broadcastCalendarSync(syncData: any) {
    if (this.io) {
      this.io.to('calendar').emit('calendar:sync', syncData);
      console.log(`📅 Broadcasted calendar sync:`, syncData);
    }
  }

  static broadcastCalendarError(error: string) {
    if (this.io) {
      this.io.to('calendar').emit('calendar:error', error);
      console.warn(`🚫 Broadcasted calendar error: ${error}`);
    }
  }

  static getInstance() {
    return this.io;
  }
}