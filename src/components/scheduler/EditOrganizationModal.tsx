import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Supabase removed - using Django API
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  color: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  organization_manager_id: string | null;
}

interface EditOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization | null;
  onSuccess?: () => void;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

export default function EditOrganizationModal({ open, onOpenChange, organization, onSuccess }: EditOrganizationModalProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    color: "#6366f1",
    address: "",
    phone: "",
    email: "",
    organization_manager_id: ""
  });

  useEffect(() => {
    if (open && organization) {
      setFormData({
        name: organization.name || "",
        color: organization.color || "#6366f1",
        address: organization.address || "",
        phone: organization.phone || "",
        email: organization.email || "",
        organization_manager_id: organization.organization_manager_id || ""
      });
      fetchAvailableUsers();
    }
  }, [open, organization]);

  const fetchAvailableUsers = async () => {
    try {
      // Get users with operations_manager role for organization manager assignment
      const allUsers = await apiClient.get<any[]>('/auth/users/');
      const opsManagerUsers = allUsers.filter((u: any) => {
        const roles = u.roles || [];
        return roles.some((r: any) => r.role === 'operations_manager') &&
               u.profile?.status !== 'deleted' &&
               (u.profile?.status === 'active' || !u.profile?.status);
      });

      const profiles = opsManagerUsers.map((u: any) => ({
        user_id: u.id,
        full_name: u.profile?.full_name || u.email || '',
        email: u.email || ''
      })).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setAvailableUsers(profiles);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !formData.name) return;

    setLoading(true);
    try {
      await apiClient.patch(`/scheduler/organizations/${organization.id}/`, {
        name: formData.name,
        color: formData.color,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        organization_manager_id: (formData.organization_manager_id && formData.organization_manager_id !== "none") ? formData.organization_manager_id : null
      });

      onSuccess?.();
      onOpenChange(false);
      toast.success("Organization updated successfully!");
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error("Failed to update organization");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!organization) return;
    
    setDeleting(true);
    try {
      await apiClient.delete(`/scheduler/organizations/${organization.id}/`);

      onSuccess?.();
      onOpenChange(false);
      toast.success("Organization deleted successfully!");
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast.error("Failed to delete organization. Make sure there are no companies associated with it.");
    } finally {
      setDeleting(false);
    }
  };

  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter organization name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Brand Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-16 h-10 p-1"
              />
              <Input
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                placeholder="#6366f1"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter organization address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contact@organization.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-manager">Organization Manager</Label>
            <Select
              value={formData.organization_manager_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, organization_manager_id: value }))}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select organization manager" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="none">No organization manager</SelectItem>
                {availableUsers.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              The organization manager has super admin access to all companies within this organization.
            </p>
          </div>

          <div className="flex justify-between pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading || deleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{organization.name}"? This action cannot be undone. 
                    All associated companies will also be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Deleting..." : "Delete Organization"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || deleting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || deleting || !formData.name}>
                {loading ? "Updating..." : "Update Organization"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
