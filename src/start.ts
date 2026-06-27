import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { apiProfileGateMessage } from "./lib/server/api-profile-gate";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const profileApiMiddleware = createMiddleware().server(async ({ request, next }) => {
  const pathname = new URL(request.url).pathname;
  const blocked = apiProfileGateMessage(pathname);
  if (blocked) {
    return Response.json({ ok: false, error: blocked }, { status: 404 });
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [profileApiMiddleware, errorMiddleware],
}));
