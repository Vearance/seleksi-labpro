import { useEffect, useState, type SubmitEvent } from "react";
import {
  createApplication,
  listApplications,
  updateApplication,
  type Application,
  type CreatedApplication,
} from "../api";
import RowMenu from "../components/RowMenu";
import StatusBadge from "../components/StatusBadge";

interface FormState {
  name: string;
  launchUrl: string;
  logoutNotificationUrl: string;
  redirectUris: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: FormState = {
  name: "",
  launchUrl: "",
  logoutNotificationUrl: "",
  redirectUris: "",
  status: "ACTIVE",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApplication | null>(null);

  function parseUris(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function refresh() {
    setError(null);
    try {
      setApplications(await listApplications());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(app: Application) {
    setEditingId(app.id);
    setCreated(null);
    setForm({
      name: app.name,
      launchUrl: app.launchUrl ?? "",
      logoutNotificationUrl: app.logoutNotificationUrl,
      redirectUris: app.redirectUris.join("\n"),
      status: app.status,
    });
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    const payload = {
      name: form.name,
      launchUrl: form.launchUrl.trim() || null,
      logoutNotificationUrl: form.logoutNotificationUrl,
      redirectUris: parseUris(form.redirectUris),
      status: form.status,
    };

    try {
      if (editingId) {
        await updateApplication(editingId, payload);
        resetForm();
      } else {
        const result = await createApplication(payload);
        setCreated(result);
        resetForm();
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save application");
    }
  }

  return (
    <section>
      <h2>Applications</h2>

      {error && <p className="error">{error}</p>}

      {created && (
        <div className="secret-box">
          <h3>Application created</h3>
          <p>Copy these now — the secret will not be shown again.</p>
          <p>
            <strong>Client ID:</strong> <code>{created.application.clientId}</code>
          </p>
          <p>
            <strong>Client Secret:</strong> <code>{created.clientSecret}</code>
          </p>
          <button className="ghost" onClick={() => setCreated(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="card">
        <table>
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Client ID</th>
              <th>Status</th>
              <th>Redirect URIs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id}>
                <td>{app.name}</td>
                <td>
                  <code>{app.clientId}</code>
                </td>
                <td>
                  <StatusBadge status={app.status} />
                </td>
                <td>{app.redirectUris.join(", ")}</td>
                <td>
                  <RowMenu actions={[{ label: "Edit", onSelect: () => startEdit(app) }]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <p className="panel-title">{editingId ? "Edit application" : "New application"}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Name</span>
              <input
                placeholder="App A"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Launch URL (optional)</span>
              <input
                placeholder="http://localhost:4001/"
                value={form.launchUrl}
                onChange={(e) => setForm({ ...form, launchUrl: e.target.value })}
              />
            </label>
            <label className="field full">
              <span className="field-label">Logout notification URL</span>
              <input
                placeholder="http://app-a:4001/internal/logout"
                value={form.logoutNotificationUrl}
                onChange={(e) => setForm({ ...form, logoutNotificationUrl: e.target.value })}
                required
              />
            </label>
            <label className="field full">
              <span className="field-label">Redirect URIs (one per line)</span>
              <textarea
                placeholder={"http://localhost:4001/callback"}
                value={form.redirectUris}
                onChange={(e) => setForm({ ...form, redirectUris: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit">{editingId ? "Save" : "Create"}</button>
            {editingId && (
              <button type="button" className="ghost" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
