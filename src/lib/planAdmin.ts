import mongoose from "mongoose";
import { User } from "@/models/User";
import { PlanPayment } from "@/models/PlanPayment";
import { AuditLog } from "@/models/AuditLog";
import { getTodayISTString } from "@/lib/istTime";
import { addDaysStr, addMonthsStr } from "@/lib/plans";

export class PlanError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface Admin { id: string; name: string }

/** The admin audit trail (who did what to whom). Never throws: a failed log line must not undo the change itself. */
export async function audit(admin: Admin, action: string, target: { _id: unknown; name?: string } | null, metadata?: Record<string, unknown>) {
  try {
    await AuditLog.create({ action, actorId: admin.id, actorName: admin.name, targetId: target?._id, targetName: target?.name, metadata });
  } catch (err) { console.error("Audit log failed:", err); }
}

export interface PaymentInput { amount: number; months: number; method: "CASH" | "UPI" | "BANK" | "OTHER" | "COMPLIMENTARY"; reference?: string; note?: string }

/**
 * Records a payment and extends the plan. The new period starts the day after the current plan ends (so paying early
 * loses nothing), or today if the plan already ended. The plan is moved with a compare-and-set, so a double click or two
 * admins at once cannot add the same months twice.
 */
export async function recordPayment(barberId: string, input: PaymentInput, admin: Admin) {
  if (!mongoose.isValidObjectId(barberId)) throw new PlanError(400, "Invalid barber.");
  const user = await User.findOne({ _id: barberId, role: "BARBER" }).select("name premiumAmount planEndsOn").lean<{ _id: mongoose.Types.ObjectId; name: string; premiumAmount?: number; planEndsOn?: string } | null>();
  if (!user) throw new PlanError(404, "Barber not found.");
  if (!(Number(user.premiumAmount) > 0)) throw new PlanError(400, "Set this barber's monthly Premium (₹) first, then record the payment.");

  const today = getTodayISTString();
  const start = user.planEndsOn && user.planEndsOn >= today ? addDaysStr(user.planEndsOn, 1) : today;
  const end = addDaysStr(addMonthsStr(start, input.months), -1);

  const moved = await User.updateOne(
    { _id: user._id, planEndsOn: user.planEndsOn ?? { $exists: false } },
    { $set: { planEndsOn: end, lastPaymentAt: new Date() }, $unset: { planReminderOn: 1 } }
  );
  if (moved.modifiedCount !== 1) throw new PlanError(409, "This plan was just changed by someone else. Refresh and check before recording again.");
  try {
    const payment = await PlanPayment.create({ barberId: user._id, ...input, periodStart: start, periodEnd: end, recordedBy: admin.id, recordedByName: admin.name });
    await audit(admin, "PLAN_PAYMENT_RECORDED", user, { amount: input.amount, months: input.months, method: input.method, periodStart: start, periodEnd: end, paymentId: String(payment._id) });
    return payment;
  } catch (err) {
    // The history row failed: put the plan back so it never shows time nobody paid for.
    await User.updateOne({ _id: user._id }, user.planEndsOn ? { $set: { planEndsOn: user.planEndsOn } } : { $unset: { planEndsOn: 1 } });
    throw err;
  }
}

/** Marks a payment as void (a mistake) and recalculates the plan end from the payments that remain. The row stays in the history. */
export async function voidPayment(barberId: string, paymentId: string, reason: string, admin: Admin) {
  if (!mongoose.isValidObjectId(barberId) || !mongoose.isValidObjectId(paymentId)) throw new PlanError(400, "Invalid payment.");
  const payment = await PlanPayment.findOneAndUpdate({ _id: paymentId, barberId, status: "PAID" }, { $set: { status: "VOID", voidedAt: new Date(), voidReason: reason } }, { new: true });
  if (!payment) throw new PlanError(404, "Payment not found or already voided.");
  const latest = await PlanPayment.findOne({ barberId, status: "PAID" }).sort({ periodEnd: -1 }).select("periodEnd").lean<{ periodEnd: string } | null>();
  const user = await User.findByIdAndUpdate(barberId, latest ? { $set: { planEndsOn: latest.periodEnd } } : { $unset: { planEndsOn: 1, lastPaymentAt: 1 } }, { new: true }).select("name").lean<{ _id: unknown; name: string } | null>();
  await audit(admin, "PLAN_PAYMENT_VOIDED", user, { paymentId, amount: payment.amount, periodEnd: payment.periodEnd, reason });
  return payment;
}
