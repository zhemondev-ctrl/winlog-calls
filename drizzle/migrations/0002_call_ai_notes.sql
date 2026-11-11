CREATE TABLE public.call_ai_notes (
  call_id uuid PRIMARY KEY REFERENCES public.call_logs(id) ON DELETE CASCADE,
  note text NOT NULL,
  follow_up boolean NOT NULL DEFAULT false,
  contact_last_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.call_ai_notes TO authenticated;
GRANT ALL ON public.call_ai_notes TO service_role;

ALTER TABLE public.call_ai_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers read call notes" ON public.call_ai_notes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers add call notes" ON public.call_ai_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers refresh call notes" ON public.call_ai_notes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));