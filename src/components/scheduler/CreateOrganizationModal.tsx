import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Supabase removed - using Django API
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { formatPhoneUS, parsePhoneUS } from "@/lib/utils";

interface CreateOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

export default function CreateOrganizationModal({ open, onOpenChange, onSuccess }: CreateOrganizationModalProps) {
  const [loading, setLoading] = useState(false);
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
    if (open) {
      fetchAvailableUsers();
    }
  }, [open]);

  const fetchAvailableUsers = async () => {
    try {
      // Get users with operations_manager role for organization manager assignment
      const rawUsers = await apiClient.get<any>('/auth/users/');
      const allUsers = Array.isArray(rawUsers) ? rawUsers : (rawUsers && typeof rawUsers === 'object' && Array.isArray((rawUsers as any).results) ? (rawUsers as any).results : []);
      
      const opsManagerUsers = allUsers.filter((u: any) => {
        const roles = Array.isArray(u.roles) ? u.roles : [];
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
      toast.error('Failed to load available users');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, phone: formatPhoneUS(e.target.value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error("Organization name is required");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/scheduler/organizations/', {
        name: formData.name,
        color: formData.color,
        address: formData.address || null,
        phone: formData.phone ? parsePhoneUS(formData.phone) : null,
        email: formData.email || null,
        organization_manager_id: (formData.organization_manager_id && formData.organization_manager_id !== "none") ? formData.organization_manager_id : null
      });

      onOpenChange(false);
      onSuccess?.();
      setFormData({
        name: "",
        color: "#6366f1",
        address: "",
        phone: "",
        email: "",
        organization_manager_id: ""
      });
      toast.success('Organization created successfully!');
    } catch (error: any) {
      console.error('Failed to create organization:', error);
      const errorMessage = error?.message || error?.detail || 'Failed to create organization';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
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
                type="tel"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                maxLength={14}
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
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? "Creating..." : "Create Organization"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
