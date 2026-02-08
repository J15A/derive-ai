import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useRef } from "react";
import { Link, Navigate } from "react-router-dom";

export default function LoginPage(): JSX.Element {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const didRedirectRef = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || didRedirectRef.current) {
      return;
    }
    didRedirectRef.current = true;
    void loginWithRedirect({ appState: { returnTo: "/app" } });
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Log In</h1>
        <p className="mt-2 text-sm text-slate-600">Redirecting to secure login...</p>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          onClick={() => void loginWithRedirect({ appState: { returnTo: "/app" } })}
        >
          Continue to Login
        </button>
        <Link
          to="/"
          className="mt-3 inline-flex text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
