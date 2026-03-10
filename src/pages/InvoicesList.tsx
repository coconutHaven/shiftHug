import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InvoicesList() {
  const { invoices, isLoading } = useInvoices();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Invoices
          </h1>
          <p className="text-muted-foreground">View and manage all your invoices</p>
        </div>
        <Link to="/invoices/new">
          <Button className="gradient-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> New Invoice
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : invoices.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-heading font-bold text-lg text-foreground">No invoices yet</h3>
            <p className="text-muted-foreground mb-4">Create your first invoice to get started!</p>
            <Link to="/invoices/new">
              <Button className="gradient-primary text-primary-foreground">Create Invoice</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <Link key={inv.id} to={`/invoices/${inv.id}`}>
              <Card className="shadow-card hover:shadow-elevated transition-all cursor-pointer group mb-3">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-foreground">
                        Invoice #{String(inv.invoice_number).padStart(3, '0')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {inv.clients?.name} · {inv.invoice_date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-foreground">${Number(inv.total_amount).toFixed(2)}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        inv.status === 'published' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>{inv.status}</span>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
