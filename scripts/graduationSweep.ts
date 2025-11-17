/**
 * scripts/graduationSweep.ts
 *
 * Run periodically (cron) to mark graduated 4th-year users inactive after 9 months.
 *
 * Placement: project-root/scripts/graduationSweep.ts
 *
 * IMPORTANT:
 * - This file uses Supabase client for database operations.
 * - Run with ts-node (dev) or compile to JS and run with node (production).
 */

import { createClient } from '@supabase/supabase-js';

async function runSweep(): Promise<void> {
  try {
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Update users who have graduated (year_level >= 4) and are active
    // and haven't logged in or been approved/created in the last 9 months
    const { data, error } = await supabase
      .from('users')
      .update({ 
        user_status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .gte('year_level', 4)
      .eq('user_status', 'active')
      .lt('approved_at', new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000).toISOString())
      .select();

    if (error) {
      throw new Error(`Supabase update error: ${error.message}`);
    }

    // eslint-disable-next-line no-console
    console.log(
      "Graduation sweep completed. Rows affected:",
      data?.length || 0
    );
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error("Graduation sweep failed:", err);
    throw err;
  }
}

// Run if invoked directly with node/ts-node
if (require.main === module) {
  void runSweep().catch(() => process.exit(1));
}

export { runSweep };