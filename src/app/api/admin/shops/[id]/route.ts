import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;

    const shop = await Shop.findById(id).lean();
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    const members = await User.find({ shopId: shop._id }).select("name barberCode slug isActive").lean();

    return NextResponse.json({
      success: true,
      data: {
        _id: shop._id,
        name: shop.name,
        slug: shop.slug,
        isActive: shop.isActive,
        ownerId: shop.ownerId,
        members,
      },
    });
  } catch (error) {
    console.error("Fetch admin shop detail error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();

    const updateData: any = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 80) {
        return NextResponse.json({ success: false, error: { message: "Shop name must be between 2 and 80 characters." } }, { status: 400 });
      }
      updateData.name = name;
    }
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    if (body.catalogueEnabled !== undefined) {
      if (typeof body.catalogueEnabled !== "boolean") return NextResponse.json({ success: false, error: { message: "catalogueEnabled must be true or false." } }, { status: 400 });
      // The catalogue switch of a shop is its owner's (the owner's plan and switch govern the shop catalogue).
      const shopDoc = await Shop.findById(id).select("ownerId").lean<{ ownerId: unknown } | null>();
      if (!shopDoc) return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
      await User.updateOne({ _id: shopDoc.ownerId }, { $set: { catalogueEnabled: body.catalogueEnabled } });
    }

    const update: any = { $set: updateData };
    if (body.linkBookingLimit !== undefined) {
      if (body.linkBookingLimit === null || body.linkBookingLimit === "") {
        update.$unset = { linkBookingLimit: 1 };
      } else {
        const n = Number(body.linkBookingLimit);
        if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
          return NextResponse.json({ success: false, error: { message: "Link limit must be a whole number (0 = unlimited)." } }, { status: 400 });
        }
        updateData.linkBookingLimit = n;
      }
    }

    const shop = await Shop.findByIdAndUpdate(id, update, { new: true });
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: shop });
  } catch (error) {
    console.error("Update admin shop error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;

    const shop = await Shop.findById(id);
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    // Every member (including the owner) reverts to being a solo barber —
    // their own bookings, slots, and public link are completely unaffected.
    await User.updateMany({ shopId: shop._id }, { $set: { shopId: null } });
    await Shop.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: { message: "Shop deleted." } });
  } catch (error) {
    console.error("Delete admin shop error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
