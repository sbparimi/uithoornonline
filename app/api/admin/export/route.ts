import { errorJson, handle } from '@/lib/http';
import { requireRole } from '@/lib/auth/session';
import { csv } from '@/lib/admin/core';
import * as B from '@/lib/admin/businesses';
import * as U from '@/lib/admin/users';
import * as Q from '@/lib/admin/requests';
import * as P from '@/lib/admin/payments';
import * as C from '@/lib/admin/contacts';
import * as I from '@/lib/admin/issues';
import * as M from '@/lib/admin/misc';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// CSV export of the admin lists, with the same filters as the screen (?type=…&q=…&status=…).
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireRole('admin');
    const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
    const type = sp.type;
    let rows: Record<string, unknown>[] = [];
    switch (type) {
      case 'businesses': rows = (await B.listBusinesses(user, sp, true)).rows; break;
      case 'users': rows = (await U.listUsers(user, sp, true)).rows; break;
      case 'requests': rows = (await Q.listRequests(user, sp, true)).rows; break;
      case 'leads': rows = (await Q.listLeads(user, sp, true)).rows; break;
      case 'payments': rows = ((await P.listPayments(user, sp, true))?.rows ?? []).map((p) => ({ ...p, amount_eur: (p.amount_cents / 100).toFixed(2) })); break;
      case 'contacts': rows = (await C.listContacts(user, sp, true)).rows; break;
      case 'issues': rows = (await I.listIssues(user, sp, true))?.rows ?? []; break;
      case 'emails': rows = (await M.listEmails(user, sp, true)).rows; break;
      case 'audit': rows = (await M.listAudit(user, sp, true)).rows; break;
      default: return errorJson('unknown_type', 400);
    }
    await query("insert into audit_log(actor_id, action, target_type, target_id, details) values ($1, 'csv_export', $2, null, $3)", [user.id, type, JSON.stringify({ actor_email: user.email, rows: rows.length, filters: sp })]);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv(rows as Record<string, unknown>[]), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="uithoorn-${type}-${stamp}.csv"`, 'Cache-Control': 'no-store' },
    });
  }, 'admin/export');
}
