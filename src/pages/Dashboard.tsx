import { useClients } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { useUserSettings } from '@/hooks/useUserSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, Plus, TrendingUp, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const { settings } = useUserSettings();

  const publishedInvoices = invoices.filter(i => i.status === 'published');
  const draftInvoices = invoices.filter(i => i.status === 'draft');
  const totalRevenue = publishedInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0);

  const displayName = settings?.display_name;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="gradient-hero rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold font-heading text-foreground">
            Welcome back{displayName ? `, ${displayName}` : ''}!
          </h1>
        </div>
        <p className="text-muted-foreground font-body">Here's your invoicing overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clients</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading">{clients.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published Invoices</CardTitle>
            <FileText className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading">{publishedInvoices.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
            <FileText className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading">{draftInvoices.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/invoices/new">
          <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                <Plus className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground">New Invoice</h3>
                <p className="text-sm text-muted-foreground">Create a new invoice for a client</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/clients">
          <Card className="shadow-card hover:shadow-elevated transition-shadow cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground">Manage Clients</h3>
                <p className="text-sm text-muted-foreground">Add or edit client details & rates</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {invoices.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-heading">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices.slice(0, 5).map((inv) => (
                <Link key={inv.id} to={`/invoices/${inv.id}`} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium text-foreground">Invoice #{String(inv.invoice_number).padStart(3, '0')}</span>
                        <span className="text-sm text-muted-foreground ml-2">{inv.clients?.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground">${Number(inv.total_amount).toFixed(2)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        inv.status === 'published' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
