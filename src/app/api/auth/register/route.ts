import { normalizePhone } from "@/lib/phone";
import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { slugFromName, uniqueSlug } from "@/lib/slug";
import { ensureUserEmailIndex } from "@/lib/ensureIndexes";
import { autoGenerateFutureSlots } from "@/lib/slotGenerator";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name must be at most 80 characters"),
  // Optional — village barbers often have none; they log in with their Barber Code.
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  // Required: the admin needs a way to reach every barber. Stored as the plain 10 digits.
  phone: z.string({ error: "Mobile number is required" }).min(1, "Mobile number is required").transform((v) => normalizePhone(v)).refine((v) => /^\d{10}$/.test(v), { message: "Enter a valid 10-digit mobile number" }),
  password: z.string().min(6, "Password must be at least 6 characters"),
  // Optional: the server makes a clean, unique link from the name when none is given.
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens").optional(),
});

export async function POST(req: Request) {
  try {
    // Stops a script creating accounts (and their slots) in bulk; generous because a carrier's shared IP may serve many real barbers.
    if (!(await rateLimit(`register:${getClientIp(req)}`, 30, 60 * 60_000))) {
      return NextResponse.json({ success: false, error: { message: "Too many sign-ups from this network. Please try again later." } }, { status: 429 });
    }
    await connectToDatabase();
    
    const body = await req.json();
    const result = registerSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }
    
    const { name, password } = result.data;
    // Login looks emails up in lower case, so store them that way (otherwise "Rahul@x.com" could never log in by email).
    const email = result.data.email ? result.data.email.toLowerCase() : undefined;
    await ensureUserEmailIndex();
    let slug = result.data.slug || (await uniqueSlug(slugFromName(name)));
    
    // Check if user exists
    // A link we made ourselves can only clash with a simultaneous sign-up, which the retry below handles.
    const conflicts = [...(email ? [{ email }] : []), ...(result.data.slug ? [{ slug }] : [])];
    const existingUser = conflicts.length ? await User.findOne({ $or: conflicts }) : null;
    if (existingUser) {
      if (email && existingUser.email === email) {
        return NextResponse.json({ success: false, error: { message: "Email already registered" } }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: { message: "Booking URL slug is already taken" } }, { status: 400 });
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Default working hours
    const defaultWorkingHours = [
      { day: "Monday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Tuesday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Wednesday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Thursday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Friday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Saturday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Sunday", isClosed: true },
    ];
    
    // Create user (barberCode is auto-generated via pre-save hook)
    let newUser;
    for (let attempt = 0; ; attempt++) {
      newUser = new User({ name, phone: result.data.phone, ...(email ? { email } : {}), passwordHash, slug, role: "BARBER", workingHours: defaultWorkingHours });
      try {
        await newUser.save();
        break;
      } catch (err) {
        // Two people picked the same link at the same instant: find the next free one and try again.
        const dup = (err as { code?: number; keyPattern?: Record<string, unknown> });
        if (dup.code === 11000 && dup.keyPattern?.email) {
          return NextResponse.json({ success: false, error: { message: "Email already registered" } }, { status: 400 });
        }
        if (dup.code === 11000 && dup.keyPattern?.slug && result.data.slug) {
          return NextResponse.json({ success: false, error: { message: "Booking URL slug is already taken" } }, { status: 400 });
        }
        if (dup.code === 11000 && dup.keyPattern?.slug && !result.data.slug && attempt < 8) {
          // First retry takes the next free tidy link; if many people collide at once, fall back to a short random tail.
          slug = attempt === 0 ? await uniqueSlug(slugFromName(name)) : `${slugFromName(name)}-${Math.floor(1000 + Math.random() * 9000)}`;
          continue;
        }
        throw err;
      }
    }
    
    // Give the new barber his time slots right away, so a customer who opens his link
    // straight after sign-up sees times to book (otherwise nothing exists until he saves
    // Settings or the daily job runs). If this fails sign-up still works; the daily job fills it in.
    try {
      await autoGenerateFutureSlots(newUser._id.toString(), defaultWorkingHours, newUser.slotDuration || 30, newUser.defaultCapacity || 1);
    } catch (slotError) {
      console.error("Could not create first slots at sign-up:", slotError);
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        id: newUser._id, 
        name: newUser.name, 
        barberCode: newUser.barberCode,
        slug: newUser.slug
      } 
    }, { status: 201 });
    
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
