import { withAuthenticationRequired } from "@auth0/auth0-react";
import type { ReactElement } from "react";

interface ProtectedRouteProps {
  children: ReactElement;
}

function RedirectingScreen(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-700 shadow-sm">
        Redirecting to login...
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  const Guarded = withAuthenticationRequired(
    () => children,
    {
      loginOptions: {
        appState: { returnTo: "/app" },
      },
      onRedirecting: () => <RedirectingScreen />,
    },
  );

  return <Guarded />;
}
