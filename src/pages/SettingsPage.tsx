import { useState, useEffect } from 'react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { settings, isLoading, upsertSettings } = useUserSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({
    display_name: '', email: '', phone: '', abn: '', bsb: '', account_number: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        display_name: settings.display_name ?? '',
        email: settings.email ?? '',
        phone: settings.phone ?? '',
        abn: settings.abn ?? '',
        bsb: settings.bsb ?? '',
        account_number: settings.account_number ?? '',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await upsertSettings.mutateAsync(form);
      toast({ title: 'Settings saved! ✅' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground">Your personal details for invoices</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} placeholder="Your full name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+61 xxx xxx xxx" />
            </div>
          </div>
          <div>
            <Label>ABN</Label>
            <Input value={form.abn} onChange={e => setForm({...form, abn: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>BSB</Label>
              <Input value={form.bsb} onChange={e => setForm({...form, bsb: e.target.value})} placeholder="082-186" />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})} />
            </div>
          </div>
          <Button onClick={handleSave} className="gradient-primary text-primary-foreground gap-2" disabled={upsertSettings.isPending}>
            <Save className="w-4 h-4" /> Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
