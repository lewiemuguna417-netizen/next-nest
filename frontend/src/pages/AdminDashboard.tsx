import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, LogOut, Eye, User as UserIcon, Mail, Clock, Filter, SortAsc, SortDesc, Edit2, Users, UserPlus, Shield, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { appointmentsApi, usersApi, type Appointment, type AppointmentsFilter, type User } from "@/lib/api";
import { websocketService } from "@/lib/websocket";

// Helper function to map backend appointment to frontend format
const mapAppointmentFromBackend = (backendAppointment: any): Appointment => {
  return {
    id: backendAppointment.id,
    name: backendAppointment.name,
    email: backendAppointment.email,
    appointmentDateTime: backendAppointment.appointmentDateTime,
    dateTime: backendAppointment.appointmentDateTime, // Frontend compatibility
    notes: backendAppointment.notes || "",
    status: backendAppointment.status || "upcoming",
    googleEventId: backendAppointment.googleEventId || `evt_${backendAppointment.id}`,
    createdAt: backendAppointment.createdAt,
    updatedAt: backendAppointment.updatedAt,
  };
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [filters, setFilters] = useState<AppointmentsFilter>({
    sortBy: 'appointmentDateTime',
    sortOrder: 'ASC'
  });
  const [isCreateAdminDialogOpen, setIsCreateAdminDialogOpen] = useState(false);
  const [adminFormData, setAdminFormData] = useState({ email: "", password: "" });
  const [wsConnectionStatus, setWsConnectionStatus] = useState(websocketService.getConnectionStatus());

  // Initialize WebSocket connection and set up query client
  useEffect(() => {
    websocketService.setQueryClient(queryClient);
    
    // Update connection status periodically
    const statusInterval = setInterval(() => {
      setWsConnectionStatus(websocketService.getConnectionStatus());
    }, 2000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [queryClient]);

  // Fetch appointments with filters
  const { data: backendAppointments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['appointments', filters],
    queryFn: async () => {
      const appointments = await appointmentsApi.getAll(filters);
      return appointments.map(mapAppointmentFromBackend);
    },
  });

  // Fetch all users
  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
  });

  // Fetch all admins
  const { data: admins = [], refetch: refetchAdmins } = useQuery({
    queryKey: ['admins'],
    queryFn: () => usersApi.getAllAdmins(),
  });

  // Create admin mutation
  const createAdminMutation = useMutation({
    mutationFn: (adminData: { email: string; password: string }) => 
      usersApi.createAdmin(adminData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setIsCreateAdminDialogOpen(false);
      setAdminFormData({ email: "", password: "" });
      toast.success('Admin user created successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create admin user';
      toast.error('Creation failed', { description: message });
    },
  });

  // Update appointment status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Appointment["status"] }) => {
      return await appointmentsApi.update(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment status updated successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update appointment status';
      toast.error('Update failed', { description: message });
    },
  });

  const handleLogout = () => {
    logout();
  };

  const handleView = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsViewDialogOpen(true);
  };

  const handleStatusChange = (appointment: Appointment, newStatus: Appointment["status"]) => {
    updateStatusMutation.mutate({ id: appointment.id, status: newStatus });
  };

  const handleFilterChange = (key: keyof AppointmentsFilter, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value
    }));
  };

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split('-');
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: sortOrder as 'ASC' | 'DESC'
    }));
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFormData.email || !adminFormData.password) {
      toast.error('Please fill in all fields');
      return;
    }
    createAdminMutation.mutate(adminFormData);
  };

  const handleAdminFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdminFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const getStatusColor = (status: Appointment["status"]) => {
    switch (status) {
      case "upcoming":
        return "bg-primary/10 text-primary border-primary/20";
      case "completed":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted";
    }
  };

  const stats = {
    total: backendAppointments.length,
    upcoming: backendAppointments.filter((a) => a.status === "upcoming").length,
    completed: backendAppointments.filter((a) => a.status === "completed").length,
    cancelled: backendAppointments.filter((a) => a.status === "cancelled").length,
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Error Loading Dashboard</h2>
          <p className="text-muted-foreground mb-4">
            Failed to load appointments. Please check your connection.
          </p>
          <Button onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50 shadow-soft">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary">PAXFORM</h1>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Admin Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2">
              {wsConnectionStatus.isConnected ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-700 rounded-full border border-green-500/20">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm font-medium hidden sm:inline">Connected</span>
                </div>
              ) : wsConnectionStatus.reconnectAttempts > 0 ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-700 rounded-full border border-yellow-500/20">
                  <WifiOff className="h-4 w-4 animate-pulse" />
                  <span className="text-sm font-medium hidden sm:inline">
                    Reconnecting ({wsConnectionStatus.reconnectAttempts}/5)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-700 rounded-full border border-red-500/20">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm font-medium hidden sm:inline">Disconnected</span>
                </div>
              )}
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-4 gap-4 mb-8">
          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Appointments
                  </p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Upcoming</p>
                  <p className="text-3xl font-bold text-primary">{stats.upcoming}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Admins</p>
                  <p className="text-3xl font-bold text-blue-600">{admins.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="admins">Admin Management</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            {/* Appointments Table with Filters */}
            <Card className="shadow-medium border-border/50">
              <CardHeader>
                <CardTitle>All Appointments</CardTitle>
                <CardDescription>
                  View and manage all scheduled appointments
                </CardDescription>
                
                {/* Filters and Sorting */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select 
                      value={filters.status || 'all'} 
                      onValueChange={(value) => handleFilterChange('status', value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {filters.sortOrder === 'ASC' ? (
                      <SortAsc className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <SortDesc className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Select 
                      value={`${filters.sortBy}-${filters.sortOrder}`} 
                      onValueChange={handleSortChange}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="appointmentDateTime-ASC">Date (Oldest First)</SelectItem>
                        <SelectItem value="appointmentDateTime-DESC">Date (Newest First)</SelectItem>
                        <SelectItem value="createdAt-ASC">Created (Oldest First)</SelectItem>
                        <SelectItem value="createdAt-DESC">Created (Newest First)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="rounded-md border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backendAppointments.map((appointment) => (
                        <TableRow key={appointment.id} className="hover:bg-muted/30 transition-smooth">
                          <TableCell className="font-medium">{appointment.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {appointment.email}
                          </TableCell>
                          <TableCell>{formatDateTime(appointment.dateTime || appointment.appointmentDateTime)}</TableCell>
                          <TableCell>
                            <Select
                              value={appointment.status}
                              onValueChange={(value) => handleStatusChange(appointment, value as Appointment["status"])}
                              disabled={updateStatusMutation.isPending}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue>
                                  <Badge
                                    variant="outline"
                                    className={getStatusColor(appointment.status)}
                                  >
                                    {appointment.status}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="upcoming">
                                  <Badge className="bg-primary/10 text-primary border-primary/20">
                                    Upcoming
                                  </Badge>
                                </SelectItem>
                                <SelectItem value="completed">
                                  <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
                                    Completed
                                  </Badge>
                                </SelectItem>
                                <SelectItem value="cancelled">
                                  <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                                    Cancelled
                                  </Badge>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(appointment)}
                                className="h-8 w-8 p-0"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {backendAppointments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No appointments found</p>
                      <p className="text-sm">
                        {filters.status ? 
                          `No ${filters.status} appointments match your current filters.` : 
                          'No appointments have been scheduled yet.'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins">
            {/* Admin Management */}
            <Card className="shadow-medium border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Admin Management</CardTitle>
                    <CardDescription>
                      Create and manage admin users
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsCreateAdminDialogOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Admin
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Email</TableHead>
                        <TableHead>Admin Since</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admins.map((admin) => (
                        <TableRow key={admin.id} className="hover:bg-muted/30 transition-smooth">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-blue-600" />
                              {admin.email}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                              Admin
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {admins.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No admin users found</p>
                      <p className="text-sm">
                        Create your first admin user to get started.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>
              View complete appointment information
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <UserIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p className="text-base">{selectedAppointment.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base">{selectedAppointment.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Date & Time
                  </p>
                  <p className="text-base">
                    {formatDateTime(selectedAppointment.dateTime || selectedAppointment.appointmentDateTime)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={getStatusColor(selectedAppointment.status)}
                  >
                    {selectedAppointment.status}
                  </Badge>
                </div>
              </div>
              {selectedAppointment.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Notes
                  </p>
                  <p className="text-base text-muted-foreground bg-muted p-3 rounded-md">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}
              {selectedAppointment.googleEventId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Google Calendar Event ID
                  </p>
                  <p className="text-sm font-mono bg-muted p-2 rounded">
                    {selectedAppointment.googleEventId}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Admin Dialog */}
      <Dialog open={isCreateAdminDialogOpen} onOpenChange={setIsCreateAdminDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Admin User</DialogTitle>
            <DialogDescription>
              Create a new admin user with full dashboard access
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                value={adminFormData.email}
                onChange={handleAdminFormChange}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter secure password"
                value={adminFormData.password}
                onChange={handleAdminFormChange}
                required
                autoComplete="new-password"
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateAdminDialogOpen(false);
                  setAdminFormData({ email: "", password: "" });
                }}
                disabled={createAdminMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createAdminMutation.isPending || !adminFormData.email || !adminFormData.password}
              >
                {createAdminMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Create Admin
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
