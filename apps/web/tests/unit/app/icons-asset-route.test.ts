import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockParsePwaIconAsset = vi.fn();
const mockRenderPwaIconPng = vi.fn();

vi.mock('next/server', () => {
  type NextResponseJsonInit = Readonly<{
    readonly status?: number;
    /**
     * Deep-readonly lint: `HeadersInit`/`Headers` считаются mutable типами.
     * Поэтому храним как unknown и безопасно приводим при создании Headers.
     */
    readonly headers?: unknown;
  }>;

  const json = vi.fn((body: Readonly<unknown>, init?: NextResponseJsonInit) => {
    const initHeaders = init?.headers;
    const headers = initHeaders instanceof Headers
      ? new Headers(initHeaders)
      : new Headers(initHeaders as HeadersInit | undefined);

    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    return new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers,
    });
  });

  return { NextResponse: { json } };
});

vi.mock('../../../src/app/icons/_lib/pwa-icon-service', () => ({
  parsePwaIconAsset: mockParsePwaIconAsset,
  renderPwaIconPng: mockRenderPwaIconPng,
}));

function createRequest(url: string): { nextUrl: URL; } {
  return { nextUrl: new URL(url) };
}

describe('apps/web/src/app/icons/[asset]/route.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports runtime=edge and revalidate=false', async () => {
    const mod = await import('../../../src/app/icons/[asset]/route');
    expect(mod.runtime).toBe('edge');
    expect(mod.revalidate).toBe(false);
  });

  it('GET: returns 404 JSON with no-store when asset is not in allow-list', async () => {
    mockParsePwaIconAsset.mockReturnValueOnce(null);
    const { GET } = await import('../../../src/app/icons/[asset]/route');

    const res = GET(
      createRequest('https://example.com/icons/anything.png?v=1') as unknown as never,
      { params: { asset: 'not-allowed.png' } },
    );

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ error: 'unknown_icon_asset' });
  });

  it('GET: normalizes missing asset param to empty string before parsing', async () => {
    mockParsePwaIconAsset.mockReturnValueOnce(null);
    const { GET } = await import('../../../src/app/icons/[asset]/route');

    GET(
      createRequest('https://example.com/icons/.png') as unknown as never,
      { params: { asset: undefined as unknown as string } },
    );

    expect(mockParsePwaIconAsset).toHaveBeenCalledWith('');
  });

  it('GET: passes version from ?v=... to renderPwaIconPng and returns its Response', async () => {
    const spec = { size: 192, purpose: 'any', kind: 'app-icon' } as const;
    const rendered = new Response('png', {
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/png' }),
    });

    mockParsePwaIconAsset.mockReturnValueOnce(spec);
    mockRenderPwaIconPng.mockReturnValueOnce(rendered);

    const { GET } = await import('../../../src/app/icons/[asset]/route');

    const res = GET(
      createRequest('https://example.com/icons/icon-192x192.png?v=abc') as unknown as never,
      { params: { asset: 'icon-192x192.png' } },
    );

    expect(mockRenderPwaIconPng).toHaveBeenCalledWith(spec, { version: 'abc' });
    expect(res).toBe(rendered);
  });

  it('GET: passes null version when ?v is missing', async () => {
    const spec = { size: 192, purpose: 'any', kind: 'app-icon' } as const;
    const rendered = new Response('png');

    mockParsePwaIconAsset.mockReturnValueOnce(spec);
    mockRenderPwaIconPng.mockReturnValueOnce(rendered);

    const { GET } = await import('../../../src/app/icons/[asset]/route');

    const res = GET(
      createRequest('https://example.com/icons/icon-192x192.png') as unknown as never,
      { params: { asset: 'icon-192x192.png' } },
    );

    expect(mockRenderPwaIconPng).toHaveBeenCalledWith(spec, { version: null });
    expect(res).toBe(rendered);
  });
});
