import { useEffect, useState, type SubmitEvent } from "react";
import { createUser, listUsers, updateUser, type User } from "../api";
import RowMenu from "../components/RowMenu";
import StatusBadge from "../components/StatusBadge";

export default function UsersPage({ onOpenUser }: { onOpenUser: (user: User) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [editing, setEditing] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  async function refresh() {
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await createUser({ name, email, password });
      setName("");
      setEmail("");
      setPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  function startEdit(user: User) {
    setEditing(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword("");
  }

  function cancelEdit() {
    setEditing(null);
    setEditPassword("");
  }

  async function handleSave(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      await updateUser(editing.id, {
        name: editName,
        email: editEmail,
        password: editPassword.trim() || undefined,
      });
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  async function handleToggle(user: User) {
    setError(null);
    try {
      await updateUser(user.id, { status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  return (
    <section>
      <h2>Users</h2>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <table>
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <StatusBadge status={user.status} />
                </td>
                <td>{new Date(user.createdAt).toLocaleString()}</td>
                <td>
                  <RowMenu
                    actions={[
                      { label: "Edit", onSelect: () => startEdit(user) },
                      {
                        label: user.status === "ACTIVE" ? "Deactivate" : "Activate",
                        onSelect: () => handleToggle(user),
                      },
                      { label: "Groups", onSelect: () => onOpenUser(user) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="panel">
          <p className="panel-title">Edit user — {editing.email}</p>
          <form className="inline-form" onSubmit={handleSave}>
            <input
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="New password (leave blank to keep)"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button type="submit">Save</button>
            <button type="button" className="ghost" onClick={cancelEdit}>
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="panel">
        <p className="panel-title">New user</p>
        <form className="inline-form" onSubmit={handleCreate}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (min 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <button type="submit">Create</button>
        </form>
      </div>
    </section>
  );
}
