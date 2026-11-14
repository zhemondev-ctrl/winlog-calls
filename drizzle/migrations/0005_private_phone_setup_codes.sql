CREATE TABLE public.phone_setup_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE,
 staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 issued_by uuid NOT NULL REFERENCES public.profiles(id),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_setup_codes TO authenticated;
GRANT ALL ON public.phone_setup_codes TO service_role;
ALTER TABLE public.phone_setup_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage phone setup codes" ON public.phone_setup_codes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.claim_phone_setup_code(_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE staff uuid;
BEGIN
 UPDATE public.phone_setup_codes SET used_at = now() WHERE token_hash = _hash AND used_at IS NULL AND expires_at > now() AND NOT public.has_role(staff_id, 'admin') RETURNING staff_id INTO staff;
 RETURN staff;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_phone_setup_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_phone_setup_code(text) TO service_role;