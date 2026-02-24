import AsyncStorage from '@react-native-async-storage/async-storage';

const SHIFTS_KEY = '@zenotime/shifts';

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  clockIn: number;
  clockOut: number;
  breakStart?: number;
  breakEnd?: number;
  workTimeSeconds: number;
  breakTimeSeconds: number;
}

export async function getShifts(): Promise<Shift[]> {
  const raw = await AsyncStorage.getItem(SHIFTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveShift(shift: Shift): Promise<void> {
  const shifts = await getShifts();
  const updated = [...shifts.filter((s) => s.id !== shift.id), shift];
  await AsyncStorage.setItem(SHIFTS_KEY, JSON.stringify(updated));
}

export async function getShiftsForWeek(startDate: Date): Promise<Shift[]> {
  const shifts = await getShifts();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const start = startDate.getTime();
  const end = endDate.getTime();
  return shifts.filter((s) => {
    const shiftDate = new Date(s.date + 'T12:00:00').getTime();
    return shiftDate >= start && shiftDate <= end;
  });
}
