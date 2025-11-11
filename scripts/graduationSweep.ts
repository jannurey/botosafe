/**
 * scripts/graduationSweep.ts
 *
 * Run periodically (cron) to mark graduated 4th-year users inactive after 9 months.
 *
 * Placement: project-root/scripts/graduationSweep.ts
 *
 * IMPORTANT:
 * - This file imports the DB pool via a relative path. Adjust the import path below if
 *   your database file is in a different location.
 * - Run with ts-node (dev) or compile to JS and run with node (production).
 */

import type { ResultSetHeader } from "mysql2";
import { pool } from "../src/configs/database"; // <-- relative path from scripts/ to src/configs/database

async function runSweep(): Promise<void> {
  try {
    const sql = `
      UPDATE users
      SET user_status = 'inactive', updated_at = NOW()
      WHERE IFNULL(year_level, 0) >= 4
        AND user_status = 'active'
        AND (
          GREATEST(
            COALESCE(approved_at, '1970-01-01'),
            COALESCE(last_login_at, '1970-01-01'),
            COALESCE(created_at, '1970-01-01')
          ) < DATE_SUB(NOW(), INTERVAL 9 MONTH)
        )
    `;

    const [result] = await pool.query<ResultSetHeader>(sql);
    // eslint-disable-next-line no-console
    console.log(
      "Graduation sweep completed. Rows affected:",
      (result as ResultSetHeader).affectedRows
    );
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error("Graduation sweep failed:", err);
    throw err;
  } finally {
    // close pool if desired (depends on your pool implementation)
    try {
      await pool.end();
    } catch {
      // ignore
    }
  }
}

// Run if invoked directly with node/ts-node
if (require.main === module) {
  void runSweep().catch(() => process.exit(1));
}

export { runSweep };
