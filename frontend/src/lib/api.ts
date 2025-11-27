import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL || 'https://datascrapex-job3-1070255625225.us-central1.run.app'}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('paxform_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('paxform_token');
      localStorage.removeItem('paxform_user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  isAdmin?: boolean;
}

export interface CreateAppointmentRequest {
  name: string;
  email: string;
  appointmentDateTime: string;
  notes?: string;
}

export interface UpdateAppointmentRequest {
  name?: string;
  email?: string;
  appointmentDateTime?: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  name: string;
  email: string;
  appointmentDateTime: string;
  notes?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
  googleEventId?: string;
  // Frontend-specific field for compatibility
  dateTime?: string;
}

export interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt?: string;
}

// Auth API
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/profile');
    return response.data.user;
  },
};

// Appointments API
export interface AppointmentsFilter {
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const appointmentsApi = {
  create: async (appointmentData: CreateAppointmentRequest): Promise<Appointment> => {
    const response = await api.post('/appointments', appointmentData);
    return response.data.data;
  },

  getAll: async (filters?: AppointmentsFilter): Promise<Appointment[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    const queryString = params.toString();
    const url = queryString ? `/appointments?${queryString}` : '/appointments';

    const response = await api.get(url);
    return response.data.data; // Extract the data array from the API response
  },

  getById: async (id: string): Promise<Appointment> => {
    const response = await api.get(`/appointments/${id}`);
    return response.data.data;
  },

  update: async (id: string, updateData: Partial<Appointment>): Promise<Appointment> => {
    const response = await api.put(`/appointments/${id}`, updateData);
    return response.data.data;
  },
};

// Users API (Admin only)
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  // Admin-specific methods
  createAdmin: async (adminData: { email: string; password: string }): Promise<User> => {
    const response = await api.post('/users/admin', adminData);
    return response.data.data;
  },

  promoteToAdmin: async (userId: string): Promise<User> => {
    const response = await api.post('/users/admin/promote', { userId });
    return response.data.data;
  },

  getAllAdmins: async (): Promise<User[]> => {
    const response = await api.get('/users/admin/all');
    return response.data.data;
  },
};

export default api;