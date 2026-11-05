interface Env {
  BACKEND_TUNNEL_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const tunnel = context.env.BACKEND_TUNNEL_URL?.trim().replace(/\/+$/, "");

  if (!tunnel) {
    return new Response(
      JSON.stringify({
        error: "TUNNEL_NOT_CONFIGURED",
        message:
          "BACKEND_TUNNEL_URL is not configured in Cloudflare Pages. Set BACKEND_TUNNEL_URL in Pages Settings -> Environment Variables.",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const url = new URL(context.request.url);
  const targetUrl = `${tunnel}${url.pathname}${url.search}`;

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
        error: "TUNNEL_UNREACHABLE",
        message: `Failed to reach backend tunnel at ${tunnel}. Ensure your local backend and cloudflared are running.`,
        detail: message,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

