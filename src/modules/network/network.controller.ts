import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppBindings } from "../../types/env";
import { networkRepository } from "./network.repository";
import {
  createEdgeSchema,
  listEdgesSchema,
  deleteEdgeSchema,
} from "./network.schema";

export const createEdge = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[network.createEdge] request received", {
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const body = await c.req.json();
    const parsed = createEdgeSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "Invalid edge creation payload",
        cause: parsed.error.flatten(),
      });
    }

    const edge = await networkRepository.createEdge(c, parsed.data);

    console.log("[network.createEdge] success", {
      edgeId: edge.id,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 201,
        message: "Edge created successfully",
        data: edge,
      },
      201,
    );
  } catch (error) {
    console.error("[network.createEdge] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to create edge",
    });
  }
};

export const listEdges = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[network.listEdges] request received", {
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const sourceId = c.req.query("sourceId");
    const destinationId = c.req.query("destinationId");
    const edgeType = c.req.query("edgeType");

    const parsed = listEdgesSchema.safeParse({
      sourceId,
      destinationId,
      edgeType,
    });

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "Invalid query parameters",
        cause: parsed.error.flatten(),
      });
    }

    const edges = await networkRepository.listEdges(c, parsed.data);

    console.log("[network.listEdges] success", {
      count: edges.length,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "Edges fetched successfully",
        data: edges,
      },
      200,
    );
  } catch (error) {
    console.error("[network.listEdges] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to list edges",
    });
  }
};

export const getOutgoingEdges = async (
  c: Context<{ Bindings: AppBindings }>,
) => {
  const startMs = Date.now();
  const sourceId = c.req.param("sourceId");

  console.log("[network.getOutgoingEdges] request received", {
    method: c.req.method,
    path: c.req.path,
    sourceId,
    timestamp: new Date().toISOString(),
  });

  try {
    if (!sourceId) {
      throw new HTTPException(400, { message: "Source ID is required" });
    }

    const edges = await networkRepository.getOutgoingEdges(c, sourceId);

    console.log("[network.getOutgoingEdges] success", {
      sourceId,
      count: edges.length,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "Outgoing edges fetched successfully",
        data: edges,
      },
      200,
    );
  } catch (error) {
    console.error("[network.getOutgoingEdges] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to fetch outgoing edges",
    });
  }
};

export const getIncomingEdges = async (
  c: Context<{ Bindings: AppBindings }>,
) => {
  const startMs = Date.now();
  const destinationId = c.req.param("destinationId");

  console.log("[network.getIncomingEdges] request received", {
    method: c.req.method,
    path: c.req.path,
    destinationId,
    timestamp: new Date().toISOString(),
  });

  try {
    if (!destinationId) {
      throw new HTTPException(400, { message: "Destination ID is required" });
    }

    const edges = await networkRepository.getIncomingEdges(c, destinationId);

    console.log("[network.getIncomingEdges] success", {
      destinationId,
      count: edges.length,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "Incoming edges fetched successfully",
        data: edges,
      },
      200,
    );
  } catch (error) {
    console.error("[network.getIncomingEdges] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to fetch incoming edges",
    });
  }
};

export const deleteEdge = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[network.deleteEdge] request received", {
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const body = await c.req.json();
    const parsed = deleteEdgeSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "Invalid delete payload",
        cause: parsed.error.flatten(),
      });
    }

    const edge = await networkRepository.getEdge(c, parsed.data.edgeId);
    if (!edge) {
      throw new HTTPException(404, { message: "Edge not found" });
    }

    await networkRepository.deleteEdge(c, parsed.data.edgeId);

    console.log("[network.deleteEdge] success", {
      edgeId: parsed.data.edgeId,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "Edge deleted successfully",
        data: { edgeId: parsed.data.edgeId },
      },
      200,
    );
  } catch (error) {
    console.error("[network.deleteEdge] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to delete edge",
    });
  }
};
