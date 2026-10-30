import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { listOwnRequests } from '@/lib/data/requests';
import { listConversationsForUser } from '@/lib/data/conversations';
import { getOwnBusiness } from '@/lib/data/businesses';

export const dynamic = 'force-dynamic';

// Everything the mobile app's home screens need for the signed-in user, in one call.
// Auth: the session cookie (web) or `Authorization: Bearer <token>` (app, token from login/signup).
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [requests, conversations, business] = await Promise.all([
      user.role === 'provider' ? Promise.resolve([]) : listOwnRequests(user),
      listConversationsForUser(user),
      user.role === 'provider' ? getOwnBusiness(user) : Promise.resolve(null),
    ]);
    return json({
      user: { id: user.id, name: user.fullName, email: user.email, phone: user.phone, role: user.role, emailVerified: user.emailVerified },
      business, requests, conversations,
    });
  }, 'mobile/me');
}
