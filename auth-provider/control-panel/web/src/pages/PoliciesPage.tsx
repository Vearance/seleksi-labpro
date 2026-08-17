import { useEffect, useMemo, useState } from "react";
import {
  addPolicy,
  listApplications,
  listGroups,
  listPolicies,
  removePolicy,
  type Application,
  type Group,
  type Policy,
} from "../api";
import RowMenu from "../components/RowMenu";

export default function PoliciesPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadMeta() {
    setError(null);
    try {
      const [apps, allGroups] = await Promise.all([listApplications(), listGroups()]);
      setApplications(apps);
      setGroups(allGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  async function loadPolicies(appId: string) {
    setError(null);
    try {
      setPolicies(await listPolicies(appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policies");
    }
  }

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    setPolicies([]);
    setSelectedGroupId("");
    if (selectedAppId) void loadPolicies(selectedAppId);
  }, [selectedAppId]);

  const available = useMemo(() => {
    const assigned = new Set(policies.map((p) => p.groupId));
    return groups.filter((g) => !assigned.has(g.id));
  }, [policies, groups]);

  async function handleAdd() {
    if (!selectedAppId || !selectedGroupId) return;
    setError(null);
    try {
      await addPolicy(selectedAppId, selectedGroupId);
      setSelectedGroupId("");
      await loadPolicies(selectedAppId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add policy");
    }
  }

  async function handleRemove(groupId: string) {
    setError(null);
    try {
      await removePolicy(selectedAppId, groupId);
      await loadPolicies(selectedAppId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove policy");
    }
  }

  const selectedApp = applications.find((a) => a.id === selectedAppId);

  return (
    <section>
      <h2>Access Policies</h2>

      {error && <p className="error">{error}</p>}

      <div className="inline-form" style={{ maxWidth: 420 }}>
        <select value={selectedAppId} onChange={(e) => setSelectedAppId(e.target.value)}>
          <option value="">Select an application…</option>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
      </div>

      {selectedApp && (
        <>
          <div className="card">
            <p className="panel-title">Allowed groups — {selectedApp.name}</p>
            {policies.length === 0 ? (
              <p className="muted">No groups allowed yet.</p>
            ) : (
              <table>
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "38%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Access</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((policy) => (
                    <tr key={policy.id}>
                      <td>{policy.groupName}</td>
                      <td>
                        <span className="badge badge-active">ALLOW</span>
                      </td>
                      <td>{new Date(policy.createdAt).toLocaleString()}</td>
                      <td>
                        <RowMenu
                          actions={[
                            {
                              label: "Remove",
                              danger: true,
                              onSelect: () => handleRemove(policy.groupId),
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
            <p className="panel-title">Allow a group</p>
            {available.length === 0 ? (
              <p className="muted">All groups are already allowed.</p>
            ) : (
              <div className="inline-form">
                <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
                  <option value="">Select a group…</option>
                  {available.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <button onClick={handleAdd} disabled={!selectedGroupId}>
                  Allow
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
