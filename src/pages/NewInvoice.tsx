import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { useInvoices, InvoiceShift, Expense } from '@/hooks/useInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, CalendarIcon, FileText, CalendarRange, Sparkles, Info } from 'lucide-react';
import { format, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function calculateShift(shift: InvoiceShift, clientHourlyRate: number): InvoiceShift {
  const hoursAmount = shift.hours * shift.hourly_rate;
  const kmAmount = shift.km * shift.km_rate;
  const expensesTotal = shift.expenses.reduce((sum, e) => sum + e.amount, 0);
  const shiftTotal = hoursAmount + kmAmount + expensesTotal;
  // Invoice: total / hourly_rate, rounded to nearest hundredth
  const invoiceRate = clientHourlyRate;
  const invoiceHours = Math.round((shiftTotal / invoiceRate) * 100) / 100;
  const invoiceAmount = Math.round(invoiceHours * invoiceRate * 100) / 100;

  return { ...shift, expenses_total: expensesTotal, shift_total: shiftTotal, invoice_hours: invoiceHours, invoice_rate: invoiceRate, invoice_amount: invoiceAmount };
}

function ShiftRow({ shift, index, onChange, onRemove, clientRates }: {
  shift: InvoiceShift; index: number;
  onChange: (index: number, shift: InvoiceShift) => void;
  onRemove: (index: number) => void;
  clientRates: { rate_name: string; rate_amount: number; reference_number?: string | null }[];
}) {
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');

  const update = (field: string, value: any) => {
    onChange(index, { ...shift, [field]: value });
  };

  const addExpense = () => {
    if (!newExpName || !newExpAmount) return;
    const newExp: Expense = { name: newExpName, amount: parseFloat(newExpAmount) };
    onChange(index, { ...shift, expenses: [...shift.expenses, newExp] });
    setNewExpName(''); setNewExpAmount('');
  };

  const removeExpense = (i: number) => {
    onChange(index, { ...shift, expenses: shift.expenses.filter((_, idx) => idx !== i) });
  };

  return (
    <Card className="shadow-soft animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">{shift.day_name}</span>
            <span className="text-sm font-medium text-foreground">{shift.shift_date}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onRemove(index)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Hours</Label>
            <Input type="number" step="0.5" value={shift.hours || ''} onChange={e => update('hours', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">Rate ($/hr)</Label>
            <Input type="number" step="0.01" value={shift.hourly_rate || ''} onChange={e => update('hourly_rate', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">Kilometres</Label>
            <Input type="number" step="0.1" value={shift.km || ''} onChange={e => update('km', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">KM Rate ($/km)</Label>
            <Input type="number" step="0.01" value={shift.km_rate || ''} onChange={e => update('km_rate', parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        {clientRates.length > 0 && (
          <div className="mt-2">
            <Label className="text-xs">Rate Type</Label>
            <select
              value={shift.rate_name}
              onChange={e => {
                const rate = clientRates.find(r => r.rate_name === e.target.value);
                onChange(index, {
                  ...shift,
                  rate_name: e.target.value,
                  hourly_rate: rate?.rate_amount || shift.hourly_rate,
                  reference_number: rate?.reference_number ?? shift.reference_number,
                });
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            >
              <option value="Standard">Standard</option>
              {clientRates.map(r => <option key={r.rate_name} value={r.rate_name}>{r.rate_name} (${r.rate_amount}/hr)</option>)}
            </select>
          </div>
        )}

        <div className="mt-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs">Reference Number</Label>
            {shift.reference_number && REFERENCE_DESCRIPTIONS[shift.reference_number] && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{REFERENCE_DESCRIPTIONS[shift.reference_number]}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Input
            value={shift.reference_number ?? ''}
            onChange={e => update('reference_number', e.target.value || null)}
            placeholder="e.g. 04_104_0125_6_1"
            className="mt-1"
          />
        </div>

        {/* Expenses */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Expenses ({shift.expenses.length})</Label>
            <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle className="font-heading">Add Expense</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Description</Label><Input value={newExpName} onChange={e => setNewExpName(e.target.value)} placeholder="e.g. Lunch, Parking" /></div>
                  <div><Label>Amount ($)</Label><Input type="number" step="0.01" value={newExpAmount} onChange={e => setNewExpAmount(e.target.value)} /></div>
                  <Button onClick={() => { addExpense(); setExpenseDialog(false); }} className="w-full">Add Expense</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {shift.expenses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {shift.expenses.map((exp, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                  {exp.name}: ${exp.amount.toFixed(2)}
                  <button onClick={() => removeExpense(i)} className="hover:text-destructive">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
          <span className="text-muted-foreground">Shift Total</span>
          <span className="font-bold text-foreground">${shift.shift_total.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NewInvoice() {
  const navigate = useNavigate();
  const { clients } = useClients();
  const { createInvoice, getNextInvoiceNumber } = useInvoices();
  const { toast } = useToast();
  const [clientId, setClientId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [shifts, setShifts] = useState<InvoiceShift[]>([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [customNumber, setCustomNumber] = useState<string>('');
  const [weeklyDialogOpen, setWeeklyDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const selectedClient = clients.find(c => c.id === clientId);
  const clientRates = selectedClient?.client_rates ?? [];

  useEffect(() => {
    if (clientId) {
      getNextInvoiceNumber(clientId).then(n => {
        setNextNumber(n);
        setCustomNumber('');
      });
    } else {
      setNextNumber(1);
      setCustomNumber('');
    }
  }, [clientId]);

  const effectiveNumber = customNumber ? parseInt(customNumber) : nextNumber;

  const recalcShifts = (newShifts: InvoiceShift[]) => {
    if (!selectedClient) return newShifts;
    return newShifts.map(s => calculateShift(s, selectedClient.hourly_rate));
  };

  const handleShiftChange = (index: number, shift: InvoiceShift) => {
    const updated = [...shifts];
    updated[index] = shift;
    setShifts(recalcShifts(updated));
  };

  const handleRemoveShift = (index: number) => {
    setShifts(recalcShifts(shifts.filter((_, i) => i !== index)));
  };

  const addCustomShift = () => {
    if (!selectedClient) { toast({ title: 'Select a client first', variant: 'destructive' }); return; }
    const today = new Date();
    const newShift: InvoiceShift = {
      shift_date: format(today, 'd/M'),
      day_name: DAY_NAMES[today.getDay()],
      hours: 0, hourly_rate: selectedClient.hourly_rate, rate_name: 'Standard',
      reference_number: selectedClient.ref_number ?? null,
      km: 0, km_rate: selectedClient.km_rate,
      expenses: [], expenses_total: 0, shift_total: 0,
      invoice_hours: 0, invoice_rate: selectedClient.hourly_rate, invoice_amount: 0, sort_order: shifts.length,
    };
    setShifts(recalcShifts([...shifts, newShift]));
  };

  const addWeeklyShifts = () => {
    if (!selectedClient || !startDate || !endDate) return;
    const fixedShifts = selectedClient.fixed_shifts ?? [];
    if (fixedShifts.length === 0) {
      toast({ title: 'No fixed shifts set up', description: 'Add fixed shifts to this client first.', variant: 'destructive' });
      return;
    }

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const newShifts: InvoiceShift[] = [];

    days.forEach(day => {
      const dayOfWeek = getDay(day);
      const matching = fixedShifts.filter(fs => fs.day_of_week === dayOfWeek);
      matching.forEach(fs => {
        const rate = fs.rate_name && clientRates.find(r => r.rate_name === fs.rate_name);
        const shiftHourlyRate = fs.hourly_rate ?? (rate ? rate.rate_amount : selectedClient.hourly_rate);
        const shiftRefNum = fs.reference_number ?? (rate?.reference_number ?? selectedClient.ref_number ?? null);
        const fixedExpenses: Expense[] = (fs.expenses ?? []).map((e: any) => ({ name: e.name, amount: e.amount }));
        newShifts.push({
          shift_date: format(day, 'd/M'),
          day_name: DAY_NAMES[dayOfWeek],
          hours: fs.default_hours,
          hourly_rate: shiftHourlyRate,
          rate_name: fs.rate_name || 'Standard',
          reference_number: shiftRefNum,
          km: fs.mileage ?? 0,
          km_rate: fs.mileage_rate ?? selectedClient.km_rate,
          expenses: fixedExpenses, expenses_total: 0, shift_total: 0,
          invoice_hours: 0, invoice_rate: selectedClient.hourly_rate, invoice_amount: 0,
          sort_order: shifts.length + newShifts.length,
        });
      });
    });

    setShifts(recalcShifts([...shifts, ...newShifts]));
    setWeeklyDialogOpen(false);
    setStartDate(undefined);
    setEndDate(undefined);
    toast({ title: `Added ${newShifts.length} shifts! ✨` });
  };

  const totalAmount = shifts.reduce((sum, s) => sum + s.invoice_amount, 0);

  const handleSave = async (publish: boolean = false) => {
    if (!clientId || shifts.length === 0) {
      toast({ title: 'Add at least one shift', variant: 'destructive' });
      return;
    }
    try {
      const payload: { client_id: string; invoice_date: string; shifts: InvoiceShift[]; invoice_number?: number } = {
        client_id: clientId,
        invoice_date: invoiceDate,
        shifts,
      };
      if (customNumber) payload.invoice_number = parseInt(customNumber);
      const result = await createInvoice.mutateAsync(payload);
      toast({ title: publish ? 'Invoice published! 🎉' : 'Invoice saved as draft 📝' });
      navigate(`/invoices/${result.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          New Invoice
        </h1>
        <p className="text-muted-foreground">Date: {format(new Date(), 'dd/MM/yyyy')}</p>
      </div>

      {/* Client Selection */}
      <Card className="shadow-card">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <Label>Invoice #</Label>
              <Input
                type="number"
                value={customNumber}
                onChange={e => setCustomNumber(e.target.value)}
                placeholder={String(nextNumber)}
              />
              <p className="text-xs text-muted-foreground mt-1">Next: {nextNumber}. Override if needed.</p>
            </div>
          </div>
          {selectedClient && (
            <div className="text-sm text-muted-foreground flex gap-4">
              <span>Rate: ${selectedClient.hourly_rate}/hr</span>
              <span>KM: ${selectedClient.km_rate}/km</span>
              <span>Ref: {selectedClient.ref_number}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shift Actions */}
      <div className="flex gap-3">
        <Dialog open={weeklyDialogOpen} onOpenChange={setWeeklyDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="gap-2" disabled={!clientId}>
              <CalendarRange className="w-4 h-4" /> Add Fixed Shifts
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Add Fixed Shifts
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Select a date range and we'll auto-fill shifts based on {selectedClient?.name}'s fixed schedule.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 w-4 h-4" />
                      {startDate ? format(startDate, 'PPP') : 'Pick start'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 w-4 h-4" />
                      {endDate ? format(endDate, 'PPP') : 'Pick end'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button onClick={addWeeklyShifts} className="w-full gradient-primary text-primary-foreground" disabled={!startDate || !endDate}>
              Generate Shifts
            </Button>
          </DialogContent>
        </Dialog>

        <Button variant="outline" className="gap-2" onClick={addCustomShift} disabled={!clientId}>
          <Plus className="w-4 h-4" /> Add Custom Shift
        </Button>
      </div>

      {/* Shift List */}
      <div className="space-y-3">
        {shifts.map((shift, i) => (
          <ShiftRow
            key={i}
            shift={shift}
            index={i}
            onChange={handleShiftChange}
            onRemove={handleRemoveShift}
            clientRates={clientRates}
          />
        ))}
      </div>

      {shifts.length > 0 && (
        <>
          {/* Total */}
          <Card className="shadow-elevated gradient-hero">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Total</p>
                <p className="text-3xl font-bold font-heading text-foreground">${totalAmount.toFixed(2)}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</p>
                <p>{shifts.reduce((sum, s) => sum + s.invoice_hours, 0).toFixed(2)} total hours</p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={createInvoice.isPending}>
              Save as Draft
            </Button>
            <Button className="gradient-primary text-primary-foreground" onClick={() => handleSave(true)} disabled={createInvoice.isPending}>
              Save & Publish
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
