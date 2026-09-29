import { Slot } from "@/models/Slot";
import { format, addDays, parse, isValid, addMinutes, startOfDay } from "date-fns";
import { parseDateOnly } from "@/lib/timeSort";

export async function autoGenerateFutureSlots(
  barberId: string,
  workingHours: any[],
  slotDuration: number
) {
  const today = startOfDay(new Date());
  const maxFutureDate = addDays(today, 90);
  const todayStr = format(today, "yyyy-MM-dd");
  
  // 1. Fetch all existing slots for the next 90 days to avoid duplicates
  const existingSlots = await Slot.find({
    barberId,
    date: { $gte: todayStr }
  }).select("date startTime bookingsCount isCustomCapacity");

  const existingMap = new Map();
  for (const s of existingSlots) {
    existingMap.set(`${s.date}_${s.startTime}`, s);
  }

  const newSlots = [];
  const parseTimeCache = new Map<string, Date>();

  const parseTime = (timeStr: string, dateObj: Date) => {
    const cleanStr = timeStr.trim().toLowerCase();
    const cacheKey = `${cleanStr}_${dateObj.getTime()}`;
    if (parseTimeCache.has(cacheKey)) return parseTimeCache.get(cacheKey)!;

    if (cleanStr.includes("am") || cleanStr.includes("pm")) {
      const strWithSpace = cleanStr.replace(/([0-9])(am|pm)/, "$1 $2");
      const parsed = parse(strWithSpace, "h:mm a", dateObj);
      if (isValid(parsed)) {
        parseTimeCache.set(cacheKey, parsed);
        return parsed;
      }
    }
    const parsed24h = parse(cleanStr, "HH:mm", dateObj);
    if (isValid(parsed24h)) {
      parseTimeCache.set(cacheKey, parsed24h);
      return parsed24h;
    }
    throw new Error(`Unable to parse time: ${timeStr}`);
  };

  // 2. Loop through the next 90 days
  for (let i = 0; i < 90; i++) {
    const currentDate = addDays(today, i);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayOfWeek = format(currentDate, "EEEE");
    
    const dayConfig = workingHours.find(h => h.day === dayOfWeek);
    if (!dayConfig || dayConfig.isClosed || !dayConfig.startTime || !dayConfig.endTime) {
      continue;
    }

    try {
      const startObj = parseTime(dayConfig.startTime, currentDate);
      const endObj = parseTime(dayConfig.endTime, currentDate);
      
      let currentSlotStart = startObj;
      
      while (currentSlotStart < endObj) {
        const currentSlotEnd = addMinutes(currentSlotStart, slotDuration);
        if (currentSlotEnd > endObj) break;
        
        const startTimeStr = format(currentSlotStart, "h:mm a");
        const endTimeStr = format(currentSlotEnd, "h:mm a");
        const key = `${dateStr}_${startTimeStr}`;
        
        if (!existingMap.has(key)) {
          newSlots.push({
            barberId,
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            status: "AVAILABLE",
            capacity: 1, // Default capacity, can be updated by barber per-slot later
            bookingsCount: 0,
            isCustomCapacity: false
          });
        }
        
        currentSlotStart = currentSlotEnd;
      }
    } catch (e) {
      // Ignore days with invalid time configurations
      console.error(`Error generating slots for ${dateStr}:`, e);
    }
  }

  // 3. Bulk insert new slots
  if (newSlots.length > 0) {
    try {
      await Slot.insertMany(newSlots, { ordered: false });
    } catch (err: any) {
      // Ignore duplicate key errors (code 11000) that might happen due to race conditions
      if (err?.code !== 11000 && !(err?.writeErrors?.every((e: any) => e.code === 11000))) {
        throw err;
      }
    }
  }
  
  return newSlots.length;
}
