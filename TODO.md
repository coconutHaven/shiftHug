# shiftHug TODO

## High Priority Fixes

### 1. Fix Invoice Numbering Per Client

Invoice numbers should increment independently for each client.

Update logic in `src/hooks/useInvoices.ts`.

Old logic: SELECT invoice_number ORDER BY invoice_number DESC LIMIT 1

New logic: SELECT invoice_number WHERE client_id = ? ORDER BY
invoice_number DESC LIMIT 1

Example:

``` ts
const getNextInvoiceNumber = async (clientId: string): Promise<number> => {
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("client_id", clientId)
    .order("invoice_number", { ascending: false })
    .limit(1);

  return (data?.[0]?.invoice_number ?? 0) + 1;
};
```

Then update:

``` ts
const invoiceNumber = await getNextInvoiceNumber(invoice.client_id);
```

------------------------------------------------------------------------

### 2. Fix Invoice Publish Date Error

Supabase requires ISO date format.

Convert before inserting:

``` ts
const formattedDate = new Date(invoice.invoice_date)
  .toISOString()
  .split("T")[0];
```

Insert:

``` ts
invoice_date: formattedDate
```

------------------------------------------------------------------------

### 3. Allow Deleting Draft Invoices

Add mutation:

``` ts
const deleteDraft = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("status", "draft");

    if (error) throw error;
  },
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: ["invoices"] }),
});
```

UI condition:

    invoice.status === "draft"

------------------------------------------------------------------------

### 4. Reference Number Should Belong to Shift

Store reference number per shift.

Add column:

    invoice_shifts.reference_number

Insert when saving shift:

    reference_number: shift.reference_number

------------------------------------------------------------------------

### 5. Tooltip For Reference Numbers

Hover should show short description.

Example mapping:

``` ts
const referenceDescriptions = {
  "04_104_0125_6_1": "Community participation support",
  "04_102_0125_6_1": "Personal care support"
};
```

------------------------------------------------------------------------

### 6. Allow Multiple Rates Per Client

Create table:

    client_rates

Schema:

    id
    client_id
    rate_name
    hourly_rate
    reference_number

Example rows:

    Weekday | 47 | 04_104_0125_6_1
    Weekend | 55 | 04_104_0125_6_1
    Holiday | 70 | 04_104_0125_6_1

------------------------------------------------------------------------

### 7. Improve Weekly Shift Editing

Fields that should be editable:

-   day
-   hours
-   hourly_rate
-   mileage
-   mileage_rate
-   expenses
-   reference_number

Suggested table:

    weekly_shifts

Schema:

    id
    client_id
    day_of_week
    hours
    hourly_rate
    mileage
    mileage_rate
    expenses
    reference_number

------------------------------------------------------------------------

# Functional Testing Checklist

## Client Tests

-   Create client
-   Edit client
-   Delete client
-   Multiple rates per client

## Shift Tests

-   Create shift
-   Edit shift
-   Delete shift
-   Different rate types
-   Mileage
-   Expenses

## Invoice Tests

-   Create draft
-   Edit draft
-   Delete draft
-   Publish invoice
-   Download invoice

## Client Isolation Test

Expected:

Client A - Invoice 1 - Invoice 2

Client B - Invoice 1 - Invoice 2

## Date Tests

Test edge cases:

-   31 Jan
-   29 Feb
-   End of month
-   Different timezones

------------------------------------------------------------------------

# Security Checklist

## Enable Row Level Security

Enable RLS on:

-   clients
-   invoices
-   invoice_shifts
-   client_rates
-   weekly_shifts

SQL:

    ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

## Restrict Data By User

Policy example:

    CREATE POLICY "Users access own invoices"
    ON invoices
    FOR ALL
    USING (user_id = auth.uid());

## Validate Client Ownership

Always filter by user_id:

    .eq("user_id", user.id)

## Prevent Unauthorized Invoice Access

Bad:

    SELECT * FROM invoices WHERE id = ?

Good:

    SELECT * FROM invoices
    WHERE id = ?
    AND user_id = auth.uid()

## Protect Environment Variables

Never expose:

    SUPABASE_SERVICE_ROLE_KEY

Frontend should only use:

    SUPABASE_ANON_KEY

## Validate Numeric Inputs

Sanitize:

-   hours
-   rate
-   mileage
-   expenses

Ensure values \> 0.

## Lock Published Invoices

Once status = `published`, prevent editing.

------------------------------------------------------------------------

# Future Improvements

## Shift Timer

Start/End shift tracking.

## Automatic Hours Calculation

    hours = end_time - start_time

## Mileage Tracking

Automatic drive tracking.

## Weekly Auto Invoice

Generate invoices from logged shifts.

## NDIS Price Validation

Check rates against NDIS price guide.

------------------------------------------------------------------------

# Branding

Project name:

shiftHug

Positioning:

Invoice tool for independent support workers.
