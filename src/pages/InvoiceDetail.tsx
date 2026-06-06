import { useParams, useNavigate } from 'react-router-dom';
import { useInvoices, InvoiceShift, Expense } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import type { Client } from '@/hooks/useClients';
import { useUserSettings } from '@/hooks/useUserSettings';
import type { UserSettings } from '@/hooks/useUserSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, CheckCircle, ArrowLeft, Trash2, Info, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sortShiftsByDate } from '@/lib/shiftDates';

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

const APP_NAME = 'shiftHug';

/** Ocean Breeze–aligned PDF palette (teal / slate, print-friendly) */
const Pdf = {
  primary: [22, 101, 120] as [number, number, number],
  primaryDark: [15, 76, 92] as [number, number, number],
  accentSoft: [232, 246, 249] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  stripe: [248, 250, 252] as [number, number, number],
};

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

const PDF_MARGIN = 14;

function pdfInnerWidthMm(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
}

function addPdfBrandHeader(doc: jsPDF, titleRight: string, rightLines: string[]): number {
  const pageW = doc.internal.pageSize.getWidth();
  const m = PDF_MARGIN;
  doc.setFillColor(...Pdf.primary);
  doc.rect(0, 0, pageW, 3.5, 'F');
  const y0 = 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...Pdf.primaryDark);
  doc.text(APP_NAME, m, y0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...Pdf.muted);
  doc.text('NDIS support invoicing', m, y0 + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...Pdf.text);
  doc.text(titleRight, pageW - m, y0, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...Pdf.muted);
  let ry = y0 + 5;
  for (const line of rightLines) {
    doc.text(line, pageW - m, ry, { align: 'right' });
    ry += 4;
  }
  const headerBottom = Math.max(y0 + 12, ry + 2);
  doc.setDrawColor(...Pdf.border);
  doc.setLineWidth(0.15);
  doc.line(m, headerBottom, pageW - m, headerBottom);
  return headerBottom + 6;
}

function addPdfFooter(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...Pdf.muted);
  doc.text(`Generated in ${APP_NAME}.`, PDF_MARGIN, pageH - 8);
}

function providerPartyText(settings: UserSettings | null | undefined): string {
  const lines = [
    settings?.display_name,
    settings?.email,
    settings?.phone ? `${settings.phone}` : '',
    settings?.abn ? `ABN: ${settings.abn}` : '',
    settings?.bsb ? `BSB: ${settings.bsb}` : '',
    settings?.account_number ? `Account number: ${settings.account_number}` : '',
  ].filter((v): v is string => Boolean(v && String(v).trim()));
  return lines.length ? lines.join('\n') : '—';
}

function clientPartyText(client: Client | null | undefined): string {
  const lines = [
    client?.name,
    client?.address,
    client?.email,
    client?.phone ? `${client.phone}` : '',
  ].filter((v): v is string => Boolean(v && String(v).trim()));
  return lines.length ? lines.join('\n') : '—';
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

  const shifts: InvoiceShift[] = sortShiftsByDate(
    (invoice.invoice_shifts ?? []).map(s => ({
      ...s,
      expenses: (typeof s.expenses === 'string' ? JSON.parse(s.expenses) : s.expenses ?? []) as Expense[],
    }))
  );

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
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const invNo = String(invoice.invoice_number).padStart(3, '0');
    let y = addPdfBrandHeader(doc, 'SUPPORTING CALCULATIONS', [
      `Invoice no. ${invNo}`,
      `Date issued ${invoice.invoice_date}`,
    ]);

    const innerW = pdfInnerWidthMm(doc);
    autoTable(doc, {
      startY: y,
      tableWidth: innerW,
      head: [['FROM', 'BILL TO']],
      body: [[providerPartyText(settings), clientPartyText(client)]],
      headStyles: {
        fillColor: Pdf.accentSoft,
        textColor: Pdf.primaryDark,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'left',
      },
      bodyStyles: { fontSize: 9, textColor: Pdf.text, valign: 'top', minCellHeight: 24 },
      styles: { lineColor: Pdf.border, lineWidth: 0.1, cellPadding: 3.5 },
      columnStyles: { 0: { cellWidth: innerW / 2 }, 1: { cellWidth: innerW / 2 } },
      theme: 'plain',
      margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    });
    y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...Pdf.muted);
    doc.text('Description of support', PDF_MARGIN, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...Pdf.text);
    const calcDescLines = doc.splitTextToSize(client?.service_description ?? '—', innerW);
    doc.text(calcDescLines, PDF_MARGIN, y);
    y += calcDescLines.length * 4.2 + 8;

    const tableData = shifts.map(s => {
      const rateLabel = s.rate_name && s.rate_name !== 'Standard' ? `${s.rate_name} · ` : '';
      const hoursStr = `${rateLabel}${s.hours}h @ $${s.hourly_rate}/hr = $${(s.hours * s.hourly_rate).toFixed(2)}`;
      const kmStr = s.km > 0 ? `${s.km} km @ $${s.km_rate}/km = $${(s.km * s.km_rate).toFixed(2)}` : '—';
      const expStr = s.expenses.length
        ? s.expenses.map((e: Expense) => `${e.name}: $${e.amount.toFixed(2)}`).join('; ')
        : '—';
      return [s.day_name, s.shift_date, hoursStr, kmStr, expStr, `$${s.shift_total.toFixed(2)}`];
    });
    const calcGrand = shifts.reduce((s, sh) => s + sh.shift_total, 0);
    tableData.push(['TOTAL', '', '', '', '', `$${calcGrand.toFixed(2)}`]);
    const calcBodyRows = tableData.length;

    const k0 = 18;
    const k1 = 24;
    const k3 = 28;
    const k4 = 34;
    const k5 = 22;
    const k2 = innerW - k0 - k1 - k3 - k4 - k5;

    autoTable(doc, {
      tableWidth: innerW,
      head: [['Day', 'Date', 'Hours & rate', 'Travel', 'Expenses', 'Amount (AUD)']],
      body: tableData,
      startY: y,
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'top',
        lineColor: Pdf.border,
        lineWidth: 0.1,
        overflow: 'linebreak',
      },
      headStyles: { fillColor: Pdf.primaryDark, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: k0 },
        1: { cellWidth: k1 },
        2: { cellWidth: k2 },
        3: { cellWidth: k3 },
        4: { cellWidth: k4 },
        5: { cellWidth: k5, halign: 'right' },
      },
      margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      didParseCell: data => {
        if (data.section === 'body' && data.row.index === calcBodyRows - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [...Pdf.accentSoft];
          data.cell.styles.textColor = [...Pdf.primaryDark];
        } else if (data.section === 'body' && data.row.index % 2 === 1) {
          data.cell.styles.fillColor = [...Pdf.stripe];
        }
      },
    });
    y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 8;

    addPdfFooter(doc);
    doc.save(`Invoice_${invNo}_Calculations.pdf`);
  };

  const generateInvoicePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const invNo = String(invoice.invoice_number).padStart(3, '0');
    const innerW = pdfInnerWidthMm(doc);
    let y = addPdfBrandHeader(doc, 'INVOICE', [`Invoice no. ${invNo}`, `Date issued ${invoice.invoice_date}`]);
    autoTable(doc, {
      startY: y,
      tableWidth: innerW,
      head: [['FROM', 'BILL TO']],
      body: [[providerPartyText(settings), clientPartyText(client)]],
      headStyles: {
        fillColor: Pdf.accentSoft,
        textColor: Pdf.primaryDark,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'left',
      },
      bodyStyles: { fontSize: 9, textColor: Pdf.text, valign: 'top', minCellHeight: 24 },
      styles: { lineColor: Pdf.border, lineWidth: 0.1, cellPadding: 3.5 },
      columnStyles: { 0: { cellWidth: innerW / 2 }, 1: { cellWidth: innerW / 2 } },
      theme: 'plain',
      margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    });
    y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...Pdf.muted);
    doc.text('Description of support', PDF_MARGIN, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...Pdf.text);
    const descLines = doc.splitTextToSize(client?.service_description ?? '—', innerW);
    doc.text(descLines, PDF_MARGIN, y);
    y += descLines.length * 4.2 + 8;

    const tableData = shifts.map(s => [
      s.shift_date,
      client?.service_description ?? '',
      s.reference_number || client?.ref_number || '',
      s.invoice_hours.toFixed(2),
      `$${s.invoice_rate}`,
      `$${s.invoice_amount.toFixed(2)}`,
    ]);
    tableData.push(['Total', '', '', '', '', `$${Number(invoice.total_amount).toFixed(2)}`]);
    const invBodyRows = tableData.length;

    // Six columns; description uses remaining width so the table matches page margins.
    const c0 = 22;
    const c2 = 34;
    const c3 = 14;
    const c4 = 18;
    const c5 = 24;
    const c1 = innerW - c0 - c2 - c3 - c4 - c5;

    autoTable(doc, {
      tableWidth: innerW,
      head: [['Date', 'Description', 'Support item / ref.', 'Hours', 'Rate', 'Amount (AUD)']],
      body: tableData,
      startY: y,
      styles: { fontSize: 7.5, cellPadding: 2, lineColor: Pdf.border, lineWidth: 0.1, overflow: 'linebreak' },
      headStyles: { fillColor: Pdf.primaryDark, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: c0 },
        1: { cellWidth: c1 },
        2: { cellWidth: c2 },
        3: { halign: 'right', cellWidth: c3 },
        4: { halign: 'right', cellWidth: c4 },
        5: { halign: 'right', cellWidth: c5 },
      },
      margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      didParseCell: data => {
        if (data.section === 'body' && data.row.index === invBodyRows - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [...Pdf.accentSoft];
          data.cell.styles.textColor = [...Pdf.primaryDark];
        } else if (data.section === 'body' && data.row.index % 2 === 1) {
          data.cell.styles.fillColor = [...Pdf.stripe];
        }
      },
    });
    y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 8;

    addPdfFooter(doc);
    doc.save(`Invoice_${invNo}.pdf`);
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
