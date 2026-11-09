'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  Phone,
  Briefcase,
  DollarSign,
  Coffee,
  Check,
  Edit2,
  Trash2,
  RotateCcw,
  Printer,
  CalendarDays,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { StaffMemberData, StaffAttendanceData, AttendanceStatsData } from '@/lib/types';
import { formatNPR, getNepalDateString } from '@/lib/utils';
import { playChime, unlockAudio } from '@/lib/audio';

const DEPARTMENTS = ['All', 'Kitchen', 'Service', 'Bar', 'Management', 'Operations'];
const SHIFTS = ['Full Day', 'Morning', 'Evening', 'Night', 'Flexible'];

export default function StaffAttendancePage() {
  const [activeTab, setActiveTab] = useState<'sheet' | 'directory' | 'monthly'>('sheet');
  const [selectedDate, setSelectedDate] = useState<string>(getNepalDateString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getNepalDateString().substring(0, 7));

  // Attendance Sheet state
  const [attendanceList, setAttendanceList] = useState<
    { staff: StaffMemberData; attendance: StaffAttendanceData | null; status: string }[]
  >([]);
  const [stats, setStats] = useState<AttendanceStatsData>({
    totalStaff: 0,
    present: 0,
    late: 0,
    halfDay: 0,
    absent: 0,
    onLeave: 0,
    attendanceRate: 0,
  });

  // Directory state
  const [directoryList, setDirectoryList] = useState<StaffMemberData[]>([]);

  // Monthly Timesheet state
  const [monthlyData, setMonthlyData] = useState<{
    staffSummaries: any[];
    monthStats: any;
  } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Loading & notification
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMemberData | null>(null);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [activeTimeStaff, setActiveTimeStaff] = useState<{
    staff: StaffMemberData;
    attendance: StaffAttendanceData | null;
    status: string;
    checkInTime: string;
    checkOutTime: string;
    shift: string;
    notes: string;
  } | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffMemberData | null>(null);

  // Staff Form Data
  const [staffForm, setStaffForm] = useState({
    name: '',
    role: '',
    department: 'Kitchen',
    systemRole: 'CHEF',
    pinCode: '',
    shift: 'Morning',
    phone: '',
    email: '',
    salary: '',
    salaryType: 'monthly',
    status: 'active',
    emergencyContact: '',
    notes: '',
  });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1. Fetch Daily Attendance
  const fetchAttendance = async (date: string = selectedDate) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hotel/attendance?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setAttendanceList(data.staffAttendanceList || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
      showToast('Failed to load attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Staff Directory
  const fetchDirectory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hotel/staff');
      if (res.ok) {
        const data = await res.json();
        setDirectoryList(data.staff || []);
      }
    } catch (err) {
      console.error('Failed to load directory:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Monthly Summary
  const fetchMonthlySummary = async (month: string = selectedMonth) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hotel/attendance/summary?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setMonthlyData(data);
      }
    } catch (err) {
      console.error('Failed to load monthly summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sheet') {
      fetchAttendance(selectedDate);
    } else if (activeTab === 'directory') {
      fetchDirectory();
    } else if (activeTab === 'monthly') {
      fetchMonthlySummary(selectedMonth);
    }
  }, [activeTab, selectedDate, selectedMonth]);

  // Navigate Date (< and >)
  const shiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const newDateStr = current.toISOString().substring(0, 10);
    setSelectedDate(newDateStr);
  };

  // Quick Single Status Toggle
  const handleSetStatus = async (
    staffId: string,
    newStatus: 'present' | 'late' | 'half_day' | 'absent' | 'on_leave',
    currentAttendance: StaffAttendanceData | null
  ) => {
    try {
      unlockAudio();
      playChime('success');

      // Optimistic update
      setAttendanceList((prev) =>
        prev.map((item) =>
          item.staff.id === staffId
            ? {
                ...item,
                status: newStatus,
                attendance: item.attendance
                  ? { ...item.attendance, status: newStatus }
                  : {
                      id: 'temp',
                      hotelId: item.staff.hotelId,
                      staffId,
                      date: selectedDate,
                      status: newStatus,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
              }
            : item
        )
      );

      const res = await fetch('/api/hotel/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          date: selectedDate,
          status: newStatus,
          checkInTime: currentAttendance?.checkInTime,
          checkOutTime: currentAttendance?.checkOutTime,
          shift: currentAttendance?.shift,
          notes: currentAttendance?.notes,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }

      showToast(`Marked ${newStatus.replace('_', ' ')}`, 'success');
      fetchAttendance(selectedDate);
    } catch (err) {
      console.error(err);
      showToast('Error updating status', 'error');
      fetchAttendance(selectedDate);
    }
  };

  // Clock In Now
  const handleClockInNow = async (staffId: string) => {
    try {
      unlockAudio();
      playChime('success');

      const res = await fetch('/api/hotel/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock_in',
          staffId,
          date: selectedDate,
        }),
      });

      if (res.ok) {
        showToast('Clocked in successfully!', 'success');
        fetchAttendance(selectedDate);
      } else {
        showToast('Failed to clock in', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to clock in', 'error');
    }
  };

  // Clock Out Now
  const handleClockOutNow = async (staffId: string) => {
    try {
      unlockAudio();
      playChime('success');

      const res = await fetch('/api/hotel/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock_out',
          staffId,
          date: selectedDate,
        }),
      });

      if (res.ok) {
        showToast('Clocked out and hours recorded!', 'success');
        fetchAttendance(selectedDate);
      } else {
        showToast('Failed to clock out', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to clock out', 'error');
    }
  };

  // Batch Mark All Present
  const handleMarkAllPresent = async () => {
    try {
      unlockAudio();
      playChime('success');

      const res = await fetch('/api/hotel/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_mark_present',
          date: selectedDate,
        }),
      });

      if (res.ok) {
        showToast('All staff marked present for ' + selectedDate, 'success');
        fetchAttendance(selectedDate);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to batch mark present', 'error');
    }
  };

  // Clear / Delete Attendance Record
  const handleClearRecord = async (staffId: string) => {
    try {
      const res = await fetch('/api/hotel/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_record',
          staffId,
          date: selectedDate,
        }),
      });

      if (res.ok) {
        showToast('Attendance record cleared', 'success');
        fetchAttendance(selectedDate);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to clear record', 'error');
    }
  };

  // Seed Demo Staff if 0 exist
  const handleSeedDemoStaff = async () => {
    try {
      unlockAudio();
      playChime('success');
      const res = await fetch('/api/hotel/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_demo' }),
      });
      if (res.ok) {
        showToast('Standard restaurant team loaded successfully!', 'success');
        fetchAttendance(selectedDate);
        fetchDirectory();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load demo staff', 'error');
    }
  };

  // Save / Update Detailed Time & Note Modal
  const handleSaveTimeModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTimeStaff) return;

    try {
      const res = await fetch('/api/hotel/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: activeTimeStaff.staff.id,
          date: selectedDate,
          status: activeTimeStaff.status,
          checkInTime: activeTimeStaff.checkInTime || null,
          checkOutTime: activeTimeStaff.checkOutTime || null,
          shift: activeTimeStaff.shift,
          notes: activeTimeStaff.notes || null,
        }),
      });

      if (res.ok) {
        showToast('Attendance updated successfully', 'success');
        setIsTimeModalOpen(false);
        setActiveTimeStaff(null);
        fetchAttendance(selectedDate);
      } else {
        showToast('Failed to save attendance', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save attendance', 'error');
    }
  };

  // Open Add Staff Modal
  const openAddStaffModal = () => {
    setEditingStaff(null);
    setStaffForm({
      name: '',
      role: '',
      department: 'Kitchen',
      systemRole: 'CHEF',
      pinCode: '',
      shift: 'Morning',
      phone: '',
      email: '',
      salary: '',
      salaryType: 'monthly',
      status: 'active',
      emergencyContact: '',
      notes: '',
    });
    setIsStaffModalOpen(true);
  };

  // Open Edit Staff Modal
  const openEditStaffModal = (staff: StaffMemberData) => {
    setEditingStaff(staff);
    setStaffForm({
      name: staff.name,
      role: staff.role,
      department: staff.department,
      systemRole: (staff.systemRole as string) || 'WAITER',
      pinCode: staff.pinCode || '',
      shift: staff.shift,
      phone: staff.phone || '',
      email: staff.email || '',
      salary: staff.salary ? String(staff.salary) : '',
      salaryType: staff.salaryType || 'monthly',
      status: staff.status,
      emergencyContact: staff.emergencyContact || '',
      notes: staff.notes || '',
    });
    setIsStaffModalOpen(true);
  };

  // Save Staff (Add or Edit)
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim() || !staffForm.role.trim()) {
      showToast('Please provide Name and Role', 'error');
      return;
    }

    try {
      if (editingStaff) {
        // PUT
        const res = await fetch(`/api/hotel/staff/${editingStaff.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(staffForm),
        });
        if (res.ok) {
          showToast('Staff member updated!', 'success');
          setIsStaffModalOpen(false);
          fetchDirectory();
          fetchAttendance(selectedDate);
        } else {
          showToast('Failed to update staff member', 'error');
        }
      } else {
        // POST
        const res = await fetch('/api/hotel/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(staffForm),
        });
        if (res.ok) {
          showToast('New staff member added!', 'success');
          setIsStaffModalOpen(false);
          fetchDirectory();
          fetchAttendance(selectedDate);
        } else {
          showToast('Failed to add staff member', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving staff member', 'error');
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async () => {
    if (!deletingStaff) return;
    try {
      const res = await fetch(`/api/hotel/staff/${deletingStaff.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Staff member removed successfully', 'success');
        setDeletingStaff(null);
        fetchDirectory();
        fetchAttendance(selectedDate);
      } else {
        showToast('Failed to remove staff member', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error removing staff member', 'error');
    }
  };

  // Filtered Daily Attendance list
  const filteredAttendance = useMemo(() => {
    return attendanceList.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.staff.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.staff.phone && item.staff.phone.includes(searchQuery));

      const matchesDept =
        selectedDepartment === 'All' ||
        item.staff.department.toLowerCase() === selectedDepartment.toLowerCase();

      const matchesStatus =
        selectedStatusFilter === 'All' || item.status === selectedStatusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [attendanceList, searchQuery, selectedDepartment, selectedStatusFilter]);

  // Filtered Directory list
  const filteredDirectory = useMemo(() => {
    return directoryList.filter((staff) => {
      const matchesSearch =
        !searchQuery.trim() ||
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (staff.phone && staff.phone.includes(searchQuery));

      const matchesDept =
        selectedDepartment === 'All' ||
        staff.department.toLowerCase() === selectedDepartment.toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [directoryList, searchQuery, selectedDepartment]);

  // Helper colors
  const getDepartmentBadge = (dept: string) => {
    switch (dept.toLowerCase()) {
      case 'kitchen':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'service':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'bar':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'management':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'operations':
      default:
        return 'bg-stone-100 text-stone-800 border-stone-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
          dot: 'bg-emerald-500',
          label: 'Present',
        };
      case 'late':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-300',
          dot: 'bg-amber-500',
          label: 'Late',
        };
      case 'half_day':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-300',
          dot: 'bg-orange-500',
          label: 'Half Day',
        };
      case 'absent':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-300',
          dot: 'bg-rose-500',
          label: 'Absent',
        };
      case 'on_leave':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-300',
          dot: 'bg-purple-500',
          label: 'On Leave',
        };
      default:
        return {
          bg: 'bg-stone-100 text-stone-600 border-stone-300',
          dot: 'bg-stone-400',
          label: 'Unmarked',
        };
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-semibold tracking-wide border transition-all ${
            toastMessage.type === 'success'
              ? 'bg-stone-900 text-amber-300 border-amber-500/40'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-stone-200/80 rounded-3xl p-6 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-amber-700 mb-1">
            <UserCheck className="w-4 h-4" />
            <span>Workforce Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
            Staff Attendance & Rosters
          </h1>
          <p className="text-xs text-stone-500 mt-1 max-w-xl">
            Live restaurant attendance tracking, 1-click check-ins, daily work shifts, and monthly payroll timesheets.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'sheet' && (
            <button
              onClick={handleMarkAllPresent}
              className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition shadow-xs"
              title="Mark all unmarked staff present for this day"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Mark All Present</span>
            </button>
          )}

          <button
            onClick={openAddStaffModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bronze-btn text-white text-xs font-semibold tracking-wide shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Active Staff */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Staff</span>
            <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-stone-900">{stats.totalStaff}</div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Active team members</span>
        </div>

        {/* Present Today */}
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Present</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-emerald-700">{stats.present}</div>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">On duty today</span>
        </div>

        {/* Late Today */}
        <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Late</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-amber-700">{stats.late}</div>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Delayed check-ins</span>
        </div>

        {/* Absent & On Leave */}
        <div className="bg-white border border-rose-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Absent / Leave</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Coffee className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-rose-700">
            {stats.absent + stats.onLeave + stats.halfDay}
          </div>
          <span className="text-[10px] text-rose-600 mt-0.5 block">
            {stats.absent} Absent • {stats.onLeave} Leave
          </span>
        </div>

        {/* Attendance Rate */}
        <div className="col-span-2 sm:col-span-1 bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Presence Rate</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-stone-900">{stats.attendanceRate}%</div>
          <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, stats.attendanceRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center space-x-1.5 border-b border-stone-200 pb-2">
        <button
          onClick={() => setActiveTab('sheet')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition ${
            activeTab === 'sheet'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Daily Attendance Sheet</span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition ${
            activeTab === 'directory'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Staff Directory ({stats.totalStaff})</span>
        </button>

        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition ${
            activeTab === 'monthly'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Monthly Timesheet</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: DAILY ATTENDANCE SHEET
         ===================================================================== */}
      {activeTab === 'sheet' && (
        <div className="space-y-4">
          {/* Date Navigator Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200/90 rounded-2xl p-3.5 shadow-xs">
            {/* Quick Date Switcher */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => shiftDate(-1)}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setSelectedDate(getNepalDateString())}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  selectedDate === getNepalDateString()
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Today
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />

              <button
                onClick={() => shiftDate(1)}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Department & Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Department Dropdown */}
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-700 focus:outline-hidden"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'All' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-700 focus:outline-hidden"
              >
                <option value="All">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
                <option value="on_leave">On Leave</option>
                <option value="unmarked">Unmarked</option>
              </select>

              {/* Search Bar */}
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs placeholder:text-stone-400 focus:outline-hidden focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* If 0 staff exist at all */}
          {stats.totalStaff === 0 && !loading && (
            <div className="bg-white border border-dashed border-amber-300 rounded-3xl p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-serif font-bold text-stone-900 mb-1">
                  No Staff Members Enrolled Yet
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Start tracking kitchen masters, waitstaff, bartenders, and cashiers. Add individual staff or load the standard restaurant template in 1 click!
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleSeedDemoStaff}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold tracking-wide transition shadow-xs flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Load Standard Restaurant Team</span>
                </button>
                <button
                  onClick={openAddStaffModal}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition"
                >
                  Add Staff Member Manually
                </button>
              </div>
            </div>
          )}

          {/* Daily Attendance Cards List */}
          {filteredAttendance.length > 0 && (
            <div className="space-y-3">
              {filteredAttendance.map((item) => {
                const { staff, attendance, status } = item;
                const statusMeta = getStatusBadge(status);
                const deptClass = getDepartmentBadge(staff.department);

                return (
                  <div
                    key={staff.id}
                    className="bg-white border border-stone-200/90 hover:border-amber-400/60 rounded-2xl p-4 sm:p-5 transition shadow-xs hover:shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Left: Staff Profile & Designation */}
                    <div className="flex items-start sm:items-center space-x-3.5 min-w-[260px]">
                      {/* Avatar Circle */}
                      <div className="w-11 h-11 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 font-bold text-sm shrink-0">
                        {staff.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif font-bold text-sm text-stone-900">{staff.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${deptClass}`}
                          >
                            {staff.department}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          <span className="text-stone-700 font-medium">{staff.role}</span>
                          <span>•</span>
                          <span className="text-stone-500 text-[11px] font-mono">Shift: {staff.shift}</span>
                          {staff.phone && (
                            <>
                              <span>•</span>
                              <a
                                href={`tel:${staff.phone}`}
                                className="text-amber-700 hover:underline flex items-center space-x-1"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{staff.phone}</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: 5 Status Quick Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Present */}
                      <button
                        onClick={() => handleSetStatus(staff.id, 'present', attendance)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                          status === 'present'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Present</span>
                      </button>

                      {/* Late */}
                      <button
                        onClick={() => handleSetStatus(staff.id, 'late', attendance)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                          status === 'late'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Late</span>
                      </button>

                      {/* Half Day */}
                      <button
                        onClick={() => handleSetStatus(staff.id, 'half_day', attendance)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                          status === 'half_day'
                            ? 'bg-orange-600 text-white border-orange-700 shadow-xs'
                            : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                        <span>Half Day</span>
                      </button>

                      {/* Absent */}
                      <button
                        onClick={() => handleSetStatus(staff.id, 'absent', attendance)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                          status === 'absent'
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                            : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span>Absent</span>
                      </button>

                      {/* On Leave */}
                      <button
                        onClick={() => handleSetStatus(staff.id, 'on_leave', attendance)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                          status === 'on_leave'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                        <span>Leave</span>
                      </button>
                    </div>

                    {/* Right: Clock In/Out Times & Action Menu */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                      {/* Check-In Badge / Quick Action */}
                      {attendance?.checkInTime ? (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-stone-500 block">Check In</span>
                          <span className="font-mono font-bold text-xs text-stone-800">
                            {attendance.checkInTime}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClockInNow(staff.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200 text-[11px] font-bold transition flex items-center space-x-1"
                          title="Record current time as Check In"
                        >
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Check In Now</span>
                        </button>
                      )}

                      {/* Check-Out Badge / Quick Action */}
                      {attendance?.checkOutTime ? (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-stone-500 block">Check Out</span>
                          <span className="font-mono font-bold text-xs text-stone-800">
                            {attendance.checkOutTime}
                          </span>
                        </div>
                      ) : (
                        attendance?.checkInTime && (
                          <button
                            onClick={() => handleClockOutNow(staff.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200 text-[11px] font-bold transition flex items-center space-x-1"
                            title="Record current time as Check Out"
                          >
                            <Clock className="w-3 h-3 text-stone-500" />
                            <span>Clock Out</span>
                          </button>
                        )
                      )}

                      {/* Worked Hours Pill */}
                      {attendance?.hoursWorked && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-mono font-bold">
                          {attendance.hoursWorked} hrs
                        </span>
                      )}

                      {/* Notes / Reason Preview */}
                      {attendance?.notes && (
                        <span
                          className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-[11px] text-stone-600 max-w-[150px] truncate"
                          title={attendance.notes}
                        >
                          💬 {attendance.notes}
                        </span>
                      )}

                      {/* Edit Time / Notes Icon */}
                      <button
                        onClick={() => {
                          setActiveTimeStaff({
                            staff,
                            attendance,
                            status: attendance?.status || 'present',
                            checkInTime: attendance?.checkInTime || '09:00 AM',
                            checkOutTime: attendance?.checkOutTime || '',
                            shift: attendance?.shift || staff.shift,
                            notes: attendance?.notes || '',
                          });
                          setIsTimeModalOpen(true);
                        }}
                        className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition"
                        title="Edit check-in, check-out times, and remarks"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Clear Record */}
                      {attendance && (
                        <button
                          onClick={() => handleClearRecord(staff.id)}
                          className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Clear attendance for this day"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No search matches */}
          {filteredAttendance.length === 0 && stats.totalStaff > 0 && (
            <div className="bg-white border border-stone-200 rounded-3xl p-8 text-center text-stone-500 text-xs">
              No staff members found matching &quot;{searchQuery}&quot; or selected filters.
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: STAFF DIRECTORY & WORKFORCE ROSTER
         ===================================================================== */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Search & Department bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200/90 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center space-x-2">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-700 focus:outline-hidden"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'All' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
              <span className="text-xs text-stone-500">
                Showing {filteredDirectory.length} of {directoryList.length} staff
              </span>
            </div>

            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, role, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs placeholder:text-stone-400 focus:outline-hidden focus:bg-white"
              />
            </div>
          </div>

          {/* Directory Table / Cards */}
          <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 border-b border-stone-200 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3.5 px-5">Staff Member</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Shift</th>
                    <th className="py-3.5 px-4">System Access</th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4">Remuneration</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredDirectory.map((staff) => {
                    const deptClass = getDepartmentBadge(staff.department);
                    return (
                      <tr key={staff.id} className="hover:bg-amber-50/20 transition">
                        {/* Name & Role */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
                              {staff.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .substring(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <span className="font-serif font-bold text-stone-900 block text-xs">
                                {staff.name}
                              </span>
                              <span className="text-[11px] text-stone-500">{staff.role}</span>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${deptClass}`}
                          >
                            {staff.department}
                          </span>
                        </td>

                        {/* Shift */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-stone-700 text-xs font-semibold">
                            {staff.shift}
                          </span>
                        </td>

                        {/* System Access Role & PIN */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border uppercase ${
                                staff.systemRole === 'CHEF'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : staff.systemRole === 'CASHIER'
                                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                                  : staff.systemRole === 'MANAGER'
                                  ? 'bg-purple-50 text-purple-800 border-purple-300'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              }`}
                            >
                              {staff.systemRole || 'WAITER'}
                            </span>
                            {staff.hasPin && (
                              <span className="text-[10px] text-stone-500 font-mono" title="PIN is configured for quick switch">
                                🔑 PIN
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4">
                          {staff.phone ? (
                            <a
                              href={`tel:${staff.phone}`}
                              className="text-stone-700 hover:text-amber-700 font-mono text-xs flex items-center space-x-1"
                            >
                              <Phone className="w-3 h-3 text-stone-400" />
                              <span>{staff.phone}</span>
                            </a>
                          ) : (
                            <span className="text-stone-400 italic">None</span>
                          )}
                        </td>

                        {/* Remuneration */}
                        <td className="py-3.5 px-4">
                          {staff.salary ? (
                            <span className="font-semibold text-stone-900 text-xs">
                              {formatNPR(staff.salary)}
                              <span className="text-[10px] text-stone-500 font-normal">
                                /{staff.salaryType || 'mo'}
                              </span>
                            </span>
                          ) : (
                            <span className="text-stone-400 italic">Unset</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              staff.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : staff.status === 'on_leave'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {staff.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditStaffModal(staff)}
                              className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition"
                              title="Edit Staff Member"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingStaff(staff)}
                              className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Staff Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredDirectory.length === 0 && (
              <div className="p-8 text-center text-stone-500 text-xs">
                No staff members match the query.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: MONTHLY TIMESHEET & ANALYTICS
         ===================================================================== */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          {/* Month Navigator Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200/90 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Select Month:
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-stone-50 text-xs font-semibold text-stone-800 focus:outline-hidden"
              />
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition"
            >
              <Printer className="w-4 h-4 text-stone-500" />
              <span>Print Timesheet</span>
            </button>
          </div>

          {/* Monthly High-Level Cards */}
          {monthlyData?.monthStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Total Shifts Logged
                </span>
                <span className="text-2xl font-serif font-bold text-stone-900 block mt-1">
                  {monthlyData.monthStats.totalRecords}
                </span>
              </div>

              <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                  Total Present Days
                </span>
                <span className="text-2xl font-serif font-bold text-emerald-700 block mt-1">
                  {monthlyData.monthStats.totalPresent}
                </span>
              </div>

              <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">
                  Total Hours Worked
                </span>
                <span className="text-2xl font-serif font-bold text-amber-700 block mt-1">
                  {monthlyData.monthStats.totalWorkedHours} hrs
                </span>
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">
                  Monthly Presence Rate
                </span>
                <span className="text-2xl font-serif font-bold text-stone-900 block mt-1">
                  {monthlyData.monthStats.overallRate}%
                </span>
              </div>
            </div>
          )}

          {/* Timesheet Summary Table */}
          <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 border-b border-stone-200 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3.5 px-5">Staff Member</th>
                    <th className="py-3.5 px-4 text-center">Present</th>
                    <th className="py-3.5 px-4 text-center">Late</th>
                    <th className="py-3.5 px-4 text-center">Half Day</th>
                    <th className="py-3.5 px-4 text-center">Absent</th>
                    <th className="py-3.5 px-4 text-center">Leave</th>
                    <th className="py-3.5 px-4 text-center">Total Hours</th>
                    <th className="py-3.5 px-5 text-right">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {monthlyData?.staffSummaries.map((item: any) => {
                    const { staff, present, late, halfDay, absent, onLeave, totalHours, attendanceRate } = item;
                    return (
                      <tr key={staff.id} className="hover:bg-stone-50/60 transition">
                        <td className="py-3.5 px-5">
                          <span className="font-serif font-bold text-stone-900 block">
                            {staff.name}
                          </span>
                          <span className="text-[11px] text-stone-500">
                            {staff.role} • {staff.department}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold font-mono">
                            {present}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold font-mono">
                            {late}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 font-bold font-mono">
                            {halfDay}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold font-mono">
                            {absent}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-bold font-mono">
                            {onLeave}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-semibold text-stone-800">
                          {totalHours > 0 ? `${totalHours} hrs` : '-'}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <span className="font-bold text-stone-900">{attendanceRate}%</span>
                            <div className="w-16 bg-stone-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  attendanceRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, attendanceRate))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ADD / EDIT STAFF MEMBER
         ===================================================================== */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900">
                  {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Enter personnel information for attendance and payroll records.
                </p>
              </div>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
              {/* Full Name */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Karki"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Role & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Role / Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Head Chef, Waiter"
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Department</label>
                  <select
                    value={staffForm.department}
                    onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                  >
                    <option value="Kitchen">Kitchen</option>
                    <option value="Service">Service</option>
                    <option value="Bar">Bar</option>
                    <option value="Management">Management</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              {/* System Access Role & Quick POS PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-amber-500/5 p-3.5 rounded-2xl border border-amber-500/20">
                <div>
                  <label className="font-bold text-stone-800 flex items-center space-x-1.5 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>System Role (Dashboard Access)</span>
                  </label>
                  <select
                    value={staffForm.systemRole}
                    onChange={(e) => setStaffForm({ ...staffForm, systemRole: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-white font-semibold text-stone-800 focus:outline-hidden"
                  >
                    <option value="CHEF">Chef / Kitchen (Orders & Inventory)</option>
                    <option value="WAITER">Waiter / Captain (Orders, Chat & QR)</option>
                    <option value="CASHIER">Cashier (Orders, Billing & Register)</option>
                    <option value="MANAGER">Manager (Full Operational Access)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-800 flex items-center space-x-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>4-Digit Quick PIN</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 1234"
                    value={staffForm.pinCode}
                    onChange={(e) => setStaffForm({ ...staffForm, pinCode: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-white font-mono text-center tracking-widest text-sm font-bold text-stone-900 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">Used for fast tablet role switching</span>
                </div>
              </div>

              {/* Shift & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Default Shift</label>
                  <select
                    value={staffForm.shift}
                    onChange={(e) => setStaffForm({ ...staffForm, shift: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                  >
                    {SHIFTS.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Active Status</label>
                  <select
                    value={staffForm.status}
                    onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="98XXXXXXXX"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="staff@restaurant.com"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Salary & Salary Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Remuneration / Wage (Rs.)</label>
                  <input
                    type="number"
                    placeholder="e.g. 25000"
                    value={staffForm.salary}
                    onChange={(e) => setStaffForm({ ...staffForm, salary: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Frequency</label>
                  <select
                    value={staffForm.salaryType}
                    onChange={(e) => setStaffForm({ ...staffForm, salaryType: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">Specialties & Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Expert in Sekuwa and tandoor, available on weekends"
                  value={staffForm.notes}
                  onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bronze-btn text-white font-bold tracking-wide"
                >
                  {editingStaff ? 'Update Staff Member' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EDIT TIME, SHIFT & NOTES (Clock-in / Clock-out)
         ===================================================================== */}
      {isTimeModalOpen && activeTimeStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900">
                  {activeTimeStaff.staff.name}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Record exact check-in time, checkout time, and remarks for {selectedDate}.
                </p>
              </div>
              <button
                onClick={() => setIsTimeModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTimeModal} className="space-y-4 text-xs">
              {/* Status */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">Status</label>
                <select
                  value={activeTimeStaff.status}
                  onChange={(e) => setActiveTimeStaff({ ...activeTimeStaff, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>

              {/* Check In & Check Out */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Check In Time</label>
                  <input
                    type="text"
                    placeholder="09:00 AM"
                    value={activeTimeStaff.checkInTime}
                    onChange={(e) =>
                      setActiveTimeStaff({ ...activeTimeStaff, checkInTime: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Check Out Time</label>
                  <input
                    type="text"
                    placeholder="05:30 PM"
                    value={activeTimeStaff.checkOutTime}
                    onChange={(e) =>
                      setActiveTimeStaff({ ...activeTimeStaff, checkOutTime: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Shift */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">Working Shift</label>
                <select
                  value={activeTimeStaff.shift}
                  onChange={(e) => setActiveTimeStaff({ ...activeTimeStaff, shift: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">Notes / Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Delayed due to public transport, approved medical leave"
                  value={activeTimeStaff.notes}
                  onChange={(e) => setActiveTimeStaff({ ...activeTimeStaff, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsTimeModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bronze-btn text-white font-bold tracking-wide"
                >
                  Save Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: DELETE CONFIRMATION
         ===================================================================== */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-bold text-stone-900 mb-1">
              Remove {deletingStaff.name}?
            </h3>
            <p className="text-xs text-stone-500 mb-5 leading-relaxed">
              Are you sure you want to remove this staff member and all associated historical attendance records?
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setDeletingStaff(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStaff}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
              >
                Delete Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

