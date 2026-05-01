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
