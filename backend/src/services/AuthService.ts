import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import AppDataSource from '../config/database';

export interface JWTPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export class AuthService {
  private static JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
  private static JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  private static SALT_ROUNDS = parseInt(process.env.PASSWORD_SALT_ROUNDS || '12');

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    } as jwt.SignOptions);
  }

  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static async authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      
      // Use raw query to avoid missing column issues
      const query = `
        SELECT id, email, password, "isAdmin", "createdAt", "updatedAt"
        FROM users 
        WHERE email = $1
        LIMIT 1
      `;
      
      const result = await userRepository.query(query, [email]);
      
      if (!result || (result as any[]).length === 0) {
        return null;
      }

      const userData = (result as any[])[0];
      const user = userRepository.create(userData) as unknown as User;

      const isPasswordValid = await this.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      const token = this.generateToken(user);
      
      return { user, token };
    } catch (error: any) {
      // Handle database connection errors gracefully
      if (error.message?.includes('Driver not Connected') || 
          error.message?.includes('Connection refused') ||
          error.message?.includes('connect ECONNREFUSED')) {
        throw new Error('Database connection unavailable. Please try again later.');
      }
      throw error;
    }
  }

  static async createUser(email: string, password: string, isAdmin: boolean = false): Promise<User> {
    const userRepository = AppDataSource.getRepository(User);
    
    const existingUser = await userRepository.findOne({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await this.hashPassword(password);
    
    const user = userRepository.create({
      email,
      password: hashedPassword,
      isAdmin
    });

    return userRepository.save(user);
  }

  static async getUserById(userId: string): Promise<User | null> {
    const userRepository = AppDataSource.getRepository(User);
    return userRepository.findOne({
      where: { id: userId }
    });
  }

  static async getAllUsers(): Promise<User[]> {
    const userRepository = AppDataSource.getRepository(User);
    return userRepository.find({
      select: ['id', 'email', 'isAdmin', 'createdAt', 'updatedAt']
    });
  }

  static async getAllAdmins(): Promise<User[]> {
    const userRepository = AppDataSource.getRepository(User);
    return userRepository.find({
      where: { isAdmin: true },
      select: ['id', 'email', 'isAdmin', 'createdAt', 'updatedAt']
    });
  }

  static async createAdmin(email: string, password: string): Promise<User> {
    return this.createUser(email, password, true);
  }
}