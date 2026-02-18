-- Allow admins to update any profile row.
-- Without this, the admin's JWT is scoped only to their own profile (auth.uid() = id),
-- so updating a client's full_name / role silently touches 0 rows and returns no error.
-- This pattern matches every other admin-writable table in the codebase.

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);
