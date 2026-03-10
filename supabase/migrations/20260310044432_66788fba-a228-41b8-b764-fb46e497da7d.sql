
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  service_description TEXT DEFAULT 'Assistance to Access Community and Social participation',
  ref_number TEXT DEFAULT '04_104_0125_6_1',
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 44.00,
  km_rate NUMERIC(10,2) NOT NULL DEFAULT 0.95,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client custom rates (e.g. afternoon, weekend, transport)
CREATE TABLE public.client_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rate_name TEXT NOT NULL,
  rate_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed shift templates per client (recurring weekly schedule)
CREATE TABLE public.fixed_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  default_hours NUMERIC(5,2) NOT NULL,
  rate_id UUID REFERENCES public.client_rates(id) ON DELETE SET NULL,
  rate_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_number INTEGER NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice line items (shifts)
CREATE TABLE public.invoice_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  day_name TEXT,
  hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate_name TEXT,
  km NUMERIC(7,2) NOT NULL DEFAULT 0,
  km_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  expenses JSONB DEFAULT '[]'::jsonb,
  expenses_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  shift_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  invoice_hours NUMERIC(7,2) NOT NULL DEFAULT 0,
  invoice_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  invoice_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User settings (color scheme, personal info for invoices)
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  abn TEXT,
  bsb TEXT,
  account_number TEXT,
  color_scheme TEXT DEFAULT 'warm-sunset',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Users manage own clients" ON public.clients FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS for client_rates (via client ownership)
CREATE POLICY "Users manage own client rates" ON public.client_rates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_rates.client_id AND clients.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_rates.client_id AND clients.user_id = auth.uid())
);

-- RLS for fixed_shifts (via client ownership)
CREATE POLICY "Users manage own fixed shifts" ON public.fixed_shifts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE clients.id = fixed_shifts.client_id AND clients.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients WHERE clients.id = fixed_shifts.client_id AND clients.user_id = auth.uid())
);

-- RLS for invoices
CREATE POLICY "Users manage own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS for invoice_shifts (via invoice ownership)
CREATE POLICY "Users manage own invoice shifts" ON public.invoice_shifts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_shifts.invoice_id AND invoices.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_shifts.invoice_id AND invoices.user_id = auth.uid())
);

-- RLS for user_settings
CREATE POLICY "Users manage own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoice_shifts_invoice_id ON public.invoice_shifts(invoice_id);
CREATE INDEX idx_fixed_shifts_client_id ON public.fixed_shifts(client_id);
