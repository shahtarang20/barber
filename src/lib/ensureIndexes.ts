import { User } from "@/models/User";

let emailIndexReady: Promise<void> | null = null;

/**
 * Older databases have a plain unique index on email, which would reject a second barber with no email.
 * Swap it (once per server process) for one that is unique only when an email exists.
 */
export function ensureUserEmailIndex(): Promise<void> {
  if (!emailIndexReady) {
    emailIndexReady = (async () => {
      try {
        const existing = (await User.collection.indexes()).find((i) => i.name === "email_1");
        if (existing && !existing.partialFilterExpression) await User.collection.dropIndex("email_1");
        if (!existing || !existing.partialFilterExpression) {
          await User.collection.createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } }, name: "email_1" });
        }
      } catch (err) {
        console.error("Could not update the email index:", err);
        emailIndexReady = null; // try again next time
      }
    })();
  }
  return emailIndexReady;
}
