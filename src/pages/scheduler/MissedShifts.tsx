import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Users, Building, Check, X, Play, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/api-client";
import { ensureArray } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useMissedShifts, MissedShift, ReplacementRequest } from "@/hooks/useMissedShifts";
import { format, parseISO } from "date-fns";

export default function MissedShifts() {
  const { user } = useAuth();
  const { isSuperAdmin, isOrganizationManager, isCompanyManager, isEmployee } = useUserRole();
  
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string; organization_id?: string }[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("missed");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ReplacementRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);

  const hasAccess = isSuperAdmin || isOrganizationManager || isCompanyManager;
  
  // Get current user's employee company (for filtering)
  useEffect(() => {
    const getMyCompanyId = async () => {
      if (!user) return;
      const raw = await apiClient.get<any>('/scheduler/employees/', { user: user.id });
      const employees = ensureArray(raw);
      const data = employees.length > 0 ? employees[0] : null;
      setMyCompanyId(data?.company_id || null);
    };
    getMyCompanyId();
  }, [user]);
  
  const {
    missedShifts,
    replacementRequests,
    loading,
    myEmployeeId,
    requestReplacement,
    approveRequest,
    rejectRequest,
    startReplacementShift,
    refetch
  } = useMissedShifts(
    selectedCompany !== 'all' ? selectedCompany : undefined,
    // For employees, auto-filter to their company
    isEmployee && !hasAccess ? myCompanyId || undefined : undefined
  );

  // Load filters based on role
  useEffect(() => {
    const loadFilters = async () => {
      if (!user) return;
      try {
      if (isSuperAdmin) {
        const rawOrgs = await apiClient.get<any>('/scheduler/organizations/');
        setOrganizations(ensureArray(rawOrgs));
      }

      const params: any = {};
      if (isOrganizationManager) {
        const rawOrgs = await apiClient.get<any>('/scheduler/organizations/', { organization_manager: user.id });
        const orgs = ensureArray(rawOrgs);
        const orgIds = orgs.map((o: any) => o.id);
        if (orgIds.length > 0) {
          params.organization = orgIds.join(',');
        }
      } else if (isCompanyManager) {
        params.company_manager = user.id;
      }

      const rawCompanies = await apiClient.get<any>('/scheduler/companies/', params);
      const companiesList = ensureArray(rawCompanies).map((c: any) => ({
        ...c,
        organization_id: c.organization_id ?? (typeof c.organization === 'string' ? c.organization : c.organization?.id)
      }));
      setCompanies(companiesList);
      
      // Auto-select if only one company
      if (companiesList.length === 1 && selectedCompany === "all") {
        setSelectedCompany(companiesList[0].id);
      }
    } catch (error) {
      console.error("Error loading filters:", error);
      setCompanies([]);
    }
    };
    loadFilters();
  }, [user, isSuperAdmin, isOrganizationManager, isCompanyManager]);

  // Filter companies by selected organization
  const filteredCompanies = selectedOrganization !== 'all'
    ? companies.filter(c => c.organization_id === selectedOrganization)
    : companies;

  const handleRejectConfirm = async () => {
    if (selectedRequest) {
      await rejectRequest(selectedRequest.id, rejectNotes);
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectNotes("");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Pending</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-500/20 text-green-700">Approved</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-500/20 text-red-700">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingRequests = replacementRequests.filter(r => r.status === 'pending');
  const processedRequests = replacementRequests.filter(r => r.status !== 'pending');

  // Check if current user already requested a shift
  const hasRequestedShift = (shiftId: string) => {
    return replacementRequests.some(r => 
      r.shift_id === shiftId && 
      r.replacement_employee_id === myEmployeeId
    );
  };

  // Check if shift already has approved replacement
  const hasApprovedReplacement = (shift: MissedShift) => {
    return !!shift.replacement_employee_id && !!shift.replacement_approved_at;
  };

  if (!hasAccess && !isEmployee) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to view missed shifts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Missed Shifts
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage missed shifts and replacement requests
          </p>
        </div>
      </div>

      {/* Filters - Only for managers */}
      {hasAccess && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              {isSuperAdmin && organizations.length > 0 && (
                <Select value={selectedOrganization} onValueChange={(v) => {
                  setSelectedOrganization(v);
                  setSelectedCompany("all");
                }}>
                  <SelectTrigger className="w-[200px]">
                    <Building className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {filteredCompanies.length > 1 && (
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="w-[200px]">
                    <Building className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {filteredCompanies.map(company => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {filteredCompanies.length === 1 && (
                <Badge variant="secondary" className="px-3 py-1.5">
                  <Building className="h-4 w-4 mr-2" />
                  {filteredCompanies[0].name}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="missed">
            Missed Shifts
            {missedShifts.length > 0 && (
              <Badge variant="destructive" className="ml-2">{missedShifts.length}</Badge>
            )}
          </TabsTrigger>
          {hasAccess && (
            <TabsTrigger value="requests">
              Replacement Requests
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-700">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Missed Shifts Tab */}
        <TabsContent value="missed" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : missedShifts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Missed Shifts</h3>
                <p className="text-muted-foreground">
                  All employees are attending their scheduled shifts.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {missedShifts.map(shift => (
                <Card key={shift.id} className="border-l-4 border-l-destructive">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Shift Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-destructive">
                              {shift.employee?.first_name?.[0]}{shift.employee?.last_name?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {shift.employee?.first_name} {shift.employee?.last_name}
                              <span className="text-muted-foreground ml-2">(Original)</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {shift.company?.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {format(parseISO(shift.start_time), 'MMM d, yyyy')}
                          </span>
                          <span className="text-muted-foreground">
                            {format(parseISO(shift.start_time), 'h:mm a')} - {format(parseISO(shift.end_time), 'h:mm a')}
                          </span>
                          {shift.replacement_clock_out ? (
                            <Badge variant="secondary" className="bg-green-500/20 text-green-700">Completed</Badge>
                          ) : (
                            <Badge variant="destructive">Missed</Badge>
                          )}
                          {shift.missed_at && (
                            <span className="text-xs text-muted-foreground">
                              Marked at {format(parseISO(shift.missed_at), 'h:mm a')}
                            </span>
                          )}
                        </div>

                        {/* Replacement Info */}
                        {hasApprovedReplacement(shift) && (
                          <div className="flex items-center gap-2 pt-2 border-t mt-2">
                            <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-green-600">
                                {shift.replacement_employee?.first_name?.[0]}{shift.replacement_employee?.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-green-700">
                                {shift.replacement_employee?.first_name} {shift.replacement_employee?.last_name}
                                <span className="text-muted-foreground ml-2">(Replacement)</span>
                              </p>
                              {shift.replacement_clock_out ? (
                                <Badge variant="secondary" className="bg-green-500/20 text-green-700 text-xs">
                                  Completed {`at ${format(parseISO(shift.replacement_clock_out), 'h:mm a')}`}
                                </Badge>
                              ) : shift.replacement_clock_in || shift.replacement_started_at || shift.status === 'in_progress' ? (
                                <Badge variant="secondary" className="bg-green-500/20 text-green-700 text-xs">
                                  Clocked In {shift.replacement_clock_in
                                    ? `at ${format(parseISO(shift.replacement_clock_in), 'h:mm a')}`
                                    : shift.replacement_started_at
                                      ? `at ${format(parseISO(shift.replacement_started_at), 'h:mm a')}`
                                      : ''}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 text-xs">
                                  Approved - Waiting to start
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {/* Employee can request to take shift */}
                        {isEmployee && myEmployeeId && !hasApprovedReplacement(shift) && (
                          <>
                            {hasRequestedShift(shift.id) ? (
                              <Badge variant="secondary">Request Pending</Badge>
                            ) : (
                              <Button 
                                size="sm" 
                                onClick={() => requestReplacement(shift.id, shift.employee_id, shift.company_id)}
                              >
                                Request to Cover
                              </Button>
                            )}
                          </>
                        )}

                        {/* Approved replacement can start shift */}
                        {isEmployee && myEmployeeId === shift.replacement_employee_id && 
                         shift.replacement_approved_at && !shift.replacement_started_at && (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => startReplacementShift(shift.id)}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start Shift
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Replacement Requests Tab - Managers only */}
        {hasAccess && (
          <TabsContent value="requests" className="space-y-6">
            {/* Pending Requests */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Pending Requests
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">
                    {pendingRequests.length}
                  </Badge>
                )}
              </h3>

              {pendingRequests.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No pending replacement requests
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pendingRequests.map(request => (
                    <Card key={request.id} className="border-l-4 border-l-yellow-500">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Replacement:</p>
                                <p className="font-medium">
                                  {request.replacement_employee?.first_name} {request.replacement_employee?.last_name}
                                </p>
                              </div>
                              <span className="text-muted-foreground">→</span>
                              <div>
                                <p className="text-sm text-muted-foreground">Original:</p>
                                <p className="font-medium">
                                  {request.original_employee?.first_name} {request.original_employee?.last_name}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Requested {format(parseISO(request.requested_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                setSelectedRequest(request);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button 
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => approveRequest(request.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Processed Requests */}
            {processedRequests.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Processed Requests</h3>
                <div className="grid gap-4">
                  {processedRequests.map(request => (
                    <Card key={request.id} className="opacity-75">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-4">
                              <p className="font-medium">
                                {request.replacement_employee?.first_name} {request.replacement_employee?.last_name}
                              </p>
                              <span className="text-muted-foreground">→</span>
                              <p className="text-muted-foreground">
                                {request.original_employee?.first_name} {request.original_employee?.last_name}
                              </p>
                            </div>
                            {request.reviewer_notes && (
                              <p className="text-sm text-muted-foreground italic">
                                "{request.reviewer_notes}"
                              </p>
                            )}
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Replacement Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-notes">Reason (optional)</Label>
            <Textarea
              id="reject-notes"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirm}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
