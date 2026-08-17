import { useEffect, useMemo, useState } from "react";
import {
  addUserToGroup,
  listGroups,
  listUserGroups,
  removeUserFromGroup,
  type Group,
  type User,
} from "../api";
import RowMenu from "../components/RowMenu";
import StatusBadge from "../components/StatusBadge";

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
      <button className="ghost" onClick={onBack}>
        ← Back to users
      </button>
      <h2>{user.name}</h2>
      <p className="muted">
        {user.email} · <StatusBadge status={user.status} />
      </p>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <p className="panel-title">Current groups</p>
        {groups.length === 0 ? (
          <p className="muted">No groups assigned.</p>
        ) : (
          <table>
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "48%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Group</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.description ?? "—"}</td>
                  <td>
                    <RowMenu
                      actions={[
                        {
                          label: "Remove",
                          danger: true,
                          onSelect: () => handleRemove(group.id),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <p className="panel-title">Add to group</p>
        {available.length === 0 ? (
          <p className="muted">Already in all groups.</p>
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
      </div>
    </section>
  );
}
