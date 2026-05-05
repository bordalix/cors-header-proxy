// A CORS reverse proxy for API requests from the frontend.
// This is a Cloudflare Worker that acts as a CORS reverse proxy for API requests from the frontend.
// It checks the Origin header against a whitelist of allowed domains, and if the request is valid,
// it forwards the request to the target API server and returns the response with CORS headers.

// Whitelist of allowed domains for CORS requests.
const WHITELIST = ['*.wallet-bitcoin.pages.dev', '*.arkade-wallet.pages.dev', 'arkade.money', 'localhost:3002']

// The endpoint you want the CORS reverse proxy to be on
const PROXY_ENDPOINT = '/proxy'

export default {
  async fetch(request: Request): Promise<Response> {
    // Check the Origin header against the whitelist
    const origin = request.headers.get('Origin') || ''
    if (!WHITELIST.some((domain) => origin.endsWith(domain))) {
      return new Response('Forbidden', { status: 403 })
    }

    // Return an HTML page for requests that don't include an API URL.
    function htmlResponse() {
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

    // Return an error response if the API request fails.
    function errorResponse(response: Response) {
      const { status, statusText } = response
      console.error('API Request Failed:', status, statusText)
      return new Response(`API request failed with status ${status}: ${statusText}`, {
        status,
        statusText,
      })
    }

    // Return a JSON response with CORS headers.
    function jsonResponse(json: any, response: Response) {
      response = new Response(JSON.stringify(json), response)
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Content-Type', 'application/json')
      response.headers.delete('Content-Encoding')
      return response
    }

    // Handle requests to the API server
    async function handleRequest(request: Request) {
      // Extract the API URL from the query parameters
      // If no API URL is provided, return the html page.
      const url = new URL(request.url)
      let apiUrl = url.searchParams.get('apiurl')
      if (apiUrl == null) return htmlResponse()

      // Fetch the API URL
      let response = await fetch(request)
      if (!response.ok) return errorResponse(response)

      // Parse the response as JSON and return it with CORS headers
      try {
        const body = await response.json()
        return jsonResponse(body, response)
      } catch (error) {
        console.error('Failed to parse JSON:', error)
        return new Response('Failed to parse JSON', { status: 500 })
      }
    }

    // Handle CORS preflight requests
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
            'Access-Control-Max-Age': '86400',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': allowHeaders,
            'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
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
      return htmlResponse()
    }
  },
} satisfies ExportedHandler
