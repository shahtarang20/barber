import { parse, isValid, format } from "date-fns";

const parseTime = (timeStr: string, date: Date) => {
  const cleanStr = timeStr.trim().toLowerCase();
  if (cleanStr.includes("am") || cleanStr.includes("pm")) {
    const strWithSpace = cleanStr.replace(/([0-9])(am|pm)/, "$1 $2");
    const parsed = parse(strWithSpace, "h:mm a", date);
    if (isValid(parsed)) return parsed;
  }
  const parsed24h = parse(cleanStr, "HH:mm", date);
  if (isValid(parsed24h)) return parsed24h;
  throw new Error(`Unable to parse time value: "${timeStr}"`);
};

console.log("Parsing '10:00 AM':", format(parseTime("10:00 AM", new Date()), "HH:mm"));
console.log("Parsing '07:00 PM':", format(parseTime("07:00 PM", new Date()), "HH:mm"));

