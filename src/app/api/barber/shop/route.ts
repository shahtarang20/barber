import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { ShopInvite } from "@/models/ShopInvite";
import { z } from "zod";
import { effectivePlan, staffLevel } from "@/lib/plans";

const createShopSchema = z.object({
  name: z.string().min(2, "Shop name must be at least 2 characters").max(80, "Shop name is too long"),
  slug: z
    .string()
    .min(3, "Shop URL must be at least 3 characters")
    .max(50, "Shop URL is too long")
    .regex(/^[a-z0-9-]+$/, "Shop URL can only contain lowercase letters, numbers, and hyphens"),
});

export async function GET(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findById(payload.userId).select("shopId");
    if (!user?.shopId) {
      return NextResponse.json({ success: true, data: null });
    }

    const shop = await Shop.findById(user.shopId);
    if (!shop) {
      return NextResponse.json({ success: true, data: null });
    }

    const members = await User.find({ shopId: shop._id }).select("name barberCode slug profileImage");
    const isOwner = shop.ownerId.toString() === payload.userId;
    const pending = isOwner ? await ShopInvite.find({ shopId: shop._id, status: "PENDING" }).populate("barberId", "name barberCode") : [];
    const pendingInvites = pending.map((i: any) => ({ _id: i._id, name: i.barberId?.name, barberCode: i.barberId?.barberCode }));

    // What this viewer may do with the shop catalogue and numbers (owner: everything; staff: what the owner allowed AND the plan still permits).
    const level = staffLevel((await effectivePlan(shop.ownerId.toString())).limits.tier);
    const grants: { userId: { toString(): string }; catalogue: boolean; analytics: boolean }[] = shop.staff || [];
    const mine = grants.find((g) => g.userId.toString() === payload.userId);
    const myAccess = isOwner
      ? { catalogue: true, analytics: true, level: "OWNER" }
      : { catalogue: !!mine?.catalogue && level !== "NONE", analytics: !!mine?.analytics && level === "FULL", level };
    const staff = isOwner ? grants.map((g) => ({ userId: g.userId.toString(), catalogue: g.catalogue, analytics: g.analytics })) : undefined;

    return NextResponse.json({
      success: true,
      data: {
        myAccess,
        staff,
        staffLevel: isOwner ? level : undefined,
        _id: shop._id,
        name: shop.name,
        slug: shop.slug,
        ownerId: shop.ownerId,
        isOwner: shop.ownerId.toString() === payload.userId,
        viewerId: payload.userId,
        members,
        pendingInvites,
      },
    });
  } catch (error) {
    console.error("Fetch shop error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const result = createShopSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }
    const { name, slug } = result.data;

    await connectToDatabase();

    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    }
    if (user.shopId) {
      return NextResponse.json({ success: false, error: { message: "You already belong to a shop. Leave it before creating a new one." } }, { status: 400 });
    }

    const existingSlug = await Shop.findOne({ slug });
    if (existingSlug) {
      return NextResponse.json({ success: false, error: { message: "That shop URL is already taken." } }, { status: 400 });
    }

    const shop = await Shop.create({
      name,
      slug,
      ownerId: user._id,
      barberIds: [user._id],
    });

    user.shopId = shop._id;
    await user.save();

    return NextResponse.json({ success: true, data: { _id: shop._id, name: shop.name, slug: shop.slug } }, { status: 201 });
  } catch (error) {
    console.error("Create shop error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findById(payload.userId);
    if (!user?.shopId) {
      return NextResponse.json({ success: false, error: { message: "You don't belong to a shop." } }, { status: 400 });
    }

    const shop = await Shop.findById(user.shopId);
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found." } }, { status: 404 });
    }

    if (shop.ownerId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Only the shop owner can delete the shop." } }, { status: 403 });
    }

    // Every member (including the owner) reverts to being a solo barber —
    // nobody's own bookings, slots, or public link are touched by this.
    await User.updateMany({ shopId: shop._id }, { $set: { shopId: null } });
    await Shop.findByIdAndDelete(shop._id);

    return NextResponse.json({ success: true, data: { message: "Shop deleted." } });
  } catch (error) {
    console.error("Delete shop error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
