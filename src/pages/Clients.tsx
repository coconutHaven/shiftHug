import { useState } from 'react';
import { useClients, useClientRates, useFixedShifts } from '@/hooks/useClients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Users, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ClientRatesSection({ clientId }: { clientId: string }) {
  const { rates, addRate, deleteRate } = useClientRates(clientId);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    if (!name || !amount) return;
    addRate.mutate({ client_id: clientId, rate_name: name, rate_amount: parseFloat(amount) });
    setName(''); setAmount('');
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Custom Rates</h4>
      {rates.map(r => (
        <div key={r.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
          <span className="text-sm">{r.rate_name}: ${r.rate_amount}/hr</span>
          <Button variant="ghost" size="icon" onClick={() => deleteRate.mutate(r.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input placeholder="Rate name" value={name} onChange={e => setName(e.target.value)} className="text-sm" />
        <Input type="number" placeholder="$/hr" value={amount} onChange={e => setAmount(e.target.value)} className="w-24 text-sm" />
        <Button size="sm" onClick={handleAdd}><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

function FixedShiftsSection({ clientId }: { clientId: string }) {
  const { shifts, addShift, deleteShift } = useFixedShifts(clientId);
  const [day, setDay] = useState('1');
  const [hours, setHours] = useState('');

  const handleAdd = () => {
    if (!hours) return;
    addShift.mutate({ client_id: clientId, day_of_week: parseInt(day), default_hours: parseFloat(hours), rate_id: null, rate_name: null, notes: null });
    setHours('');
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Fixed Weekly Shifts</h4>
      {shifts.map(s => (
        <div key={s.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
          <span className="text-sm">{DAY_NAMES[s.day_of_week]}: {s.default_hours}hrs</span>
          <Button variant="ghost" size="icon" onClick={() => deleteShift.mutate(s.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <select value={day} onChange={e => setDay(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <Input type="number" placeholder="Hours" value={hours} onChange={e => setHours(e.target.value)} className="w-24 text-sm" />
        <Button size="sm" onClick={handleAdd}><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { user } = useAuth();
  const { clients, isLoading, createClient, deleteClient } = useClients();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '',
    service_description: 'Assistance to Access Community and Social participation',
    ref_number: '04_104_0125_6_1',
    hourly_rate: '44.00', km_rate: '0.95',
  });

  const handleCreate = async () => {
    if (!form.name) { toast({ title: 'Please enter a name', variant: 'destructive' }); return; }
    try {
      await createClient.mutateAsync({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        service_description: form.service_description,
        ref_number: form.ref_number,
        hourly_rate: parseFloat(form.hourly_rate),
        km_rate: parseFloat(form.km_rate),
      });
      toast({ title: 'Client added! 🎉' });
      setDialogOpen(false);
      setForm({ name: '', email: '', phone: '', address: '', service_description: 'Assistance to Access Community and Social participation', ref_number: '04_104_0125_6_1', hourly_rate: '44.00', km_rate: '0.95' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Clients
          </h1>
          <p className="text-muted-foreground">Manage your NDIS clients and their rates</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">New Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              </div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div><Label>Service Description</Label><Input value={form.service_description} onChange={e => setForm({...form, service_description: e.target.value})} /></div>
              <div><Label>Reference Number</Label><Input value={form.ref_number} onChange={e => setForm({...form, ref_number: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Hourly Rate ($)</Label><Input type="number" step="0.01" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate: e.target.value})} /></div>
                <div><Label>KM Rate ($)</Label><Input type="number" step="0.01" value={form.km_rate} onChange={e => setForm({...form, km_rate: e.target.value})} /></div>
              </div>
              <Button onClick={handleCreate} className="w-full gradient-primary text-primary-foreground" disabled={createClient.isPending}>
                {createClient.isPending ? 'Creating...' : 'Create Client'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading clients...</div>
      ) : clients.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-heading font-bold text-lg text-foreground">No clients yet</h3>
            <p className="text-muted-foreground">Add your first client to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clients.map(client => (
            <Card key={client.id} className="shadow-card">
              <CardHeader className="cursor-pointer" onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-heading text-lg">{client.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      ${client.hourly_rate}/hr · ${client.km_rate}/km
                      {client.address && ` · ${client.address}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteClient.mutate(client.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    {expandedClient === client.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </CardHeader>
              {expandedClient === client.id && (
                <CardContent className="space-y-4 border-t border-border pt-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Service:</span> <span className="font-medium">{client.service_description}</span></div>
                    <div><span className="text-muted-foreground">Ref:</span> <span className="font-medium">{client.ref_number}</span></div>
                    {client.email && <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{client.email}</span></div>}
                    {client.phone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{client.phone}</span></div>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ClientRatesSection clientId={client.id} />
                    <FixedShiftsSection clientId={client.id} />
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
