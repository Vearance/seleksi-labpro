import { useEffect, useState, type SubmitEvent } from "react";
import { createUser, listUsers, updateUser, type User } from "../api";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  async function handleToggle(user: User) {
    await updateUser(user.id, { status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    await refresh();
  }

  return (
    <section>
      <h2>Users</h2>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        <button type="submit">Create</button>
      </form>

      {error && <p className="error">{error}</p>}

      <table>
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
              <td>{user.status}</td>
              <td>{new Date(user.createdAt).toLocaleString()}</td>
              <td>
                <button onClick={() => handleToggle(user)}>
                  {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
