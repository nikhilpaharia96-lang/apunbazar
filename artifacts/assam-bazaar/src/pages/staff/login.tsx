import { useState } from "react";
import { useLocation } from "wouter";
import { staffLogin } from "@/lib/staff-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Users, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StaffLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { toast({ title: "Required", variant: "destructive" }); return; }
    setLoading(true);
    const result = await staffLogin(email, password);
    setLoading(false);
    if (!result.ok) { toast({ title: result.error, variant: "destructive" }); return; }
    toast({ title: `Welcome, ${result.member.name}!` });
    navigate("/staff/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">Staff Portal</h1>
          <p className="text-gray-400 text-sm mt-1">ApunBazar Team Login</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Email</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="your@email.com" type="email" className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Password</label>
            <div className="relative">
              <Input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} type={showPass ? "text" : "password"} placeholder="password" className="bg-gray-800 border-gray-700 text-white pr-10" />
              <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <Button onClick={handleLogin} disabled={loading} className="w-full gap-2">{loading ? "Logging in..." : <><Shield className="h-4 w-4" /> Login to Staff Portal</>}</Button>
        </div>
        <p className="text-center text-xs text-gray-500">Contact your administrator for credentials.</p>
      </div>
    </div>
  );
}
