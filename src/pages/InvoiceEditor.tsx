import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClients, useFixedShifts, type ClientRate, type FixedShift } from '@/hooks/useClients';
import { useInvoices, InvoiceShift, Expense } from '@/hooks/useInvoices';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, CalendarIcon, FileText, CalendarRange, Sparkles, Info } from 'lucide-react';
import { format, eachDayOfInterval, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { parseShiftDateStr, sortShiftsByDate } from '@/lib/shiftDates';
import { calculateShift, invoiceLineTotal } from '@/lib/shiftCalculations';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DEFAULT_REFERENCE_DESCRIPTIONS,
  collectReferencePresets,
  type ReferencePreset,
} from '@/lib/referenceNumbers';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Fields copied when applying one shift's edits to matching shifts on the invoice or client template. */
const PROPAGATABLE_SHIFT_FIELDS = [
  'hours',
  'hourly_rate',
  'km',
  'km_rate',
  'rate_name',
  'reference_number',
  'reference_description',
] as const;

function shiftsMatchGroup(a: InvoiceShift, b: InvoiceShift): boolean {
  if (a.fixed_shift_id && b.fixed_shift_id) {
    return a.fixed_shift_id === b.fixed_shift_id;
  }
  return a.day_name === b.day_name && a.rate_name === b.rate_name;
}

function shiftPropagatableFieldsChanged(before: InvoiceShift, after: InvoiceShift): boolean {
  return PROPAGATABLE_SHIFT_FIELDS.some(field => before[field] !== after[field]);
}

function applyPropagatableFields(target: InvoiceShift, source: InvoiceShift): InvoiceShift {
  const next = { ...target };
  for (const field of PROPAGATABLE_SHIFT_FIELDS) {
    next[field] = source[field] ?? null;
  }
  return next;
}

function countMatchingSiblings(shifts: InvoiceShift[], index: number): number {
  const source = shifts[index];
  if (!source) return 0;
  return shifts.filter((s, i) => i !== index && shiftsMatchGroup(source, s)).length;
}

function withShiftDate(shift: InvoiceShift, date: Date): InvoiceShift {
  return {
    ...shift,
    shift_date: format(date, 'd/M'),
    day_name: DAY_NAMES[getDay(date)],
  };
}

/** Normalise fixed-shift expenses from API (array, JSON string, or missing). */
function normalizeShiftExpenses(raw: unknown): Expense[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object')
      .map(e => ({ name: String(e.name ?? ''), amount: Number(e.amount) || 0 }))
      .filter(e => e.name.length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return normalizeShiftExpenses(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function ShiftRow({ shift, index, onChange, onRemove, clientRates, previousRefs, template, onEditComplete }: {
  shift: InvoiceShift; index: number;
  onChange: (index: number, shift: InvoiceShift) => void;
  onRemove: (index: number) => void;
  clientRates: ClientRate[];
  previousRefs: ReferencePreset[];
  template?: FixedShift | null;
  onEditComplete?: (index: number, baseline: InvoiceShift, current: InvoiceShift) => void;
}) {
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const baselineRef = useRef<InvoiceShift | null>(null);

  const isFromTemplate = Boolean(shift.fixed_shift_id && template);
  const isCustom = !shift.fixed_shift_id;

  const update = (field: string, value: unknown) => {
    onChange(index, { ...shift, [field]: value });
  };

  const setReference = (number: string | null, description: string | null) => {
    onChange(index, { ...shift, reference_number: number, reference_description: description });
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

  const handleCardFocus = () => {
    if (!baselineRef.current) {
      baselineRef.current = { ...shift, expenses: [...shift.expenses] };
    }
  };

  const handleCardBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    const baseline = baselineRef.current;
    baselineRef.current = null;
    if (!baseline || !onEditComplete) return;
    if (shiftPropagatableFieldsChanged(baseline, shift)) {
      onEditComplete(index, baseline, shift);
    }
  };

  const descHint = shift.reference_description
    || (shift.reference_number ? DEFAULT_REFERENCE_DESCRIPTIONS[shift.reference_number] : undefined);

  return (
    <Card
      className="shadow-soft animate-fade-in"
      onFocusCapture={handleCardFocus}
      onBlurCapture={handleCardBlur}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">{shift.day_name}</span>
            {isFromTemplate && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Weekly template</span>
            )}
            <div>
              <Label className="text-xs">Shift date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('h-8 justify-start gap-2 font-normal text-sm', !shift.shift_date && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="w-4 h-4 shrink-0" />
                    {shift.shift_date || 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseShiftDateStr(shift.shift_date) ?? undefined}
                    onSelect={date => {
                      if (date) onChange(index, withShiftDate(shift, date));
                    }}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
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
                  reference_description: rate?.reference_description ?? shift.reference_description,
                });
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            >
              <option value="Standard">Standard</option>
              {clientRates.map(r => <option key={r.rate_name} value={r.rate_name}>{r.rate_name} (${r.rate_amount}/hr)</option>)}
            </select>
          </div>
        )}

        <div className="mt-2 space-y-2">
          {isCustom && previousRefs.length > 0 && (
            <div>
              <Label className="text-xs">Previously used</Label>
              <select
                value=""
                onChange={e => {
                  const preset = previousRefs[Number(e.target.value)];
                  if (!preset) return;
                  setReference(preset.reference_number || null, preset.reference_description || null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              >
                <option value="">Choose a previous reference…</option>
                {previousRefs.map((p, i) => (
                  <option key={`${p.reference_number}-${p.reference_description}-${i}`} value={i}>
                    {[p.reference_number, p.reference_description].filter(Boolean).join(' — ') || 'Untitled'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1">
              <Label className="text-xs">Reference Number</Label>
              {descHint && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{descHint}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Input
              value={shift.reference_number ?? ''}
              onChange={e => {
                const next = e.target.value || null;
                const known = next ? DEFAULT_REFERENCE_DESCRIPTIONS[next] : undefined;
                const nextDesc = shift.reference_description
                  || known
                  || null;
                onChange(index, { ...shift, reference_number: next, reference_description: nextDesc });
              }}
              placeholder="e.g. 04_104_0125_6_1"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={shift.reference_description ?? ''}
              onChange={e => update('reference_description', e.target.value || null)}
              placeholder="e.g. Community participation support"
              className="mt-1"
            />
          </div>
        </div>

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
                  <button type="button" onClick={() => removeExpense(i)} className="hover:text-destructive">×</button>
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

function mapInvoiceShiftsToEditor(shifts: InvoiceShift[]): InvoiceShift[] {
  return shifts.map(s => ({
    ...s,
    expenses: normalizeShiftExpenses(s.expenses as unknown),
  }));
}

export default function InvoiceEditor() {
  const navigate = useNavigate();
  const { id: editInvoiceId } = useParams<{ id: string }>();
  const isEditMode = Boolean(editInvoiceId);

  const { clients, isLoading: clientsLoading } = useClients();
  const { invoices, isLoading: invoicesLoading, createInvoice, updateDraftInvoice, publishInvoice, getNextInvoiceNumber } = useInvoices();
  const { toast } = useToast();

  const [clientId, setClientId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [shifts, setShifts] = useState<InvoiceShift[]>([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [customNumber, setCustomNumber] = useState<string>('');
  const prevClientIdRef = useRef<string | undefined>(undefined);
  const [weeklyDialogOpen, setWeeklyDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
  const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);
  const [editLoaded, setEditLoaded] = useState(!isEditMode);
  const [applyDialog, setApplyDialog] = useState<{
    index: number;
    edited: InvoiceShift;
    siblingCount: number;
    hasTemplate: boolean;
    templateDayName: string;
  } | null>(null);

  const draftInvoice = useMemo(
    () => (isEditMode ? invoices.find(i => i.id === editInvoiceId) : undefined),
    [isEditMode, editInvoiceId, invoices]
  );

  useEffect(() => {
    if (!isEditMode || !editInvoiceId || editLoaded) return;
    if (!draftInvoice) return;
    if (draftInvoice.status !== 'draft') {
      toast({ title: 'This invoice cannot be edited', variant: 'destructive' });
      navigate(`/invoices/${editInvoiceId}`);
      return;
    }
    const clientRow = clients.find(c => c.id === draftInvoice.client_id);
    if (!clientRow) {
      if (!clientsLoading) {
        toast({ title: 'Client not found for this invoice', variant: 'destructive' });
        navigate('/invoices');
      }
      return;
    }

    setClientId(draftInvoice.client_id);
    setInvoiceDate(draftInvoice.invoice_date?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'));
    const mapped = mapInvoiceShiftsToEditor(draftInvoice.invoice_shifts ?? []);
    setShifts(sortShiftsByDate(mapped).map(s => calculateShift(s)));
    setCustomNumber(String(draftInvoice.invoice_number));
    setEditLoaded(true);
  }, [isEditMode, editInvoiceId, editLoaded, draftInvoice, clients, clientsLoading, navigate, toast]);

  const selectedClient = clients.find(c => c.id === clientId);
  const clientRates = selectedClient?.client_rates ?? [];
  const { updateShift } = useFixedShifts(clientId);

  const previousRefs = useMemo(
    () => collectReferencePresets({
      clientRef: selectedClient?.ref_number,
      clientDescription: selectedClient?.service_description,
      rates: selectedClient?.client_rates,
      fixedShifts: selectedClient?.fixed_shifts,
      invoiceShifts: invoices
        .filter(inv => inv.client_id === clientId)
        .flatMap(inv => inv.invoice_shifts ?? []),
    }),
    [selectedClient, invoices, clientId]
  );

  useEffect(() => {
    if (isEditMode) return;
    if (prevClientIdRef.current !== clientId) {
      setCustomNumber('');
      prevClientIdRef.current = clientId;
    }
    if (clientId) {
      getNextInvoiceNumber(clientId).then(n => setNextNumber(n));
    } else {
      setNextNumber(1);
    }
  }, [clientId, isEditMode, getNextInvoiceNumber]);

  const recalcShifts = (newShifts: InvoiceShift[]) => {
    return sortShiftsByDate(newShifts).map(s => calculateShift(s));
  };

  const handleShiftChange = (index: number, shift: InvoiceShift) => {
    const updated = [...shifts];
    updated[index] = shift;
    setShifts(recalcShifts(updated));
  };

  const handleRemoveShift = (index: number) => {
    setShifts(recalcShifts(shifts.filter((_, i) => i !== index)));
  };

  const handleShiftEditComplete = (index: number, _baseline: InvoiceShift, current: InvoiceShift) => {
    const siblingCount = countMatchingSiblings(shifts, index);
    const template = selectedClient?.fixed_shifts?.find(fs => fs.id === current.fixed_shift_id);
    const hasTemplate = Boolean(current.fixed_shift_id && template);
    if (siblingCount === 0 && !hasTemplate) return;

    setApplyDialog({
      index,
      edited: current,
      siblingCount,
      hasTemplate,
      templateDayName: template != null ? FULL_DAY_NAMES[template.day_of_week] : current.day_name,
    });
  };

  const applyToMatchingOnInvoice = () => {
    if (!applyDialog) return;
    const { index, edited } = applyDialog;
    const source = shifts[index] ?? edited;
    const updated = shifts.map((s, i) => {
      if (i === index) return s;
      if (shiftsMatchGroup(source, s)) {
        return applyPropagatableFields(s, edited);
      }
      return s;
    });
    setShifts(recalcShifts(updated));
    setApplyDialog(null);
    toast({
      title: 'Invoice shifts updated',
      description: `Applied changes to ${applyDialog.siblingCount} matching shift${applyDialog.siblingCount !== 1 ? 's' : ''} on this invoice.`,
    });
  };

  const applyToClientTemplate = () => {
    if (!applyDialog) return;
    const { edited } = applyDialog;
    if (!edited.fixed_shift_id) return;
    updateShift.mutate({
      id: edited.fixed_shift_id,
      reference_number: edited.reference_number ?? null,
      reference_description: edited.reference_description ?? null,
      default_hours: edited.hours,
      hourly_rate: edited.hourly_rate,
      mileage: edited.km,
      mileage_rate: edited.km_rate,
      rate_name: edited.rate_name,
    });
    setApplyDialog(null);
    toast({
      title: 'Weekly template updated',
      description: 'Future invoices generated from this client profile will use these values.',
    });
  };

  const addCustomShift = () => {
    if (!selectedClient) { toast({ title: 'Select a client first', variant: 'destructive' }); return; }
    const today = new Date();
    const newShift: InvoiceShift = {
      shift_date: format(today, 'd/M'),
      day_name: DAY_NAMES[today.getDay()],
      hours: 0, hourly_rate: selectedClient.hourly_rate, rate_name: 'Standard',
      reference_number: selectedClient.ref_number ?? null,
      reference_description: selectedClient.service_description ?? null,
      fixed_shift_id: null,
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
        const shiftRefDesc = fs.reference_description
          ?? rate?.reference_description
          ?? selectedClient.service_description
          ?? (shiftRefNum ? DEFAULT_REFERENCE_DESCRIPTIONS[shiftRefNum] : null)
          ?? null;
        const fixedExpenses = normalizeShiftExpenses(fs.expenses as unknown);
        newShifts.push({
          shift_date: format(day, 'd/M'),
          day_name: DAY_NAMES[dayOfWeek],
          hours: fs.default_hours,
          hourly_rate: shiftHourlyRate,
          rate_name: fs.rate_name || 'Standard',
          reference_number: shiftRefNum,
          reference_description: shiftRefDesc,
          fixed_shift_id: fs.id,
          km: fs.mileage ?? 0,
          km_rate: fs.mileage_rate ?? selectedClient.km_rate,
          expenses: fixedExpenses,
          expenses_total: 0,
          shift_total: 0,
          invoice_hours: 0,
          invoice_rate: selectedClient.hourly_rate,
          invoice_amount: 0,
          sort_order: shifts.length + newShifts.length,
        });
      });
    });

    setShifts(recalcShifts([...shifts, ...newShifts]));
    setWeeklyDialogOpen(false);
    setStartDate(undefined);
    setEndDate(undefined);
    toast({ title: `Added ${newShifts.length} shift${newShifts.length !== 1 ? 's' : ''}` });
  };

  const totalAmount = invoiceLineTotal(shifts);

  const parsedInvoiceNumberOverride = (): number | undefined => {
    const t = customNumber.trim();
    if (t === '') return undefined;
    const n = parseInt(t, 10);
    if (Number.isNaN(n) || n < 1) return undefined;
    return n;
  };

  const handleSaveNew = async (publish: boolean) => {
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
      const override = parsedInvoiceNumberOverride();
      if (override != null) payload.invoice_number = override;
      const result = await createInvoice.mutateAsync(payload);
      toast({ title: publish ? 'Invoice published' : 'Draft saved' });
      if (publish) await publishInvoice.mutateAsync(result.id);
      navigate(`/invoices/${result.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleSaveEdit = async (publish: boolean) => {
    if (!editInvoiceId || !clientId || shifts.length === 0) {
      toast({ title: 'Add at least one shift', variant: 'destructive' });
      return;
    }
    try {
      const draftPayload: {
        id: string;
        invoice_date: string;
        shifts: InvoiceShift[];
        invoice_number?: number;
      } = {
        id: editInvoiceId,
        invoice_date: invoiceDate,
        shifts,
      };
      const override = parsedInvoiceNumberOverride();
      if (override != null) draftPayload.invoice_number = override;
      await updateDraftInvoice.mutateAsync(draftPayload);
      if (publish) await publishInvoice.mutateAsync(editInvoiceId);
      toast({ title: publish ? 'Invoice published' : 'Draft updated' });
      navigate(`/invoices/${editInvoiceId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  if (isEditMode && invoicesLoading) {
    return <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">Loading draft…</div>;
  }
  if (isEditMode && editInvoiceId && !draftInvoice) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="outline" onClick={() => navigate('/invoices')}>Back to Invoices</Button>
      </div>
    );
  }
  if (isEditMode && !editLoaded) {
    return <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">Loading draft…</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          {isEditMode ? `Edit draft #${String(draftInvoice?.invoice_number ?? 0).padStart(3, '0')}` : 'New Invoice'}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode ? 'Update line items, then save or publish.' : `Today: ${format(new Date(), 'dd/MM/yyyy')}`}
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId} disabled={isEditMode}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {isEditMode && <p className="text-xs text-muted-foreground mt-1">Client is fixed for this invoice.</p>}
            </div>
            <div>
              <Label>Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <Label>Invoice #</Label>
              <Input
                type="number"
                min={1}
                value={customNumber}
                onChange={e => setCustomNumber(e.target.value)}
                placeholder={isEditMode ? undefined : String(nextNumber)}
              />
              {!isEditMode && (
                <p className="text-xs text-muted-foreground mt-1">Next auto: {nextNumber}. Leave blank to use that number.</p>
              )}
              {isEditMode && (
                <p className="text-xs text-muted-foreground mt-1">Change the number if needed, then save.</p>
              )}
            </div>
          </div>
          {selectedClient && (
            <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>Base rate: ${selectedClient.hourly_rate}/hr</span>
              <span>KM: ${selectedClient.km_rate}/km</span>
              <span>Ref: {selectedClient.ref_number}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Dialog
          open={weeklyDialogOpen}
          onOpenChange={open => {
            setWeeklyDialogOpen(open);
            if (!open) {
              setStartDatePopoverOpen(false);
              setEndDatePopoverOpen(false);
            }
          }}
        >
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
            <p className="text-sm text-muted-foreground">
              Choose a date range. Shifts copy from {selectedClient?.name}&apos;s weekly template, including fixed expenses.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Popover open={startDatePopoverOpen} onOpenChange={setStartDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left', !startDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 w-4 h-4" />
                      {startDate ? format(startDate, 'PPP') : 'Pick start'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={date => {
                        setStartDate(date);
                        if (date) setStartDatePopoverOpen(false);
                      }}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>End Date</Label>
                <Popover open={endDatePopoverOpen} onOpenChange={setEndDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left', !endDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 w-4 h-4" />
                      {endDate ? format(endDate, 'PPP') : 'Pick end'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={date => {
                        setEndDate(date);
                        if (date) setEndDatePopoverOpen(false);
                      }}
                      className="pointer-events-auto"
                    />
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

      <div className="space-y-3">
        {shifts.map((shift, i) => (
          <ShiftRow
            key={shift.id ?? `row-${i}`}
            shift={shift}
            index={i}
            onChange={handleShiftChange}
            onRemove={handleRemoveShift}
            clientRates={clientRates}
            previousRefs={previousRefs}
            template={selectedClient?.fixed_shifts?.find(fs => fs.id === shift.fixed_shift_id) ?? null}
            onEditComplete={handleShiftEditComplete}
          />
        ))}
      </div>

      <AlertDialog open={applyDialog != null} onOpenChange={open => { if (!open) setApplyDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply changes to matching shifts?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  You edited a {applyDialog?.templateDayName ?? 'weekly'} shift
                  {applyDialog?.hasTemplate ? ' from this client\'s weekly template' : ''}.
                </p>
                {applyDialog && applyDialog.siblingCount > 0 && (
                  <p>
                    {applyDialog.siblingCount} other matching shift{applyDialog.siblingCount !== 1 ? 's' : ''} on this invoice
                    can be updated with the same hours, rates, mileage, and reference details.
                  </p>
                )}
                {applyDialog?.hasTemplate && (
                  <p>
                    You can also save these values to the client&apos;s weekly shift profile for future invoices.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogCancel className="mt-0">This shift only</AlertDialogCancel>
            {applyDialog && applyDialog.siblingCount > 0 && (
              <AlertDialogAction onClick={applyToMatchingOnInvoice}>
                All matching on this invoice ({applyDialog.siblingCount})
              </AlertDialogAction>
            )}
            {applyDialog?.hasTemplate && (
              <AlertDialogAction onClick={applyToClientTemplate}>
                Update client weekly template
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {shifts.length > 0 && (
        <>
          <Card className="shadow-elevated gradient-hero">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Total</p>
                <p className="text-3xl font-bold font-heading text-foreground">${totalAmount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Labour only (hours × rate). Add travel/expenses optionally when generating the invoice PDF.</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</p>
                <p>{shifts.reduce((sum, s) => sum + s.invoice_hours, 0).toFixed(2)} total hours</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3 justify-end">
            {isEditMode ? (
              <>
                <Button variant="outline" onClick={() => navigate(`/invoices/${editInvoiceId}`)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSaveEdit(false)}
                  disabled={updateDraftInvoice.isPending || publishInvoice.isPending}
                >
                  Save draft
                </Button>
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={() => handleSaveEdit(true)}
                  disabled={updateDraftInvoice.isPending || publishInvoice.isPending}
                >
                  Save &amp; Publish
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleSaveNew(false)} disabled={createInvoice.isPending}>
                  Save as Draft
                </Button>
                <Button className="gradient-primary text-primary-foreground" onClick={() => handleSaveNew(true)} disabled={createInvoice.isPending}>
                  Save &amp; Publish
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
