-- Harden invoices RLS: ownership + client ownership + draft write rules
DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices;

CREATE POLICY "Users select own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own invoices for own clients"
  ON public.invoices FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users update own draft invoices"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft')
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'published')
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users delete own draft invoices"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- Harden invoice_shifts: writes only while parent invoice is draft
DROP POLICY IF EXISTS "Users manage own invoice shifts" ON public.invoice_shifts;

CREATE POLICY "Users select own invoice shifts"
  ON public.invoice_shifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert shifts on own drafts"
  ON public.invoice_shifts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid() AND i.status = 'draft'
    )
  );

CREATE POLICY "Users update shifts on own drafts"
  ON public.invoice_shifts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid() AND i.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid() AND i.status = 'draft'
    )
  );

CREATE POLICY "Users delete shifts on own drafts"
  ON public.invoice_shifts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid() AND i.status = 'draft'
    )
  );

-- Prevent duplicate invoice numbers per user+client
CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_client_number_uidx
  ON public.invoices (user_id, client_id, invoice_number);
