import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'restroastra-platform-jwt-secret-2026';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'restroastra-platform-admin-secret-2026';

export const HOTEL_COOKIE_NAME = process.env.AUTH_COOKIE_HOTEL || 'restroastra_hotel_token';
export const ADMIN_COOKIE_NAME = process.env.AUTH_COOKIE_ADMIN || 'restroastra_admin_token';

export interface HotelTokenPayload {
  hotelId: string;
  name: string;
  slug: string;
  email: string;
  status: string;
}

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  name?: string;
  role: 'admin';
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signHotelToken(payload: HotelTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyHotelToken(token: string): HotelTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as HotelTokenPayload;
  } catch {
    return null;
  }
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
}

export function getHotelAuth(request: NextRequest): HotelTokenPayload | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyHotelToken(token);
    if (decoded) return decoded;
  }

  // Check isolated RestroAstra cookie (with fallback to hotel_token)
  const cookie = request.cookies.get(HOTEL_COOKIE_NAME) || request.cookies.get('hotel_token');
  if (cookie?.value) {
    return verifyHotelToken(cookie.value);
  }

  return null;
}

export function getAdminAuth(request: NextRequest): AdminTokenPayload | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyAdminToken(token);
    if (decoded) return decoded;
  }

  // Check isolated RestroAstra admin cookie (with fallback to admin_token)
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME) || request.cookies.get('admin_token');
  if (cookie?.value) {
    return verifyAdminToken(cookie.value);
  }

  return null;
}

