import { useEffect, useMemo, useState } from "react";
import {
  addUserToGroup,
  listGroups,
  listUserGroups,
  removeUserFromGroup,
  type Group,
  type User,
} from "../api";

export default function UserDetailPage({ user, onBack }: { user: User; onBack: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const [userGroups, everyGroup] = await Promise.all([listUserGroups(user.id), listGroups()]);
      setGroups(userGroups);
      setAllGroups(everyGroup);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    }
  }

  useEffect(() => {
    void refresh();
  }, [user.id]);

  const available = useMemo(() => {
    const assigned = new Set(groups.map((g) => g.id));
    return allGroups.filter((g) => !assigned.has(g.id));
  }, [groups, allGroups]);

  async function handleAdd() {
    if (!selected) return;
    setError(null);
    try {
      await addUserToGroup(user.id, selected);
      setSelected("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add group");
    }
  }

  async function handleRemove(groupId: string) {
    setError(null);
    try {
      await removeUserFromGroup(user.id, groupId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove group");
    }
  }

  return (
    <section>
      <button onClick={onBack}>← Back to users</button>
      <h2>{user.name}</h2>
      <p className="subtitle">
        {user.email} · {user.status}
      </p>

      <h3>Current groups</h3>
      {groups.length === 0 ? (
        <p>No groups assigned.</p>
      ) : (
        <ul>
          {groups.map((group) => (
            <li key={group.id}>
              {group.name}
              <button className="danger" onClick={() => handleRemove(group.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>Add to group</h3>
      {available.length === 0 ? (
        <p>Already in all groups.</p>
      ) : (
        <div className="inline-form">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select a group…</option>
            {available.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button onClick={handleAdd} disabled={!selected}>
            Add
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
