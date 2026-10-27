import { errorJson, handle, json, readJson, sameOrigin, str } from '@/lib/http';
import { requireRole, type Role } from '@/lib/auth/session';
import * as admin from '@/lib/data/admin';
import { sendEmail } from '@/lib/email/send';
import { businessDecisionEmail } from '@/lib/email/templates';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireRole('admin');
    const section = new URL(request.url).searchParams.get('section') || 'stats';
    switch (section) {
      case 'stats': return json(await admin.adminStats(user));
      case 'businesses': return json(await admin.adminListBusinesses(user));
      case 'requests': return json(await admin.adminListRequests(user));
      case 'reviews': return json(await admin.adminListReviews(user));
      case 'users': return json(await admin.adminListUsers(user, new URL(request.url).searchParams.get('q') || ''));
      case 'leads': return json(await admin.adminListLeads(user));
      case 'inbox': return json(await admin.adminListInbox(user));
      default: return errorJson('unknown_section', 400);
    }
  }, 'admin/get');
}

// One endpoint for all moderation actions: { action, id, ... }.
export async function POST(request: Request) {
  return handle(async () => {
    if (!sameOrigin(request)) return errorJson('bad_origin', 403);
    const user = await requireRole('admin');
    const body = await readJson(request);
    const action = str(body.action, 40); const id = str(body.id, 40);
    const note = str(body.note, 500) || null;
    const bool = (v: unknown) => v === true || v === 'true' || v === 'on' || v === '1';
    let ok: unknown = false;
    switch (action) {
      case 'business.approve':
      case 'business.reject':
      case 'business.pending': {
        const decision = action.split('.')[1] === 'approve' ? 'approved' : action.split('.')[1] === 'reject' ? 'rejected' : 'pending';
        const row = await admin.adminModerateBusiness(user, id, decision, note);
        if (row?.owner_email && decision !== 'pending') void sendEmail({ to: row.owner_email, kind: `business_${decision}`, ...businessDecisionEmail(row.owner_locale ?? 'nl', row.name, decision === 'approved') });
        ok = Boolean(row); break;
      }
      case 'business.flags': ok = await admin.adminSetBusinessFlags(user, id, { verified: body.verified === undefined ? undefined : bool(body.verified), featured: body.featured === undefined ? undefined : bool(body.featured), active: body.active === undefined ? undefined : bool(body.active) }); break;
      case 'business.plan': {
        const plan = str(body.plan, 20) as 'free' | 'pro' | 'pro_plus';
        const r = await admin.adminSetBusinessPlan(user, id, plan, note);
        if (r && plan !== 'free') void notify('payment', `Plan ${plan} handmatig geactiveerd`, { businessId: id, note });
        ok = r ? { unlocked: r.unlocked } : false; break;
      }
      case 'business.owner': { const r = await admin.adminSetBusinessOwner(user, id, str(body.email, 254) || null); if (r !== 'ok') return errorJson(r, 400); ok = true; break; }
      case 'request.hide': ok = await admin.adminHideRequest(user, id, true, note); break;
      case 'request.unhide': ok = await admin.adminHideRequest(user, id, false, null); break;
      case 'review.hide': ok = await admin.adminHideReview(user, id, true, note); break;
      case 'review.unhide': ok = await admin.adminHideReview(user, id, false, null); break;
      case 'user.role': { const r = await admin.adminSetUserRole(user, id, str(body.role, 20) as Role); if (r !== 'ok') return errorJson(r, 400); ok = true; break; }
      case 'user.disable': { const r = await admin.adminSetUserDisabled(user, id, true); if (r !== 'ok') return errorJson(r, 400); ok = true; break; }
      case 'user.enable': { const r = await admin.adminSetUserDisabled(user, id, false); if (r !== 'ok') return errorJson(r, 400); ok = true; break; }
      case 'contact.status': ok = await admin.adminSetContactStatus(user, id, str(body.status, 20) as 'new' | 'handled' | 'spam'); break;
      default: return errorJson('unknown_action', 400);
    }
    if (!ok) return errorJson('not_found', 404);
    const accept = request.headers.get('accept') || '';
    if (!accept.includes('application/json') && (request.headers.get('content-type') || '').includes('form')) {
      const back = request.headers.get('referer') || '/admin';
      return Response.redirect(back, 303);
    }
    return json({ ok: true, result: ok });
  }, 'admin/post');
}
