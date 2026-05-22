import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-serif text-navy">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pagina niet gevonden.</p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-red px-4 py-2 text-sm font-medium text-red-foreground">
          Terug naar home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-serif text-navy">Er ging iets mis</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-xl bg-red px-4 py-2 text-sm text-red-foreground"
        >Opnieuw proberen</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "uithoorn.online — Vecht terug tegen Schiphol-overlast" },
      { name: "description", content: "Log geluidsoverlast, check je adres en claim je compensatie voor Schiphol-overlast in Uithoorn." },
      { name: "theme-color", content: "#0d1f3c" },
      { property: "og:title", content: "uithoorn.online — Vecht terug tegen Schiphol-overlast" },
      { name: "twitter:title", content: "uithoorn.online — Vecht terug tegen Schiphol-overlast" },
      { property: "og:description", content: "Log geluidsoverlast, check je adres en claim je compensatie voor Schiphol-overlast in Uithoorn." },
      { name: "twitter:description", content: "Log geluidsoverlast, check je adres en claim je compensatie voor Schiphol-overlast in Uithoorn." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b7a18148-94c8-4012-a74a-adba002fcdf3/id-preview-9d73cf3b--af03841c-ea41-4d0f-a0f8-ac11704175a7.lovable.app-1779410235247.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b7a18148-94c8-4012-a74a-adba002fcdf3/id-preview-9d73cf3b--af03841c-ea41-4d0f-a0f8-ac11704175a7.lovable.app-1779410235247.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
