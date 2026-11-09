export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  imageUrl?: string;
}

export interface MenuItemData {
  id: string;
  hotelId: string;
  category: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  description?: string | null;
  isAvailable: boolean;
  is3dEnabled: boolean;
  modelUrl?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  totalOrdered?: number;
  totalRevenue?: number;
}

export interface HotelData {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  phone?: string | null;
  address?: string | null;
  coverImage?: string | null;
  status: 'pending' | 'active' | 'expired';
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    menuItems?: number;
    orders?: number;
    feedback?: number;
  };
}

export interface OrderData {
  id: string;
  hotelId: string;
  tableNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  items: string; // JSON string or parsed
  totalAmount: number;
  discountAmount?: number;
  paymentMethod?: 'cash' | 'online' | string;
  status: 'received' | 'in_progress' | 'done' | 'cancelled';
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  hotel?: {
    name: string;
    slug: string;
    phone?: string | null;
  };
  feedback?: FeedbackData | null;
  chatMessages?: ChatMessageData[];
}

export interface ChatMessageData {
  id: string;
  hotelId: string;
  orderId: string;
  sender: 'customer' | 'staff';
  message: string;
  createdAt: string | Date;
}

export interface FeedbackData {
  id: string;
  hotelId: string;
  orderId: string;
  rating: number;
  comment?: string | null;
  customerName?: string | null;
  createdAt: string | Date;
  order?: {
    tableNumber: string;
  };
}

export interface AdminData {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string | Date;
}

export interface IngredientData {
  id: string;
  hotelId: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  minAlertStock: number;
  costPerUnit?: number | null;
  supplier?: string | null;
  lastRestockedAt?: string | Date | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type SystemRole = 'OWNER' | 'MANAGER' | 'CHEF' | 'WAITER' | 'CASHIER';

export interface ActiveStaffSession {
  id: string;
  name: string;
  role: SystemRole;
  department?: string;
  isOwner?: boolean;
}

export interface StaffMemberData {
  id: string;
  hotelId: string;
  name: string;
  role: string;
  department: string;
  systemRole?: SystemRole | string;
  pinCode?: string | null;
  hasPin?: boolean;
  phone?: string | null;
  email?: string | null;
  shift: string;
  salary?: number | null;
  salaryType?: string;
  status: 'active' | 'inactive' | 'on_leave';
  joinDate?: string | Date | null;
  avatar?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  todayAttendance?: StaffAttendanceData | null;
  attendances?: StaffAttendanceData[];
}

export interface StaffAttendanceData {
  id: string;
  hotelId: string;
  staffId: string;
  date: string;
  status: 'present' | 'late' | 'half_day' | 'absent' | 'on_leave';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  shift?: string | null;
  hoursWorked?: number | null;
  notes?: string | null;
  markedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  staff?: {
    id: string;
    name: string;
    role: string;
    department: string;
    phone?: string | null;
    shift: string;
    status: string;
  };
}

export interface AttendanceStatsData {
  totalStaff: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  attendanceRate: number;
}

