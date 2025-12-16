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

    if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost'))) {
        headers['Access-Control-Allow-Origin'] = origin;
    } else {
        headers['Access-Control-Allow-Origin'] = '*';
    }

    return headers;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const origin = request.headers.get('Origin');
        const corsHeaders = getCorsHeaders(origin);

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        if (request.method !== 'POST' && request.method !== 'GET') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            });
        }

        try {
            let targetUrl = '';
            let targetMethod = 'GET';
            let targetHeaders: Record<string, string> = {};
            let targetBody: any = null;

            if (request.method === 'POST') {
                const body = await request.json() as {
                    url: string;
                    method?: string;
                    headers?: Record<string, string>;
                    query?: any;
                };

                if (!body.url) {
                    return new Response(JSON.stringify({ error: 'URL is required' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders },
                    });
                }

                targetUrl = body.url;
                targetMethod = body.method || 'POST';
                if (body.headers) targetHeaders = body.headers;
                if (body.query) targetBody = body.query;

            } else {
                const url = new URL(request.url);
                const queryUrl = url.searchParams.get('url');

                if (!queryUrl) {
                    return new Response(JSON.stringify({ error: 'URL is required' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders },
                    });
                }
                targetUrl = queryUrl;
                targetMethod = 'GET';
            }

            const defaultHeaders: Record<string, string> = {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'max-age=0',
                'Upgrade-Insecure-Requests': '1',
            };

            if (targetMethod !== 'GET' && targetMethod !== 'HEAD') {
                defaultHeaders['Content-Type'] = 'application/json';
            }

            Object.keys(targetHeaders).forEach((key) => {
                if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
                    defaultHeaders[key] = targetHeaders[key];
                }
            });

            await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

            const fetchOptions: RequestInit = {
                method: targetMethod,
                headers: defaultHeaders,
            };

            if (targetMethod !== 'GET' && targetMethod !== 'HEAD' && targetBody) {
                fetchOptions.body = JSON.stringify(targetBody);
            }

            const targetResponse = await fetch(targetUrl, fetchOptions);

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


            const responseData = await targetResponse.text();
            let data;

            try {
                data = JSON.parse(responseData);
            } catch (e) {
                data = responseData;
            }

            return new Response(JSON.stringify({
                success: true,
                data: data,
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
