export interface Env {
}

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://fhaji.dev',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // Allow all origins in development, or specific origins in production
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost'))) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else {
    // Fallback: allow all (you can restrict this later)
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    try {
      const body = await request.json() as {
        url: string;
        headers: Record<string, string>;
        query: any;
      };

      if (!body.url) {
        return new Response(JSON.stringify({ error: 'URL is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json, multipart/mixed',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      };

      if (body.headers) {
        Object.keys(body.headers).forEach((key) => {
          if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
            defaultHeaders[key] = body.headers[key];
          }
        });
      }

      // Add small delay to appear more human-like
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

      const targetResponse = await fetch(body.url, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify(body.query),
      });

      if (!targetResponse.ok) {
        const errorText = await targetResponse.text();
        return new Response(JSON.stringify({
          error: 'API error',
          status: targetResponse.status,
          details: errorText.substring(0, 500),
        }), {
          status: targetResponse.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Get response data
      const responseData = await targetResponse.text();
      let jsonData;

      try {
        jsonData = JSON.parse(responseData);
      } catch (e) {
        return new Response(JSON.stringify({
          error: 'Invalid JSON response from Target',
          details: responseData.substring(0, 500),
        }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Return successful response
      return new Response(JSON.stringify({
        success: true,
        data: jsonData,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (error: any) {
      console.error('Worker error:', error);

      return new Response(JSON.stringify({
        error: 'Failed to fetch from Target',
        message: error.message,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
};
