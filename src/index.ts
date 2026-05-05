export default {
  async fetch(request: Request): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*.wallet-bitcoin.pages.dev,*.arkade-wallet.pages.dev,arkade.money',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
      'Access-Control-Max-Age': '86400',
    }

    // The endpoint you want the CORS reverse proxy to be on
    const PROXY_ENDPOINT = '/proxy/'

    // The rest of this snippet for the demo page
    function rawHtmlResponse() {
      const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <h1>API GET without CORS Proxy</h1>
          Deploy your own from <a href="https://developers.cloudflare.com/workers/examples/cors-header-proxy/" target="_blank">https://developers.cloudflare.com/workers/examples/cors-header-proxy/</a>.
        </body>
        </html>
      `
      return new Response(html, {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
        },
      })
    }

    async function handleRequest(request: Request) {
      const url = new URL(request.url)
      let apiUrl = url.searchParams.get('apiurl')

      if (apiUrl == null) return rawHtmlResponse()

      // Rewrite request to point to API URL. This also makes the request mutable
      // so you can add the correct Origin header to make the API server think
      // that this request is not cross-site.
      request = new Request(apiUrl, request)
      request.headers.set('Origin', new URL(apiUrl).origin)
      let response = await fetch(request)
      // Recreate the response so you can modify the headers

      response = new Response(response.body, response)
      // Set CORS headers

      response.headers.set('Access-Control-Allow-Origin', url.origin)

      // Append to/Add Vary header so browser will cache response correctly
      response.headers.append('Vary', 'Origin')

      return response
    }

    async function handleOptions(request: Request) {
      if (
        request.headers.get('Origin') !== null &&
        request.headers.get('Access-Control-Request-Method') !== null &&
        request.headers.get('Access-Control-Request-Headers') !== null
      ) {
        // Handle CORS preflight requests.
        const allowHeaders = request.headers.get('Access-Control-Request-Headers') ?? ''
        return new Response(null, {
          headers: {
            ...corsHeaders,
            'Access-Control-Allow-Headers': allowHeaders,
          },
        })
      } else {
        // Handle standard OPTIONS request.
        return new Response(null, {
          headers: {
            Allow: 'GET, HEAD, POST, OPTIONS',
          },
        })
      }
    }

    const url = new URL(request.url)
    if (url.pathname.startsWith(PROXY_ENDPOINT)) {
      if (request.method === 'OPTIONS') {
        // Handle CORS preflight requests
        return handleOptions(request)
      } else if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'POST') {
        // Handle requests to the API server
        return handleRequest(request)
      } else {
        return new Response(null, {
          status: 405,
          statusText: 'Method Not Allowed',
        })
      }
    } else {
      return rawHtmlResponse()
    }
  },
} satisfies ExportedHandler
