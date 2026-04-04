import { useParams, useNavigate } from 'react-router-dom';
import { useInvoices, InvoiceShift, Expense } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useUserSettings } from '@/hooks/useUserSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, CheckCircle, ArrowLeft, Trash2, Info, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const REFERENCE_DESCRIPTIONS: Record<string, string> = {
  '04_104_0125_6_1': 'Assistance with Personal Activities',
  '04_102_0125_6_1': 'Personal Care Support',
  '04_104_0115_6_1': 'Assistance with Personal Activities (High)',
  '04_210_0125_6_1': 'Assistance with Personal Activities — Standard — Weeknight',
  '04_104_0125_6_3': 'Assistance with Personal Activities — Standard — Saturday',
  '04_104_0125_6_4': 'Assistance with Personal Activities — Standard — Sunday',
  '04_104_0125_6_5': 'Assistance with Personal Activities — Standard — Public Holiday',
  '04_103_0125_6_1': 'Assistance with Personal Activities — High — Weekday',
  '04_399_0125_6_1': 'House and/or Yard Maintenance',
  '01_011_0107_1_3': 'Daily Activities — Standard — Saturday',
  '04_104_0125_6_2': 'Assistance with Personal Activities — Evening',
  '04_210_0125_6_3': 'Assistance with Personal Activities — Evening — Saturday',
};

const PDF_BRAND: [number, number, number] = [230, 126, 34];
const PDF_MUTED_ROW: [number, number, number] = [248, 248, 248];

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

function pdfPartyTable(
  doc: jsPDF,
  title: string,
  rows: [string, string][],
  startY: number
): number {
  const body = rows.filter(([, v]) => v != null && String(v).trim() !== '');
  if (body.length === 0) body.push(['—', '—']);
  autoTable(doc, {
    startY,
    head: [[{ content: title, colSpan: 2, styles: { fillColor: PDF_BRAND, textColor: 255, fontStyle: 'bold', halign: 'left' } }]],
    body,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
    headStyles: { fillColor: PDF_BRAND },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold', fillColor: PDF_MUTED_ROW, textColor: [55, 55, 55] },
      1: { cellWidth: 130 },
    },
    margin: { left: 14, right: 14 },
  });
  return ((doc as DocWithTable).lastAutoTable?.finalY ?? startY) + 10;
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices, publishInvoice, deleteDraft } = useInvoices();
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

  const handleDelete = async () => {
    if (!confirm('Delete this draft invoice? This cannot be undone.')) return;
    try {
      await deleteDraft.mutateAsync(invoice.id);
      toast({ title: 'Draft deleted' });
      navigate('/invoices');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const generateCalculationsPDF = () => {
    const doc = new jsPDF();
    let y = 14;

    doc.setFontSize(18);
    doc.setTextColor(45, 45, 45);
    doc.text('SupportMate', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Calculations — Invoice #${String(invoice.invoice_number).padStart(3, '0')}`, 14, y);
    y += 12;

    y = pdfPartyTable(doc, 'Service provider', [
      ['Name', settings?.display_name ?? ''],
      ['Email', settings?.email ?? ''],
      ['Phone', settings?.phone ?? ''],
      ['ABN', settings?.abn ?? ''],
      ['BSB', settings?.bsb ?? ''],
      ['Account', settings?.account_number ?? ''],
    ], y);

    y = pdfPartyTable(doc, 'Bill to (participant)', [
      ['Name', client?.name ?? ''],
      ['Email', client?.email ?? ''],
      ['Phone', client?.phone ?? ''],
      ['Address', client?.address ?? ''],
    ], y);

    autoTable(doc, {
      startY: y,
      head: [[{ content: 'Invoice details', colSpan: 2, styles: { fillColor: PDF_BRAND, textColor: 255, fontStyle: 'bold' } }]],
      body: [
        ['Invoice #', String(invoice.invoice_number).padStart(3, '0')],
        ['Invoice date', invoice.invoice_date],
        ['Service', client?.service_description ?? '—'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold', fillColor: PDF_MUTED_ROW },
        1: { cellWidth: 130 },
      },
      margin: { left: 14, right: 14 },
    });
    y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 12;

    const tableData = shifts.map(s => {
      const rateLabel = s.rate_name && s.rate_name !== 'Standard' ? `${s.rate_name} · ` : '';
      const hoursStr = `${rateLabel}${s.hours}h @ $${s.hourly_rate}/hr = $${(s.hours * s.hourly_rate).toFixed(2)}`;
      const kmStr = s.km > 0 ? `${s.km} km @ $${s.km_rate}/km = $${(s.km * s.km_rate).toFixed(2)}` : '—';
      const expStr = s.expenses.length
        ? s.expenses.map((e: Expense) => `${e.name}: $${e.amount.toFixed(2)}`).join('; ')
        : '—';
      return [s.day_name, s.shift_date, hoursStr, kmStr, expStr, `$${s.shift_total.toFixed(2)}`];
    });

    tableData.push(['TOTAL', '', '', '', '', `$${shifts.reduce((s, sh) => s + sh.shift_total, 0).toFixed(2)}`]);

    autoTable(doc, {
      head: [['Day', 'Date', 'Hours & rate', 'Mileage', 'Expenses', 'Amount']],
      body: tableData,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2.5, valign: 'top' },
      headStyles: { fillColor: PDF_BRAND, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 22 },
        2: { cellWidth: 52 },
        3: { cellWidth: 38 },
        4: { cellWidth: 38 },
        5: { cellWidth: 22, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`Invoice_${String(invoice.invoice_number).padStart(3, '0')}_Calculations.pdf`);
  };

  const generateInvoicePDF = () => {
    const doc = new jsPDF();
    let y = 14;

    doc.setFontSize(18);
    doc.setTextColor(45, 45, 45);
    doc.text('SupportMate', 14, y);
    y += 8;
    doc.setFontSize(14);
    doc.text('Invoice', 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`#${String(invoice.invoice_number).padStart(3, '0')} · ${invoice.invoice_date}`, 14, y);
    y += 14;

    y = pdfPartyTable(doc, 'From (service provider)', [
      ['Name', settings?.display_name ?? ''],
      ['Email', settings?.email ?? ''],
      ['Phone', settings?.phone ?? ''],
      ['ABN', settings?.abn ?? ''],
      ['BSB', settings?.bsb ?? ''],
      ['Account no.', settings?.account_number ?? ''],
    ], y);

    y = pdfPartyTable(doc, 'To (participant)', [
      ['Name', client?.name ?? ''],
      ['Address', client?.address ?? ''],
      ['Email', client?.email ?? ''],
      ['Phone', client?.phone ?? ''],
    ], y);

    autoTable(doc, {
      startY: y,
      head: [[{ content: 'Service', colSpan: 2, styles: { fillColor: PDF_BRAND, textColor: 255, fontStyle: 'bold' } }]],
      body: [['Description', client?.service_description ?? '—']],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold', fillColor: PDF_MUTED_ROW },
        1: { cellWidth: 130 },
      },
      margin: { left: 14, right: 14 },
    });
    y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 12;

    const tableData = shifts.map(s => [
      s.shift_date,
      client?.service_description ?? '',
      s.reference_number || client?.ref_number || '',
      s.rate_name || 'Standard',
      s.invoice_hours.toFixed(2),
      `$${s.invoice_rate}`,
      `$${s.invoice_amount.toFixed(2)}`,
    ]);

    tableData.push(['Total', '', '', '', '', '', `$${Number(invoice.total_amount).toFixed(2)}`]);

    autoTable(doc, {
      head: [['Date', 'Description', 'Ref #', 'Rate', 'Hrs', '$/Hr', 'Amount']],
      body: tableData,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: PDF_BRAND, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 42 },
        2: { cellWidth: 32 },
        3: { cellWidth: 24 },
        4: { halign: 'right', cellWidth: 16 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`Invoice_${String(invoice.invoice_number).padStart(3, '0')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/invoices')} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Invoices
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Invoice #{String(invoice.invoice_number).padStart(3, '0')}
          </h1>
          <p className="text-muted-foreground">{client?.name} · {invoice.invoice_date}</p>
        </div>
        <span className={`self-start px-3 py-1 rounded-full text-sm font-medium ${
          invoice.status === 'published' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
        }`}>{invoice.status}</span>
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="font-heading">Calculations Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground">Day</th>
                  <th className="text-left py-2 text-muted-foreground">Date</th>
                  <th className="text-left py-2 text-muted-foreground">Rate</th>
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
                    <td>{s.rate_name && s.rate_name !== 'Standard' ? <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">{s.rate_name}</span> : 'Standard'} <span className="text-muted-foreground text-xs">${s.hourly_rate}/hr</span></td>
                    <td>{s.hours}H = ${(s.hours * s.hourly_rate).toFixed(2)}</td>
                    <td>{s.km > 0 ? `${s.km}km = $${(s.km * s.km_rate).toFixed(2)}` : '-'}</td>
                    <td>{s.expenses.length > 0 ? s.expenses.map((e: Expense) => `${e.name} $${e.amount.toFixed(2)}`).join(', ') : '-'}</td>
                    <td className="text-right font-medium">${s.shift_total.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={6} className="py-2">TOTAL</td>
                  <td className="text-right">${shifts.reduce((sum, s) => sum + s.shift_total, 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
                  <th className="text-left py-2 text-muted-foreground">Rate</th>
                  <th className="text-right py-2 text-muted-foreground">Hrs</th>
                  <th className="text-right py-2 text-muted-foreground">$/Hr</th>
                  <th className="text-right py-2 text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s, i) => {
                  const refNum = s.reference_number || client?.ref_number;
                  const refDesc = refNum ? REFERENCE_DESCRIPTIONS[refNum] : undefined;
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2">{s.shift_date}</td>
                      <td>{client?.service_description}</td>
                      <td>
                        {refNum ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 cursor-default">
                                  {refNum}
                                  {refDesc && <Info className="w-3 h-3 text-muted-foreground" />}
                                </span>
                              </TooltipTrigger>
                              {refDesc && <TooltipContent><p>{refDesc}</p></TooltipContent>}
                            </Tooltip>
                          </TooltipProvider>
                        ) : '-'}
                      </td>
                      <td>{s.rate_name || 'Standard'}</td>
                      <td className="text-right">{s.invoice_hours.toFixed(2)}</td>
                      <td className="text-right">${s.invoice_rate}</td>
                      <td className="text-right font-medium">${s.invoice_amount.toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold">
                  <td colSpan={6} className="py-2">Total</td>
                  <td className="text-right">${Number(invoice.total_amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        {invoice.status === 'draft' && (
          <>
            <Button
              variant="secondary"
              className="gap-2 order-first sm:order-none"
              onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
            >
              <Pencil className="w-4 h-4" /> Edit draft
            </Button>
            <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleteDraft.isPending}>
              <Trash2 className="w-4 h-4" /> Delete Draft
            </Button>
            <Button onClick={handlePublish} className="gap-2 gradient-primary text-primary-foreground" disabled={publishInvoice.isPending}>
              <CheckCircle className="w-4 h-4" /> Publish
            </Button>
          </>
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
