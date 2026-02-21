import { useState, useEffect } from "react";
import React from "react";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCompanies, useOrganizations } from "@/hooks/useSchedulerDatabase";
import apiClient from "@/lib/api-client";
import CreateCompanyModal from "@/components/scheduler/CreateCompanyModal";
import EditCompanyModal from "@/components/scheduler/EditCompanyModal";
import CompanyDetailModal from "@/components/scheduler/CompanyDetailModal";
import AssignManagerModal from "@/components/scheduler/AssignManagerModal";
import CreateOrganizationModal from "@/components/scheduler/CreateOrganizationModal";
import EditOrganizationModal from "@/components/scheduler/EditOrganizationModal";
import OrganizationCard from "@/components/scheduler/OrganizationCard";
import CompanyCard from "@/components/scheduler/CompanyCard";
import { toast } from "sonner";

export default function Companies() {
  const { user } = useAuth();
  const { role, isOrganizationManager, isLoading: roleLoading } = useUserRole();
  const orgManagerId = isOrganizationManager && user?.id ? user.id : undefined;
  const { companies, loading: companiesLoading, fetchCompanies } = useCompanies(undefined, orgManagerId);
  const { organizations, loading: orgsLoading, fetchOrganizations } = useOrganizations(orgManagerId);
  
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);
  
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<any>(null);
  const [selectedOrgIdForCompany, setSelectedOrgIdForCompany] = useState<string>("");

  const canCreateOrganization = role === 'super_admin';
  const canCreateCompany = role === 'super_admin' || role === 'operations_manager';
  const canEditCompany = role === 'super_admin' || role === 'operations_manager';
  
  // For company managers: filter to only show their assigned company
  const filteredCompanies = React.useMemo(() => {
    if (role === 'manager' && user) {
      return companies.filter(c => c.company_manager_id === user.id);
    }
    return companies;
  }, [companies, role, user]);
  
  // For company managers: filter organizations to only show orgs with their company
  const filteredOrganizations = React.useMemo(() => {
    if (role === 'manager' && filteredCompanies.length > 0) {
      const orgIds = new Set(filteredCompanies.map(c => c.organization_id).filter(Boolean));
      return organizations.filter(org => orgIds.has(org.id));
    }
    return organizations;
  }, [organizations, filteredCompanies, role]);

  const handleEditOrganization = (org: any) => {
    setSelectedOrganization(org);
    setShowEditOrgModal(true);
  };

  const handleCreateCompany = (orgId: string) => {
    setSelectedOrgIdForCompany(orgId);
    setShowCreateCompanyModal(true);
  };

  const handleEditCompany = (company: any) => {
    setSelectedCompany(company);
    setShowEditCompanyModal(true);
  };

  const handleViewCompany = (company: any) => {
    setSelectedCompany(company);
    setShowDetailModal(true);
  };

  const handleAssignManager = (company: any) => {
    setSelectedCompany(company);
    setShowAssignModal(true);
  };

  const handleRefresh = () => {
    fetchCompanies();
    fetchOrganizations();
  };

  const loading = companiesLoading || orgsLoading || roleLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Organization Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage organizations, companies, and assign managers
            </p>
          </div>
          
          <div className="flex gap-2">
            {canCreateOrganization && (
              <Button 
                onClick={() => setShowCreateOrgModal(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            )}
            {!canCreateOrganization && canCreateCompany && (organizations.length > 0 || isOrganizationManager) && (
              <Button 
                onClick={() => {
                  setSelectedOrgIdForCompany(organizations[0]?.id || "");
                  setShowCreateCompanyModal(true);
                }}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Company
              </Button>
            )}
          </div>
        </div>

        {/* Organization manager: flat list of companies only (no org cards) */}
        {isOrganizationManager ? (
          <div className="space-y-6">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCompanies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  canEdit={canEditCompany}
                  onEdit={() => handleEditCompany(company)}
                  onView={() => handleViewCompany(company)}
                  onAssignManager={() => handleAssignManager(company)}
                />
              ))}
            </div>
            {filteredCompanies.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No companies in your organization</h3>
                <p className="text-muted-foreground mb-6">
                  {canCreateCompany ? "Create a company to get started" : "No companies have been added yet"}
                </p>
                {canCreateCompany && organizations[0]?.id && (
                  <Button onClick={() => { setSelectedOrgIdForCompany(organizations[0].id); setShowCreateCompanyModal(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Company
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {filteredOrganizations.map((org) => (
                <OrganizationCard
                  key={org.id}
                  organization={org}
                  companies={filteredCompanies.filter(c => c.organization_id === org.id)}
                  canEdit={canEditCompany}
                  canCreateCompany={canCreateCompany}
                  onEditOrganization={handleEditOrganization}
                  onCreateCompany={handleCreateCompany}
                  onEditCompany={handleEditCompany}
                  onViewCompany={handleViewCompany}
                  onAssignManager={handleAssignManager}
                />
              ))}
            </div>

            {filteredOrganizations.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No organizations found</h3>
                <p className="text-muted-foreground mb-6">
                  {canCreateOrganization 
                    ? "Create your first organization to get started" 
                    : "No organizations have been created yet"
                  }
                </p>
                {canCreateOrganization && (
                  <Button onClick={() => setShowCreateOrgModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Organization
                  </Button>
                )}
                {role === 'manager' && filteredCompanies.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Viewing your assigned company only
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <CreateOrganizationModal 
        open={showCreateOrgModal} 
        onOpenChange={setShowCreateOrgModal}
        onSuccess={handleRefresh}
      />

      <EditOrganizationModal 
        open={showEditOrgModal} 
        onOpenChange={setShowEditOrgModal}
        organization={selectedOrganization}
        onSuccess={handleRefresh}
      />

      <CreateCompanyModal 
        open={showCreateCompanyModal} 
        onOpenChange={setShowCreateCompanyModal}
        organizationId={selectedOrgIdForCompany}
        onSuccess={handleRefresh}
      />

      <EditCompanyModal 
        open={showEditCompanyModal} 
        onOpenChange={setShowEditCompanyModal}
        company={selectedCompany}
        onSuccess={handleRefresh}
      />

      <CompanyDetailModal 
        open={showDetailModal} 
        onOpenChange={setShowDetailModal}
        company={selectedCompany}
      />

      <AssignManagerModal 
        open={showAssignModal} 
        onOpenChange={setShowAssignModal}
        company={selectedCompany}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
