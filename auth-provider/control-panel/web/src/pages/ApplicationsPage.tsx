import { useEffect, useState, type SubmitEvent } from "react";
import {
  createApplication,
  listApplications,
  updateApplication,
  type Application,
  type CreatedApplication,
} from "../api";

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
          <button onClick={() => setCreated(null)}>Dismiss</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <h3>{editingId ? "Edit application" : "New application"}</h3>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Launch URL (optional)"
          value={form.launchUrl}
          onChange={(e) => setForm({ ...form, launchUrl: e.target.value })}
        />
        <input
          placeholder="Logout notification URL"
          value={form.logoutNotificationUrl}
          onChange={(e) => setForm({ ...form, logoutNotificationUrl: e.target.value })}
          required
        />
        <textarea
          placeholder={"Redirect URIs (one per line)\nhttp://localhost:4001/callback"}
          value={form.redirectUris}
          onChange={(e) => setForm({ ...form, redirectUris: e.target.value })}
          required
        />
        <label>
          Status
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <div>
          <button type="submit">{editingId ? "Save" : "Create"}</button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <table>
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
              <td>{app.status}</td>
              <td>{app.redirectUris.join(", ")}</td>
              <td>
                <button onClick={() => startEdit(app)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
