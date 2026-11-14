CREATE TABLE public.daily_digests (
  day date PRIMARY KEY,
  summary text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.daily_digests TO authenticated;
GRANT ALL ON public.daily_digests TO service_role;
ALTER TABLE public.daily_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read digests" ON public.daily_digests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers write digests" ON public.daily_digests FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers update digests" ON public.daily_digests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));