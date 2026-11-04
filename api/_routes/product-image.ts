import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_db.js";
import { positiveInteger } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const id = positiveInteger(req.query.id);
    const r = (
      await sql`SELECT i.content,i.content_type FROM moysklad_product_images i JOIN products p ON p.id=i.product_id WHERE i.product_id=${id} AND NOT p.moysklad_hidden`
    ).rows[0];
    if (!r) return res.status(404).end();
    res.setHeader("Content-Type", r.content_type as string);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.end(r.content);
  } catch {
    return res.status(404).end();
  }
}
