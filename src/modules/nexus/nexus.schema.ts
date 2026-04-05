import { z } from "zod";

const phoneNumberSchema = z
  .string()
  .min(4, "Phone number too short")
  .max(20, "Phone number too long");

export const bulkSyncSchema = z.object({
  /** Raw phone numbers from the device contact list. Server normalizes + hashes them. Max 5 000. */
  phoneNumbers: z.array(phoneNumberSchema).max(5_000),
});

export const singleSyncSchema = z.object({
  /** Raw phone number of a newly-added contact. Server normalizes + hashes it. */
  phoneNumber: phoneNumberSchema,
});

export type BulkSyncInput = z.infer<typeof bulkSyncSchema>;
export type SingleSyncInput = z.infer<typeof singleSyncSchema>;
