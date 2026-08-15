import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from './_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  if (req.method !== 'GET') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const [productsResult, ordersResult, usersResult] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM products`,
      sql`SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders`,
      sql`SELECT COUNT(*) as count FROM users`,
    ]);

    const statusResult = await sql`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `;

    const recentOrders = await sql`
      SELECT id, order_number, total, status, customer_name, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const topProducts = await sql`
      SELECT p.name, p.image, COUNT(oi->>'product_id') as times_ordered
      FROM orders, jsonb_array_elements(items) as oi
      JOIN products p ON (oi->>'product_id')::int = p.id
      GROUP BY p.name, p.image
      ORDER BY times_ordered DESC
      LIMIT 5
    `;

    const statusCounts: Record<string, number> = {};
    (statusResult.rows as Array<{ status: string; count: string }>).forEach((row) => {
      statusCounts[row.status] = parseInt(row.count, 10);
    });

    return sendJSON(res, 200, {
      ok: true,
      stats: {
        products: parseInt((productsResult.rows[0] as any).count, 10),
        orders: parseInt((ordersResult.rows[0] as any).count, 10),
        users: parseInt((usersResult.rows[0] as any).count, 10),
        revenue: parseInt((ordersResult.rows[0] as any).revenue, 10),
        statusCounts,
      },
      recentOrders: recentOrders.rows,
      topProducts: topProducts.rows,
    });
  } catch (err) {
    return sendJSON(res, 500, {
      ok: false,
      error: 'Ошибка базы данных',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
