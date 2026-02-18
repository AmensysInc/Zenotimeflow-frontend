import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
// Supabase removed - using Django API
import { toast } from "sonner";
import { UserCheck, User } from "lucide-react";

interface AssignManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: any;
  onSuccess: () => void;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

export default function AssignManagerModal({ 
  open, 
  onOpenChange, 
  company, 
  onSuccess 
}: AssignManagerModalProps) {
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [companyManager, setCompanyManager] = useState("");

  useEffect(() => {
    if (open && company) {
      fetchAvailableUsers();
      setCompanyManager(company.company_manager_id || "");
    }
  }, [open, company]);

  const fetchAvailableUsers = async () => {
    try {
      // Get all users with manager role
      const allUsers = await apiClient.get<any[]>('/auth/users/');
      const managerUsers = allUsers.filter((u: any) => {
        const roles = u.roles || [];
        const isManager = roles.some((r: any) => r.role === 'manager');
        const isActive = u.profile?.status === 'active' || !u.profile?.status;
        const notCreatedBy = !company?.created_by || u.id !== company.created_by;
        return isManager && isActive && notCreatedBy;
      });

      const profiles = managerUsers.map((u: any) => ({
        user_id: u.id,
        full_name: u.profile?.full_name || u.email || '',
        email: u.email || ''
      })).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setAvailableUsers(profiles);
    } catch (error) {
      console.error('Error fetching managers:', error);
      const message = (error as any)?.message;
      toast.error(message ? `Failed to load managers: ${message}` : 'Failed to load available managers');
      setAvailableUsers([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setLoading(true);

    try {
      const updates: any = {};
      
      if (companyManager !== company.company_manager_id) {
        updates.company_manager_id = (companyManager && companyManager !== "none") ? companyManager : null;
      }

      if (Object.keys(updates).length > 0) {
        const updated = await apiClient.patch(`/scheduler/companies/${company.id}/`, updates);
        
        if (!updated) {
          throw new Error('Company update was blocked (no rows updated). Check permissions.');
        }
      }

      onSuccess();
      onOpenChange(false);
      toast.success('Manager assigned successfully!');
    } catch (error) {
      console.error('Error assigning manager:', error);
      const message = (error as any)?.message;
      toast.error(message ? `Failed to assign manager: ${message}` : 'Failed to assign manager');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCompanyManager("");
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Assign Manager - {company.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-manager" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Company Manager
              </Label>
              <Select
                value={companyManager}
                onValueChange={setCompanyManager}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select company manager" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="none">No company manager</SelectItem>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                The company manager will have full admin access to all operations within this company.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Assigning..." : "Assign Manager"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}