import { useState, useEffect } from "react";
import {
  Users, Plus, Trash2, Edit2, Shield, ToggleLeft, ToggleRight,
  Phone, Mail, Building2, Clock, Activity, Search, Filter,
  CheckCircle, XCircle, Eye, EyeOff, Copy, ChevronDown, ChevronUp, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  fetchStaff, addStaffMember, updateStaffMember, deleteStaffMember,
  loadActivities, loadAttendance,
  ROLE_PERMISSIONS, ROLE_LABELS, ROLE_COLORS, PERMISSION_LABELS,
  type StaffMember, type StaffRole, type Permission,
} from "@/lib/staff-auth";

const ALL_ROLES: StaffRole[] = ["admin","manager","delivery","marketing","support","custom"];
const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export default function StaffManagement() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activities, setActivities] = useState(loadActivities().slice(0, 50));
  const [attendance, setAttendance] = useState(loadAttendance());
  const [tab, setTab] = useState<"staff"|"activity"|"attendance">("staff");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole|"all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedPerms, setExpandedPerms] = useState<string|null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "",
    role: "support" as StaffRole, department: "",
    whatsappNumber: "", permissions: [] as Permission[],
  });

  // Passwords sirf create/edit ke waqt pata hote hain (server sirf hash rakhta hai)
  const [knownPasswords, setKnownPasswords] = useState<Record<string, string>>({});

  async function refreshStaff() {
    try { setStaff(await fetchStaff()); }
    catch (e) { toast({ title: e instanceof Error ? e.message : "Could not load staff", variant: "destructive" }); }
  }

  useEffect(() => { refreshStaff(); }, []);

  function handleRoleChange(role: StaffRole) {
    setForm(f => ({ ...f, role, permissions: ROLE_PERMISSIONS[role] }));
  }

  function togglePermission(perm: Permission) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }));
  }

  function resetForm() {
    setForm({ name:"",email:"",phone:"",password:"",role:"support",department:"",whatsappNumber:"",permissions:[] });
    setEditingId(null); setShowForm(false);
  }

  async function handleSubmit() {
    if (!form.name || !form.email || (!editingId && !form.password)) {
      toast({ title: "Name, email and password are required", variant: "destructive" }); return;
    }
    try {
      if (editingId) {
        await updateStaffMember(editingId, { ...form, password: form.password || undefined });
        if (form.password) setKnownPasswords(k => ({ ...k, [editingId]: form.password }));
        toast({ title: "✅ Staff updated!" });
      } else {
        const created = await addStaffMember({ ...form, isActive: true, isBlocked: false, createdBy: "admin", avatar: undefined });
        setKnownPasswords(k => ({ ...k, [created.id]: form.password }));
        toast({ title: "✅ Staff member added!", description: `${form.name} can now login from any device` });
      }
      await refreshStaff(); resetForm();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Something went wrong", variant: "destructive" });
    }
  }

  function startEdit(member: StaffMember) {
    setForm({
      name: member.name, email: member.email, phone: member.phone,
      password: "", role: member.role, department: member.department,
      whatsappNumber: member.whatsappNumber || "", permissions: member.permissions,
    });
    setEditingId(member.id); setShowForm(true);
  }

  async function toggleBlock(id: string, blocked: boolean) {
    try {
      await updateStaffMember(id, { isBlocked: !blocked });
      await refreshStaff();
      toast({ title: blocked ? "Staff unblocked" : "Staff blocked" });
    } catch (e) { toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" }); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await deleteStaffMember(id);
      await refreshStaff();
      toast({ title: "Staff member deleted" });
    } catch (e) { toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" }); }
  }

  function copyCredentials(member: StaffMember) {
    const pw = knownPasswords[member.id] ?? "(jo password set kiya tha wahi hai — edit karke naya set kar sakte hain)";
    navigator.clipboard.writeText(`Email: ${member.email}\nPassword: ${pw}\nRole: ${ROLE_LABELS[member.role]}`);
    toast({ title: "Credentials copied!" });
  }

  const today = new Date().toISOString().split("T")[0];

  const filtered = staff.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: staff.length,
    active: staff.filter(s => s.isActive && !s.isBlocked).length,
    blocked: staff.filter(s => s.isBlocked).length,
    todayPresent: attendance.filter(a => a.date === today).length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Staff Management
          </h1>
          <p className="text-muted-foreground text-sm">Manage team members, roles & permissions</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Add Staff Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Staff", value: stats.total, icon: Users, color: "#2d4a2d" },
          { label: "Active", value: stats.active, icon: CheckCircle, color: "#16a34a" },
          { label: "Blocked", value: stats.blocked, icon: XCircle, color: "#dc2626" },
          { label: "Present Today", value: stats.todayPresent, icon: Clock, color: "#0369a1" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {(["staff","activity","attendance"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "staff" ? "👥 Staff" : t === "activity" ? "📋 Activity" : "🕐 Attendance"}
          </button>
        ))}
      </div>

      {/* ── ADD/EDIT FORM ── */}
      {showForm && (
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-4 sm:p-6 space-y-5">
          <h3 className="font-semibold text-lg">{editingId ? "Edit Staff Member" : "Add New Staff Member"}</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Staff member name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email *</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+91 9876543210" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">WhatsApp Number</label>
              <Input value={form.whatsappNumber} onChange={e => setForm(f => ({...f, whatsappNumber: e.target.value}))} placeholder="+91 9876543210" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Department</label>
              <Input value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} placeholder="e.g. Operations" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password *</label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={form.password}
                  onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  placeholder={editingId ? "Naya password (khali = purana rahega)" : "Set login password"} className="pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map(role => (
                <button key={role} onClick={() => handleRoleChange(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${form.role === role ? "text-white border-transparent" : "border-border text-muted-foreground hover:border-primary"}`}
                  style={form.role === role ? { background: ROLE_COLORS[role] } : {}}>
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Permissions</label>
              <span className="text-xs text-muted-foreground">{form.permissions.length} selected</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PERMISSIONS.map(perm => (
                <label key={perm} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-xs ${form.permissions.includes(perm) ? "bg-primary/10 border-primary/40 text-primary font-medium" : "border-border hover:bg-muted/40"}`}>
                  <input type="checkbox" checked={form.permissions.includes(perm)}
                    onChange={() => togglePermission(perm)} className="accent-primary" />
                  {PERMISSION_LABELS[perm]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSubmit} className="gap-2">
              <CheckCircle className="h-4 w-4" /> {editingId ? "Update Staff" : "Add Staff Member"}
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── STAFF TAB ── */}
      {tab === "staff" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email..." className="pl-9" />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as StaffRole|"all")}
              className="h-10 px-3 rounded-md border bg-background text-sm min-w-32">
              <option value="all">All Roles</option>
              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>

          {/* Staff Cards */}
          <div className="space-y-3">
            {filtered.map(member => {
              const todayPresent = attendance.find(a => a.staffId === member.id && a.date === today);
              return (
                <div key={member.id} className={`bg-card border rounded-xl p-4 transition-all ${member.isBlocked ? "opacity-60 border-red-200" : ""}`}>
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ background: ROLE_COLORS[member.role] }}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{member.name}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ background: ROLE_COLORS[member.role] }}>
                          {ROLE_LABELS[member.role]}
                        </span>
                        {member.isBlocked && <Badge variant="destructive" className="text-xs">Blocked</Badge>}
                        {todayPresent && <Badge className="text-xs bg-green-600">Present Today</Badge>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {member.email}
                        </span>
                        {member.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {member.phone}
                          </span>
                        )}
                        {member.department && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {member.department}
                          </span>
                        )}
                        {member.lastLogin && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Last: {new Date(member.lastLogin).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </div>

                      {/* Permissions preview */}
                      <div className="mt-2">
                        <button onClick={() => setExpandedPerms(expandedPerms === member.id ? null : member.id)}
                          className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <Shield className="h-3 w-3" />
                          {member.permissions.length} permissions
                          {expandedPerms === member.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {expandedPerms === member.id && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {member.permissions.map(p => (
                              <span key={p} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {PERMISSION_LABELS[p]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => copyCredentials(member)} title="Copy credentials">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(member)} title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleBlock(member.id, member.isBlocked)}
                        title={member.isBlocked ? "Unblock" : "Block"}
                        className={member.isBlocked ? "text-green-600" : "text-orange-500"}>
                        {member.isBlocked ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                      </Button>
                      {member.role !== "super_admin" && (
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => handleDelete(member.id, member.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No staff members found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab === "activity" && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Activity Log</h3>
            <span className="text-xs text-muted-foreground">{activities.length} recent activities</span>
          </div>
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {activities.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No activity recorded yet</div>
            )}
            {activities.map(activity => (
              <div key={activity.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{activity.staffName.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{activity.staffName}</span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{activity.action}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.details}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(activity.timestamp).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === "attendance" && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Attendance Records</h3>
            <p className="text-xs text-muted-foreground mt-1">Today: {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}</p>
          </div>
          <div className="p-4 space-y-3">
            {staff.map(member => {
              const todayRecord = attendance.filter(a => a.staffId === member.id)
                .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
              const present = todayRecord.find(a => a.date === today);
              return (
                <div key={member.id} className="flex items-center gap-4 p-3 bg-muted/20 rounded-xl">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ background: ROLE_COLORS[member.role] }}>
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {present ? (
                      <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Present {new Date(present.loginTime).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Not logged in
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[...Array(7)].map((_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (6 - i));
                      const dateStr = d.toISOString().split("T")[0];
                      const rec = todayRecord.find(a => a.date === dateStr);
                      return (
                        <div key={i} title={dateStr}
                          className={`w-3 h-3 rounded-sm ${rec ? "bg-green-500" : "bg-muted-foreground/20"}`} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WhatsApp notification info */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
        <Bell className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-800">WhatsApp Notifications</p>
          <p className="text-xs text-green-700 mt-1">
            Save staff WhatsApp numbers above. New order, low stock and delivery alerts will be sent automatically.
            For integration, set up WhatsApp Business API or Twilio.
          </p>
        </div>
      </div>
    </div>
  );
}
