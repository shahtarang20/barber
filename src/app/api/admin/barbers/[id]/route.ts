import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { normalizePhone } from "@/lib/phone";
import { audit } from "@/lib/planAdmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: { message: "Invalid barber." } }, { status: 400 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: { message: "Invalid request." } }, { status: 400 });
    const updateData: any = {};

    if (body.premiumAmount !== undefined) {
      const amount = typeof body.premiumAmount === "number" || (typeof body.premiumAmount === "string" && body.premiumAmount.trim() !== "") ? Number(body.premiumAmount) : NaN;
      if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) {
        return NextResponse.json({ success: false, error: { message: "Premium amount must be a number between 0 and 10,00,00,000." } }, { status: 400 });
      }
      updateData.premiumAmount = amount;
    }

    if (body.premiumDueDay !== undefined) {
      const day = Number(body.premiumDueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return NextResponse.json({ success: false, error: { message: "Premium due day must be a whole number between 1 and 31." } }, { status: 400 });
      }
      updateData.premiumDueDay = day;
    }

    if (body.linkBookingLimit !== undefined) {
      // null / empty = use the platform default; 0 = unlimited.
      if (body.linkBookingLimit === null || body.linkBookingLimit === "") {
        updateData.$unset = { linkBookingLimit: 1 };
      } else {
        const n = Number(body.linkBookingLimit);
        if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
          return NextResponse.json({ success: false, error: { message: "Link limit must be a whole number (0 = unlimited)." } }, { status: 400 });
        }
        updateData.linkBookingLimit = n;
      }
    }

    if (body.visitorLimit !== undefined) {
      // null / empty = use the platform default; 0 = unlimited.
      if (body.visitorLimit === null || body.visitorLimit === "") {
        updateData.$unset = { ...(updateData.$unset || {}), visitorLimit: 1 };
      } else {
        const n = Number(body.visitorLimit);
        if (!Number.isInteger(n) || n < 0 || n > 100_000_000) {
          return NextResponse.json({ success: false, error: { message: "Visitor limit must be a whole number (0 = unlimited)." } }, { status: 400 });
        }
        updateData.visitorLimit = n;
      }
    }

    let suspending = false;
    if (body.phone !== undefined) {
      const raw = String(body.phone ?? "").trim();
      if (raw === "") {
        updateData.$unset = { ...(updateData.$unset || {}), phone: 1 };
      } else {
        const digits = normalizePhone(raw);
        if (!/^\d{10}$/.test(digits)) {
          return NextResponse.json({ success: false, error: { message: "Enter a valid 10-digit mobile number (or leave it empty to remove it)." } }, { status: 400 });
        }
        updateData.phone = digits;
      }
    }

    if (body.catalogueEnabled !== undefined) {
      if (typeof body.catalogueEnabled !== "boolean") {
        return NextResponse.json({ success: false, error: { message: "catalogueEnabled must be true or false." } }, { status: 400 });
      }
      updateData.catalogueEnabled = body.catalogueEnabled;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") return NextResponse.json({ success: false, error: { message: "isActive must be true or false." } }, { status: 400 });
      updateData.isActive = body.isActive;
      suspending = updateData.isActive === false;
    }

    if (suspending) {
      // Force an immediate logout of any session this barber currently has
      // open — flipping isActive alone only blocks *future* requests once
      // requireAuth re-checks it; this makes existing tokens invalid too.
      updateData.$inc = { tokenVersion: 1 };
    }

    const { $inc, $unset, ...setFields } = updateData;
    const updateQuery: any = { $set: setFields };
    if ($unset) updateQuery.$unset = $unset;
    if ($inc) updateQuery.$inc = $inc;

    const before = await User.findById(id).select("premiumAmount premiumDueDay catalogueEnabled isActive linkBookingLimit visitorLimit").lean<Record<string, unknown> | null>();
    // Only barber accounts: an admin account can never be suspended or edited from this screen (that would lock the admin out).
    const updatedUser = await User.findOneAndUpdate({ _id: id, role: "BARBER" }, updateQuery, { new: true }).select("-passwordHash -tokenVersion");

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: { message: "Barber not found" } }, { status: 404 });
    }

    // Audit trail: money, access and limits are recorded with the before/after values.
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ["premiumAmount", "premiumDueDay", "catalogueEnabled", "isActive", "linkBookingLimit", "visitorLimit"] as const) {
      const to = (updatedUser as unknown as Record<string, unknown>)[k];
      if (before && before[k] !== to) changed[k] = { from: before[k] ?? null, to: to ?? null };
    }
    if (Object.keys(changed).length > 0) {
      const admin = await User.findById(payload.userId).select("name").lean<{ name: string } | null>();
      await audit({ id: payload.userId, name: admin?.name || "Admin" }, "BARBER_SETTINGS_CHANGED", updatedUser, { changed });
    }

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Update barber error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
