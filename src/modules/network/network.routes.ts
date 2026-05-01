import { Hono } from "hono";
import type { AppBindings } from "../../types/env";
import {
  createEdge,
  listEdges,
  getOutgoingEdges,
  getIncomingEdges,
  deleteEdge,
  syncContacts,
} from "./network.controller";

const networkRoutes = new Hono<{ Bindings: AppBindings }>();

// POST /network/edges - Create a new edge
networkRoutes.post("/edges", createEdge);

// GET /network/edges - List edges with optional filters
networkRoutes.get("/edges", listEdges);

// GET /network/edges/outgoing/:sourceId - Get all outgoing edges from a user
networkRoutes.get("/edges/outgoing/:sourceId", getOutgoingEdges);

// GET /network/edges/incoming/:destinationId - Get all incoming edges to a user
networkRoutes.get("/edges/incoming/:destinationId", getIncomingEdges);

// DELETE /network/edges - Delete an edge
networkRoutes.delete("/edges", deleteEdge);

// POST /network/sync-contacts - Sync user contacts (queue-based)
networkRoutes.post("/sync-contacts", syncContacts);

export default networkRoutes;
