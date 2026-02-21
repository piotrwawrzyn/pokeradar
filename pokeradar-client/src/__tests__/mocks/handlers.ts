import { http, HttpResponse } from 'msw';
import {
  mockProducts,
  mockProductSets,
  mockWatchlist,
  mockUser,
  mockTelegramToken,
} from './data';

const API = 'http://localhost:3000';

export const handlers = [
  // Products
  http.get(`${API}/products`, () => {
    return HttpResponse.json(mockProducts);
  }),

  // Product Sets
  http.get(`${API}/product-sets`, () => {
    return HttpResponse.json(mockProductSets);
  }),

  // Auth
  http.get(`${API}/auth/me`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json(mockUser);
  }),

  // Watchlist
  http.get(`${API}/watchlist`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    return HttpResponse.json(mockWatchlist);
  }),

  http.post(`${API}/watchlist`, async ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    const body = (await request.json()) as { productId: string; maxPrice: number };
    return HttpResponse.json(
      {
        id: 'watch-new',
        productId: body.productId,
        maxPrice: body.maxPrice,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  http.patch(`${API}/watchlist/:id`, async ({ request, params }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    const body = (await request.json()) as { maxPrice: number };
    const existing = mockWatchlist.find((e) => e.id === params.id);
    return HttpResponse.json({
      ...existing,
      ...body,
      id: params.id,
    });
  }),

  http.delete(`${API}/watchlist/:id`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    return new HttpResponse(null, { status: 204 });
  }),

  // User profile
  http.get(`${API}/users/me`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    return HttpResponse.json(mockUser);
  }),

  // Telegram
  http.post(`${API}/users/me/telegram/link-token`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    return HttpResponse.json(mockTelegramToken);
  }),

  http.delete(`${API}/users/me/telegram`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    return new HttpResponse(null, { status: 204 });
  }),

  // Discord
  http.post(`${API}/users/me/discord/link-token`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    return HttpResponse.json(mockTelegramToken);
  }),

  http.delete(`${API}/users/me/discord`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) return new HttpResponse(null, { status: 401 });
    return new HttpResponse(null, { status: 204 });
  }),
];
