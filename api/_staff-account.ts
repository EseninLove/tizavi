import { sql } from "./_db.js";
import { isStaffRole } from "../src/shared/staff.js";
/** Legacy Telegram staff are linked only after that exact verified account has signed in. */
export async function staffForAccount(user: {
  id: number;
  telegram_id: string | null;
}) {
  if (user.telegram_id)
    await sql`UPDATE admins SET user_id=${user.id} WHERE user_id IS NULL AND telegram_id=${user.telegram_id}`;
  const row = (await sql`SELECT role FROM admins WHERE user_id=${user.id}`)
    .rows[0];
  return row && isStaffRole(row.role) ? row.role : null;
}
