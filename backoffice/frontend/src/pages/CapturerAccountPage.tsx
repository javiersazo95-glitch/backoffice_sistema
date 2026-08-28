import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import apiClient, { resolveProfileImageUrl } from "@/api/client";
import * as api from "@/api/capturers";
import { useAuth } from "@/context/AuthContext";
import CapturerPageShell, {
  pageControl,
  pagePanel,
  pagePrimary,
} from "@/components/capturer/CapturerPageShell";

export default function CapturerAccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["capturer-status"],
    queryFn: api.getStatus,
  });
  const [form, setForm] = useState({ userName: "", phone: "" });
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  useEffect(() => {
    if (status.data)
      setForm({
        userName: status.data.nombre,
        phone: status.data.telefono || "",
      });
  }, [status.data]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await apiClient.patch("/users/perfil", form);
      await qc.invalidateQueries({ queryKey: ["capturer-status"] });
      await qc.invalidateQueries({ queryKey: ["capturer-dashboard"] });
      setNotice("Tus datos fueron actualizados.");
    } catch (e: any) {
      setNotice(
        e.response?.data?.message || "No se pudieron actualizar los datos.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (
      !user ||
      !window.confirm(
        "¿Eliminar tu cuenta? Esta acción desactivará el acceso y no se puede deshacer.",
      )
    )
      return;
    try {
      // La identidad puede tener otros perfiles (comprador o vendedor). Este
      // panel sólo elimina el perfil de captador y libera sus datos asociados.
      await apiClient.delete(`/auth/users/${user.id}`, { params: { perfil: "CAPTADOR" } });
      await logout();
      navigate("/login?type=capturer", { replace: true });
    } catch (e: any) {
      setNotice(e.response?.data?.message || "No se pudo eliminar la cuenta.");
    }
  }
  async function uploadPhoto(file?: File) {
    if (!file) return;
    setUploadingPhoto(true);
    setNotice("");
    try {
      await api.uploadProfilePhoto(file);
      await qc.invalidateQueries({ queryKey: ["capturer-status"] });
      setNotice("Foto de perfil actualizada.");
    } catch (e: any) {
      setNotice(e.response?.data?.message || "No se pudo subir la foto.");
    } finally { setUploadingPhoto(false); }
  }
  const p = status.data;
  return (
    <CapturerPageShell>
      <section style={{ marginBottom: 20 }}>
        <span style={eyebrow}>Perfil del captador</span>
        <h1 style={title}>Mis datos y cuenta</h1>
        <p style={sub}>
          Actualiza tus datos de contacto. Tu RUT y ubicación se protegen para
          resguardar la postulación y el ranking.
        </p>
      </section>
      {status.isLoading ? (
        <section style={pagePanel}>Cargando tus datos…</section>
      ) : (
        <>
          <form style={{ ...pagePanel, maxWidth: 720 }} onSubmit={save}>
            <section style={photoSection}>
              {resolveProfileImageUrl(p?.fotoPerfil) ? <img src={resolveProfileImageUrl(p?.fotoPerfil) ?? undefined} alt="Foto de perfil" style={photo} /> : <span style={photoFallback}>{p?.nombre.slice(0, 2).toUpperCase()}</span>}
              <div><strong>Foto de perfil</strong><p style={{ margin: '4px 0 10px', color: '#64748b', fontSize: 13 }}>JPG, PNG o WebP de hasta 5 MB.</p><label style={photoButton}>{uploadingPhoto ? 'Subiendo…' : 'Cambiar imagen'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploadingPhoto} onChange={e => void uploadPhoto(e.target.files?.[0])}/></label></div>
            </section>
            <div style={grid}>
              <Label text="Nombre completo">
                <input
                  style={pageControl}
                  value={form.userName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, userName: e.target.value }))
                  }
                  required
                />
              </Label>
              <Label text="Teléfono">
                <input
                  style={pageControl}
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  required
                />
              </Label>
              <Label text="Correo electrónico">
                <input
                  style={{ ...pageControl, background: "#f8fafc" }}
                  value={p?.email || ""}
                  readOnly
                />
              </Label>
              <Label text="Alias público">
                <input
                  style={{ ...pageControl, background: "#f8fafc" }}
                  value={p?.alias || ""}
                  readOnly
                />
              </Label>
              <Label text="RUT">
                <input
                  style={{ ...pageControl, background: "#f8fafc" }}
                  value={p?.rut || ""}
                  readOnly
                />
              </Label>
              <Label text="Ubicación">
                <input
                  style={{ ...pageControl, background: "#f8fafc" }}
                  value={p ? `${p.comuna}, ${p.region}` : ""}
                  readOnly
                />
              </Label>
            </div>
            <p style={{ fontSize: 13, color: "#64748b" }}>
              Para modificar correo, alias, región o comuna, contacta a soporte.
              La región y comuna sólo las puede cambiar el personal autorizado.
            </p>
            {notice && (
              <p
                style={{
                  color: notice.includes("actualizados")
                    ? "#087443"
                    : "#b42318",
                }}
              >
                {notice}
              </p>
            )}
            <button
              disabled={saving}
              style={{ ...pagePrimary, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
          <section
            style={{
              ...pagePanel,
              maxWidth: 720,
              marginTop: 20,
              borderColor: "#fecaca",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                color: "#b42318",
              }}
            >
              Zona sensible
            </span>
            <h2 style={{ margin: "8px 0" }}>Eliminar cuenta</h2>
            <p style={sub}>
              Desactiva tu acceso de captador. Conservaremos únicamente los
              registros necesarios de pagos y auditoría.
            </p>
            <button type="button" onClick={remove} style={danger}>
              Eliminar mi cuenta
            </button>
          </section>
        </>
      )}
    </CapturerPageShell>
  );
}
function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: 6,
        fontSize: 13,
        fontWeight: 650,
        color: "#334155",
      }}
    >
      {text}
      {children}
    </label>
  );
}
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 16,
};
const eyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  color: "#64748b",
};
const title: React.CSSProperties = { margin: "6px 0", color: "#0b2559" };
const sub: React.CSSProperties = { color: "#64748b", margin: "0 0 18px" };
const danger: React.CSSProperties = {
  padding: "11px 16px",
  border: "1px solid #dc2626",
  borderRadius: 10,
  background: "#fff",
  color: "#b42318",
  fontWeight: 700,
  cursor: "pointer",
};
const photoSection: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid #e2e8f0' };
const photo: React.CSSProperties = { width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '3px solid #dbeafe' };
const photoFallback: React.CSSProperties = { width: 76, height: 76, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#145be7', color: '#fff', fontWeight: 800, fontSize: 24 };
const photoButton: React.CSSProperties = { display: 'inline-block', padding: '9px 12px', borderRadius: 8, background: '#edf4ff', color: '#145be7', fontWeight: 700, cursor: 'pointer', fontSize: 13 };
