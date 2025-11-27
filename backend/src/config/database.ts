import { DataSource } from 'typeorm';
import { User } from '../models/User';
import { Appointment } from '../models/Appointment';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
  entities: [
    User,
    Appointment
  ],
  migrations: [],
  subscribers: [],
  maxQueryExecutionTime: 1000,
  // Enhanced connection settings for production Neon database
  extra: {
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '60000'),
    statement_timeout: 60000,
    query_timeout: 60000,
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '5'), // Reduced for Neon serverless
    min: 1,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: 'paxform-backend',
  }
});

export default AppDataSource;