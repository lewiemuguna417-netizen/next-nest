import { io, Socket } from 'socket.io-client';
import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Appointment } from './api';

// WebSocket event types
export interface WebSocketEvents {
  'appointment-updated': {
    type: 'appointment-updated' | 'status-changed' | 'appointment-cancelled' | 'bulk-update';
    appointment?: Appointment;
    appointments?: Appointment[]; // For bulk updates
    changes?: Partial<Appointment>;
    appointmentId?: string;
    oldStatus?: string;
    newStatus?: string;
    timestamp: string;
  };
  'system-update': {
    type: 'calendar-sync';
    status: 'started' | 'completed' | 'error';
    data?: any;
    timestamp: string;
  };
  'subscription-confirmed': {
    message: string;
  };
  'initial-data': {
    type: 'initial-appointments';
    appointments: Appointment[];
    timestamp: string;
  };
  'appointment-data': Appointment;
  'error': {
    message: string;
  };
  'pong': {
    timestamp: string;
  };
}

class WebSocketService {
  private socket: Socket | null = null;
  private queryClient: QueryClient | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.connect();
  }

  /**
   * Initialize WebSocket connection
   */
  connect() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://datascrapex-job3-1070255625225.us-central1.run.app';
    
    // Convert HTTP(S) URL to WebSocket URL
    const wsUrl = backendUrl.replace('http://', 'ws://').replace('https://', 'wss://');

    this.socket = io(wsUrl, {
      transports: ['websocket'],
      timeout: 5000,
      forceNew: true,
      // More lenient reconnection settings for development
      reconnection: true,
      reconnectionAttempts: 3, // Reduced from 5
      reconnectionDelay: 2000, // Increased delay
    });

    this.setupEventListeners();
    this.startHeartbeat();
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔗 WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Subscribe to appointment updates
      this.socket?.emit('subscribe-appointments');
      
      toast.success('Real-time updates connected', {
        description: 'You will now receive live appointment updates'
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }
      
      // Attempt reconnection
      this.attemptReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.attemptReconnect();
    });

    // Handle appointment updates
    this.socket.on('appointment-updated', (data: WebSocketEvents['appointment-updated']) => {
      this.handleAppointmentUpdate(data);
    });

    // Handle system updates (calendar sync status)
    this.socket.on('system-update', (data: WebSocketEvents['system-update']) => {
      this.handleSystemUpdate(data);
    });

    // Handle initial data
    this.socket.on('initial-data', (data: WebSocketEvents['initial-data']) => {
      if (data.type === 'initial-appointments' && this.queryClient) {
        this.queryClient.setQueryData(['appointments'], data.appointments);
      }
    });

    // Handle subscription confirmation
    this.socket.on('subscription-confirmed', (data: WebSocketEvents['subscription-confirmed']) => {
      console.log('✅ WebSocket subscription confirmed:', data.message);
    });

    // Handle errors
    this.socket.on('error', (data: WebSocketEvents['error']) => {
      console.error('🚨 WebSocket error:', data.message);
      toast.error('Connection Error', {
        description: data.message
      });
    });

    // Handle pongs
    this.socket.on('pong', (data: WebSocketEvents['pong']) => {
      console.log('🏓 Received pong:', data.timestamp);
    });
  }

  /**
   * Handle appointment updates from WebSocket
   */
  private handleAppointmentUpdate(data: WebSocketEvents['appointment-updated']) {
    if (!this.queryClient) return;

    console.log('📡 Received appointment update:', data);

    switch (data.type) {
      case 'status-changed':
        if (data.appointment && data.oldStatus && data.newStatus) {
          // Update the specific appointment in the cache
          this.queryClient.setQueryData(['appointments'], (old: Appointment[] = []) => {
            return old.map(apt => 
              apt.id === data.appointmentId 
                ? { ...apt, ...data.appointment }
                : apt
            );
          });

          // Show toast notification
          toast.success(`Appointment status updated`, {
            description: `${data.appointment.name}: ${data.oldStatus} → ${data.newStatus}`
          });
        }
        break;

      case 'appointment-updated':
        if (data.appointment) {
          // Update the specific appointment
          this.queryClient.setQueryData(['appointments'], (old: Appointment[] = []) => {
            return old.map(apt => 
              apt.id === data.appointment?.id 
                ? { ...apt, ...data.appointment, ...data.changes }
                : apt
            );
          });

          // Show toast notification
          toast.info('Appointment updated', {
            description: `${data.appointment.name}'s appointment has been updated`
          });
        }
        break;

      case 'appointment-cancelled':
        if (data.appointmentId) {
          // Update the appointment status to cancelled
          this.queryClient.setQueryData(['appointments'], (old: Appointment[] = []) => {
            return old.map(apt => 
              apt.id === data.appointmentId 
                ? { ...apt, status: 'cancelled' as const }
                : apt
            );
          });

          toast.warning('Appointment cancelled', {
            description: 'An appointment has been cancelled'
          });
        }
        break;

      case 'bulk-update':
        if (data.appointments && Array.isArray(data.appointments)) {
          // Replace the entire appointments cache
          this.queryClient.setQueryData(['appointments'], data.appointments);
          toast.info('Appointments updated', {
            description: `${data.appointments.length} appointments have been updated`
          });
        }
        break;
    }

    // Invalidate related queries to ensure consistency
    this.queryClient.invalidateQueries({ queryKey: ['appointments'] });
  }

  /**
   * Handle system updates (calendar sync status)
   */
  private handleSystemUpdate(data: WebSocketEvents['system-update']) {
    if (data.type === 'calendar-sync') {
      switch (data.status) {
        case 'started':
          console.log('🔄 Calendar sync started');
          break;
        case 'completed':
          console.log('✅ Calendar sync completed');
          toast.success('Calendar sync completed', {
            description: 'Google Calendar changes have been synchronized'
          });
          break;
        case 'error':
          console.error('❌ Calendar sync error:', data.data?.error);
          toast.error('Calendar sync failed', {
            description: data.data?.error || 'Failed to sync with Google Calendar'
          });
          break;
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      toast.error('Connection lost', {
        description: 'Unable to reconnect to real-time updates. Please refresh the page.'
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Set the QueryClient for cache management
   */
  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id || null
    };
  }

  /**
   * Request specific appointment data
   */
  requestAppointment(appointmentId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('get-appointment', { appointmentId });
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }
}

// Create singleton instance
export const websocketService = new WebSocketService();

export default websocketService;