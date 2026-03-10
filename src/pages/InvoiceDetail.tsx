import { useParams, useNavigate } from 'react-router-dom';
import { useInvoices, InvoiceShift, Expense } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useUserSettings } from '@/hooks/useUserSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices, publishInvoice } = useInvoices();
  const { clients } = useClients();
  const { settings } = useUserSettings();
  const { toast } = useToast();

  const invoice = invoices.find(i => i.id === id);
  const client = invoice ? clients.find(c => c.id === invoice.client_id) : null;

  if (!invoice) return <div className="text-center py-12 text-muted-foreground">Loading invoice...</div>;

  const shifts: InvoiceShift[] = (invoice.invoice_shifts ?? []).map(s => ({
    ...s,
    expenses: (typeof s.expenses === 'string' ? JSON.parse(s.expenses) : s.expenses ?? []) as Expense[],
  })).sort((a, b) => a.sort_order - b.sort_order);

  const handlePublish = async () => {
    await publishInvoice.mutateAsync(invoice.id);
    toast({ title: 'Invoice published! 🎉' });
  };

  const generateCalculationsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Invoice #${String(invoice.invoice_number).padStart(3, '0')} — Calculations`, 14, 20);

    const tableData = shifts.map(s => {
      const hoursStr = `${s.hours}H - $${(s.hours * s.hourly_rate).toFixed(2)}`;
      const kmStr = s.km > 0 ? `$${(s.km * s.km_rate).toFixed(2)}` : '';
      const expStr = s.expenses.map((e: Expense) => `${e.name} - $${e.amount.toFixed(2)}`).join('\n');
      return [s.day_name, s.shift_date, hoursStr, kmStr, expStr, `$${s.shift_total.toFixed(2)}`];
    });

    tableData.push(['TOTAL', '', '', '', '', `$${shifts.reduce((s, sh) => s + sh.shift_total, 0).toFixed(2)}`]);

    autoTable(doc, {
      head: [['Day', 'Date', `Hours ($${client?.hourly_rate ?? 44}/H)`, `Mileage ($${client?.km_rate ?? 0.95}/km)`, 'Additional Fees', 'Amount']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [230, 126, 34] },
    });

    doc.save(`Invoice_${String(invoice.invoice_number).padStart(3, '0')}_Calculations.pdf`);
  };

  const generateInvoicePDF = () => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(10);
    doc.text('Invoice from', 14, y); y += 6;
    doc.text(`Name: ${settings?.display_name ?? ''}`, 14, y); y += 5;
    doc.text(`Email: ${settings?.email ?? ''}`, 14, y); y += 5;
    doc.text(`Ph: ${settings?.phone ?? ''}`, 14, y); y += 5;
    doc.text(`ABN: ${settings?.abn ?? ''}`, 14, y); y += 5;
    doc.text(`BSB: ${settings?.bsb ?? ''}`, 14, y); y += 5;
    doc.text(`Account No: ${settings?.account_number ?? ''}`, 14, y); y += 10;

    doc.text('To:', 14, y); y += 5;
    doc.text(client?.name ?? '', 14, y); y += 5;
    if (client?.address) { doc.text(client.address, 14, y); y += 5; }
    y += 5;

    doc.text(`For: ${client?.service_description ?? ''}`, 14, y); y += 7;
    doc.text(`Invoice #: ${String(invoice.invoice_number).padStart(3, '0')}`, 14, y); y += 5;
    doc.text(`Invoice date: ${invoice.invoice_date}`, 14, y); y += 10;

    const tableData = shifts.map(s => [
      s.shift_date,
      client?.service_description ?? '',
      client?.ref_number ?? '',
      s.invoice_hours.toFixed(2),
      `$${s.invoice_rate}`,
      `$${s.invoice_amount.toFixed(2)}`,
    ]);

    tableData.push(['Total', '', '', '', '', `$${Number(invoice.total_amount).toFixed(2)}`]);

    autoTable(doc, {
      head: [['Date', 'Description', 'Ref #', 'Hrs', 'Rate', 'Amount']],
      body: tableData,
      startY: y,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [230, 126, 34] },
    });

    doc.save(`Invoice_${String(invoice.invoice_number).padStart(3, '0')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/invoices')} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Invoices
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Invoice #{String(invoice.invoice_number).padStart(3, '0')}
          </h1>
          <p className="text-muted-foreground">{client?.name} · {invoice.invoice_date}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          invoice.status === 'published' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
        }`}>{invoice.status}</span>
      </div>

      {/* Calculations Preview */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-heading">Calculations Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground">Day</th>
                  <th className="text-left py-2 text-muted-foreground">Date</th>
                  <th className="text-left py-2 text-muted-foreground">Hours</th>
                  <th className="text-left py-2 text-muted-foreground">Mileage</th>
                  <th className="text-left py-2 text-muted-foreground">Expenses</th>
                  <th className="text-right py-2 text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2">{s.day_name}</td>
                    <td>{s.shift_date}</td>
                    <td>{s.hours}H - ${(s.hours * s.hourly_rate).toFixed(2)}</td>
                    <td>{s.km > 0 ? `$${(s.km * s.km_rate).toFixed(2)}` : '-'}</td>
                    <td>{s.expenses.length > 0 ? s.expenses.map((e: Expense) => `${e.name} $${e.amount.toFixed(2)}`).join(', ') : '-'}</td>
                    <td className="text-right font-medium">${s.shift_total.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={5} className="py-2">TOTAL</td>
                  <td className="text-right">${shifts.reduce((sum, s) => sum + s.shift_total, 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Preview */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-heading">Invoice</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground">Date</th>
                  <th className="text-left py-2 text-muted-foreground">Description</th>
                  <th className="text-left py-2 text-muted-foreground">Ref #</th>
                  <th className="text-right py-2 text-muted-foreground">Hrs</th>
                  <th className="text-right py-2 text-muted-foreground">Rate</th>
                  <th className="text-right py-2 text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2">{s.shift_date}</td>
                    <td>{client?.service_description}</td>
                    <td>{client?.ref_number}</td>
                    <td className="text-right">{s.invoice_hours.toFixed(2)}</td>
                    <td className="text-right">${s.invoice_rate}</td>
                    <td className="text-right font-medium">${s.invoice_amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={5} className="py-2">Total</td>
                  <td className="text-right">${Number(invoice.total_amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        {invoice.status === 'draft' && (
          <Button onClick={handlePublish} className="gap-2 gradient-primary text-primary-foreground">
            <CheckCircle className="w-4 h-4" /> Publish
          </Button>
        )}
        <Button variant="outline" className="gap-2" onClick={generateCalculationsPDF}>
          <Download className="w-4 h-4" /> Calculations PDF
        </Button>
        <Button variant="outline" className="gap-2" onClick={generateInvoicePDF}>
          <Download className="w-4 h-4" /> Invoice PDF
        </Button>
      </div>
    </div>
  );
}
