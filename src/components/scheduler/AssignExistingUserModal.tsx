import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import apiClient from "@/lib/api-client";
import { ensureArray } from "@/lib/utils";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

interface AssignExistingUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  /** Current employee user IDs in this company (to exclude from list) */
  existingEmployeeUserIds: string[];
  onSuccess?: () => void;
}

interface UserOption {
  id: string;
  email: string;
  full_name: string;
}

export default function AssignExistingUserModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  existingEmployeeUserIds,
  onSuccess,
}: AssignExistingUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    if (!open || !companyId) return;
    setSelectedUserId("");
    loadUsers();
  }, [open, companyId, existingEmployeeUserIds.join(",")]);

  const loadUsers = async () => {
    try {
      const raw = await apiClient.get<any>("/auth/users/");
      const all = ensureArray(raw);
      const employeeRoleNames = ["employee", "house_keeping", "maintenance"];
      const setExisting = new Set(existingEmployeeUserIds);

      const assignable = all.filter((u: any) => {
        const roles = Array.isArray(u.roles) ? u.roles : [];
        const roleNames = roles.map((r: any) => (r?.role ?? r?.name ?? r)?.toString?.() ?? r);
        const hasEmployeeRole = employeeRoleNames.some((r) => roleNames.includes(r));
        const notInCompany = !setExisting.has(u.id);
        return hasEmployeeRole && notInCompany && (u.is_active !== false);
      });

      setUsers(
        assignable.map((u: any) => ({
          id: u.id,
          email: (u.email ?? "").toString(),
          full_name: (u.full_name ?? u.email ?? "Unknown").toString().trim() || u.email,
        }))
      );
    } catch (e) {
      console.error("Error loading users:", e);
      toast.error("Failed to load users");
      setUsers([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !companyId) {
      toast.error("Please select a user");
      return;
    }
    const user = users.find((u) => u.id === selectedUserId);
    if (!user) return;

    setLoading(true);
    try {
      await apiClient.post("/scheduler/employees/", {
        user: selectedUserId,
        company: companyId,
        first_name: (user.full_name || "").split(" ")[0] || "Employee",
        last_name: (user.full_name || "").split(" ").slice(1).join(" ") || "User",
        email: user.email,
        status: "active",
      });
      toast.success(`Assigned ${user.full_name || user.email} to ${companyName}`);
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error assigning user:", err);
      const msg = err?.message || (err?.detail && (Array.isArray(err.detail) ? err.detail.join(" ") : err.detail));
      toast.error(msg || "Failed to assign user to company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Assign existing user to company
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user to assign" />
              </SelectTrigger>
              <SelectContent>
                {users.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No unassigned users with employee role
                  </SelectItem>
                ) : (
                  users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedUserId || selectedUserId === "_none"}
            >
              {loading ? "Assigning..." : "Assign to company"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
