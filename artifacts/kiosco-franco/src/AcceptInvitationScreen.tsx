import { useState, useEffect } from "react";
import { store } from "./store";
import { Lock, Mail, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Store, RefreshCw } from "lucide-react";

interface AcceptInvitationScreenProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AcceptInvitationScreen({ token, onSuccess, onCancel }: AcceptInvitationScreenProps) {
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<{
    id: string;
    email: string;
    name: string;
    kioskId: string;
    kioskName: string;
    expiresAt: string;
  } | null>(null);

  const [error, setError] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [isAlreadyAccepted, setIsAlreadyAccepted] = useState(false);

  // Form inputs
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function validate() {
      setLoading(true);
      setError("");
      const res = await store.validateInvitationToken(token);
      if (!isMounted) return;
      setLoading(false);

      if (res.ok && res.invitation) {
        setInvitation(res.invitation);
      } else {
        setError(res.error || "No se pudo validar el enlace de invitación.");
        if (res.expired) setIsExpired(true);
        if (res.alreadyAccepted) setIsAlreadyAccepted(true);
      }
    }

    validate();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const res = await store.acceptInvitation({
      token,
      password,
      confirmPassword,
    });

    setSubmitting(false);

    if (res.ok) {
      setSuccessMsg("¡Tu cuenta ha sido activada con éxito! Ingresando al panel...");
      store.addToast({
        title: "¡Cuenta activada!",
        message: "Bienvenido a la administración de tu negocio.",
        type: "success",
      });
      setTimeout(() => {
        // Clean URL invitation query param if present
        if (typeof window !== "undefined" && window.history?.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete("invitation");
          window.history.replaceState({}, document.title, url.toString());
        }
        onSuccess();
      }, 1200);
    } else {
      setFormError(res.error || "Error al activar la cuenta. Intente nuevamente.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[400px] text-center">
        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
        <h3 className="text-base font-bold text-foreground">Validando invitación...</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Por favor espere mientras verificamos su enlace seguro.
        </p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="p-6 max-w-md mx-auto my-6 rounded-3xl border border-border/80 bg-card shadow-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
          <AlertCircle className="h-7 w-7" />
        </div>

        <h3 className="text-lg font-bold text-foreground">
          {isAlreadyAccepted
            ? "Invitación ya utilizada"
            : isExpired
            ? "Invitación expirada"
            : "Enlace de invitación no válido"}
        </h3>

        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {error || "El enlace utilizado no es válido o ha dejado de existir."}
        </p>

        {isAlreadyAccepted && (
          <div className="mt-4 p-3 rounded-2xl bg-muted/60 text-xs text-muted-foreground text-left">
            💡 <strong>¿Ya activaste tu cuenta antes?</strong> Podés iniciar sesión normalmente con tu correo y contraseña en el acceso administrativo.
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
          >
            Ir al inicio / Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto my-4 animate-in fade-in zoom-in-95">
      <div className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xl">
        {/* Encabezado elegante */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">Activar Cuenta de Administrador</h2>
          <p className="text-xs text-slate-300 mt-1">
            Creá tu propia contraseña segura para acceder a la plataforma
          </p>
        </div>

        {/* Ficha de Asignación */}
        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Administrador:</span>
              <span className="font-bold text-foreground">{invitation.name}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Email de acceso:</span>
              <span className="font-semibold text-foreground font-mono">{invitation.email}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Negocio asignado:</span>
              <span className="font-bold text-primary flex items-center gap-1">
                <Store className="h-3.5 w-3.5" />
                {invitation.kioskName}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50/70 border border-blue-200/60 p-3 text-[11px] text-blue-950 flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Privacidad garantizada:</strong> Tu contraseña es personal y confidencial. Nadie, ni siquiera el SuperAdministrador, tendrá acceso a ella.
            </div>
          </div>

          {successMsg ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-emerald-900">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 pt-1">
              {formError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Crear contraseña *
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  minLength={6}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Confirmar contraseña *
                </label>
                <input
                  type="password"
                  placeholder="Repita su nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-md disabled:opacity-50 active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Activando cuenta...</span>
                  </>
                ) : (
                  <>
                    <span>Activar mi cuenta y entrar</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-muted-foreground hover:underline text-center mt-1"
              >
                Cancelar y volver a la tienda
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
