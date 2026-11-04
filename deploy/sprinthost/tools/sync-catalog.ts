import { pool } from "../../../api/_db.js";
import { syncMoyskladCategories } from "../../../api/_moysklad-categories.js";
import { syncMoyskladProducts } from "../../../api/_moysklad-products.js";
export async function run() {
  try {
    console.log(
      JSON.stringify({ categories: await syncMoyskladCategories(false, true) }),
    );
    console.log(JSON.stringify({ products: await syncMoyskladProducts(true) }));
  } catch {
    console.error("Catalog sync failed; see owner integration settings");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
