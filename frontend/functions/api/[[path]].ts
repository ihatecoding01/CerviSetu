interface Env {
  BACKEND_TUNNEL_URL?: string;
  VITE_API_BASE_URL?: string;
}

const DEFAULT_BACKEND_URL = "https://health-hackathon-8bhk.onrender.com";

export const onRequest: PagesFunction<Env> = async (context) => {
  const targetBackend = (
    context.env.BACKEND_TUNNEL_URL ||
    context.env.VITE_API_BASE_URL ||
    DEFAULT_BACKEND_URL
  )?.trim().replace(/\/+$/, "");

  const url = new URL(context.request.url);
  const targetUrl = `${targetBackend}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set("X-Forwarded-Host", url.host);

  const init: RequestInit = {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "follow",
  };

  try {
    const res = await fetch(targetUrl, init);
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        error: "BACKEND_UNREACHABLE",
        message: `Failed to reach backend at ${targetBackend}.`,
        detail: message,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

