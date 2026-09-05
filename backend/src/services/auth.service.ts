import { User, IUser, UserRole } from '../models/user.model';
import { generateToken } from '../utils/jwt.utils';

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  phone?: string;
  organization?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface CreateInspectorDTO {
  name: string;
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    _id: string;
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    phone?: string;
    organization?: string;
    createdAt: Date;
  };
  token: string;
}

export class AuthService {
  /**
   * Registers a new user. Public registration ALWAYS assigns the OWNER role.
   */
  async register(data: RegisterDTO): Promise<AuthResult> {
    const { name, email, password, phone, organization } = data;

    // Validate inputs
    if (!name || name.trim().length < 2) {
      const error: any = new Error('Name is required and must be at least 2 characters');
      error.statusCode = 400;
      throw error;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const error: any = new Error('A valid email address is required');
      error.statusCode = 400;
      throw error;
    }

    if (!password || password.length < 8) {
      const error: any = new Error('Password must be at least 8 characters long');
      error.statusCode = 400;
      throw error;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const error: any = new Error('An account with this email address already exists');
      error.statusCode = 409;
      throw error;
    }

    // Enforce role: OWNER for public registration
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone?.trim() || undefined,
      organization: organization?.trim() || undefined,
      role: 'OWNER',
      isActive: true,
      tokenVersion: 0
    });

    await user.save();

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion
    });

    return {
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        phone: user.phone,
        organization: user.organization,
        createdAt: user.createdAt
      },
      token
    };
  }

  /**
   * Authenticates user credentials and returns JWT token
   */
  async login(data: LoginDTO): Promise<AuthResult> {
    const { email, password } = data;

    if (!email || !password) {
      const error: any = new Error('Email and password are required');
      error.statusCode = 400;
      throw error;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Query user including password field for verification
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    if (!user.isActive) {
      const error: any = new Error('Account is deactivated. Please contact administrator.');
      error.statusCode = 403;
      throw error;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion
    });

    return {
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        phone: user.phone,
        organization: user.organization,
        createdAt: user.createdAt
      },
      token
    };
  }

  /**
   * Invalidates active sessions/tokens for user by incrementing tokenVersion
   */
  async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  }

  /**
   * Fetches user profile by ID
   */
  async getProfile(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      const error: any = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }

  /**
   * Admin-only operation: Create an INSPECTOR account
   */
  async createInspector(data: CreateInspectorDTO): Promise<IUser> {
    const { name, email, password } = data;

    if (!name || name.trim().length < 2) {
      const error: any = new Error('Name is required and must be at least 2 characters');
      error.statusCode = 400;
      throw error;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const error: any = new Error('A valid email address is required');
      error.statusCode = 400;
      throw error;
    }

    if (!password || password.length < 8) {
      const error: any = new Error('Password must be at least 8 characters long');
      error.statusCode = 400;
      throw error;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const error: any = new Error('An account with this email address already exists');
      error.statusCode = 409;
      throw error;
    }

    const inspector = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'INSPECTOR',
      isActive: true,
      tokenVersion: 0
    });

    await inspector.save();
    return inspector;
  }
}

export const authService = new AuthService();
