import { useEffect, useState, type SubmitEvent } from "react";
import { createGroup, listGroups, updateGroup, type Group } from "../api";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function refresh() {
    setError(null);
    try {
      setGroups(await listGroups());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await createGroup({ name, description });
      setName("");
      setDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    }
  }

  function startEdit(group: Group) {
    setEditingId(group.id);
    setEditName(group.name);
    setEditDescription(group.description ?? "");
  }

  async function handleSave(group: Group) {
    setError(null);
    try {
      await updateGroup(group.id, { name: editName, description: editDescription });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update group");
    }
  }

  return (
    <section>
      <h2>Groups</h2>

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit">Create</button>
      </form>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              {editingId === group.id ? (
                <>
                  <td>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </td>
                  <td>
                    <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                  </td>
                  <td>{new Date(group.createdAt).toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleSave(group)}>Save</button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{group.name}</td>
                  <td>{group.description ?? "—"}</td>
                  <td>{new Date(group.createdAt).toLocaleString()}</td>
                  <td>
                    <button onClick={() => startEdit(group)}>Edit</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
