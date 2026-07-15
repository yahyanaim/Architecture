import jwt from 'jsonwebtoken';
import { IUserRepository } from '../interfaces/IUserRepository';
import { User, UserRole } from '../entities/User';
import { BusinessException } from '../exceptions/BusinessException';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../config/index';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface LoginResult {
  user: User;
  token: string;
}

export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    private readonly userRepository: IUserRepository,
    jwtSecret?: string
  ) {
    const secret = jwtSecret ?? JWT_SECRET;
    this.jwtSecret = secret;
  }

  async register(name: string, email: string, password: string): Promise<LoginResult> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new BusinessException('User with this email already exists');
    }

    const hasUsers = await this.userRepository.hasUsers();
    const role: UserRole = !hasUsers ? 'admin' : 'user';

    const user = await User.create(name, email, password, role);
    await this.userRepository.save(user);

    const token = this.generateToken(user);
    return { user, token };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BusinessException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new BusinessException('Account is disabled');
    }

    if (user.isLocked()) {
      const minutes = Math.ceil((user.lockedUntil!.getTime() - Date.now()) / 60000);
      throw new BusinessException(`Account is locked. Try again in ${minutes} minutes`);
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      user.recordFailedAttempt();
      await this.userRepository.save(user);
      throw new BusinessException('Invalid email or password');
    }

    user.resetFailedAttempts();
    await this.userRepository.save(user);

    const token = this.generateToken(user);
    return { user, token };
  }

  verifyToken(token: string): AuthPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as AuthPayload;
      return payload;
    } catch {
      throw new BusinessException('Invalid or expired token');
    }
  }

  private generateToken(user: User): string {
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}