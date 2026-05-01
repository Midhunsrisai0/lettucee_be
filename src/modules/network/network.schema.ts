import { z } from "zod";

export const createEdgeSchema = z.object({
  source: z.string().min(1, "Source user ID is required"),
  edge: z.string().min(1, "Edge type is required"),
  destination: z.string().min(1, "Destination user ID is required").optional(),
});

export type CreateEdgeInput = z.infer<typeof createEdgeSchema>;

export const listEdgesSchema = z.object({
  sourceId: z.string().optional(),
  destinationId: z.string().optional(),
  edgeType: z.string().optional(),
});

export type ListEdgesInput = z.infer<typeof listEdgesSchema>;

export const deleteEdgeSchema = z.object({
  edgeId: z.string().min(1, "Edge ID is required"),
});

export type DeleteEdgeInput = z.infer<typeof deleteEdgeSchema>;

export const syncContactsSchema = z.object({
  phoneNumbers: z
    .array(z.string().min(1, "Phone number is required"))
    .min(1, "At least one phone number is required"),
});

export type SyncContactsInput = z.infer<typeof syncContactsSchema>;
