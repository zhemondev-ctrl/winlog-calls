-- Manager AI assistant: separate conversations saved to the manager's account.
CREATE TABLE public.assistant_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_threads TO authenticated;
GRANT ALL ON public.assistant_threads TO service_role;
ALTER TABLE public.assistant_threads ENABLE ROW LEVEL SECURITY;
CREATE INDEX assistant_threads_user_updated ON public.assistant_threads (user_id, updated_at DESC);

CREATE POLICY "Managers read own threads" ON public.assistant_threads FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers create own threads" ON public.assistant_threads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers update own threads" ON public.assistant_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers delete own threads" ON public.assistant_threads FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.assistant_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  ui_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, ui_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX assistant_messages_thread_created ON public.assistant_messages (thread_id, created_at);

CREATE POLICY "Managers read own messages" ON public.assistant_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers add own messages" ON public.assistant_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND public.has_role(auth.uid(), 'admin')
    AND EXISTS (SELECT 1 FROM public.assistant_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Managers update own messages" ON public.assistant_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers delete own messages" ON public.assistant_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- Background uploads: each phone holds a long-lived upload key; only its hash is stored here.
CREATE TABLE public.device_upload_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  device_id text NOT NULL,
  device_name text,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (user_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_upload_tokens TO authenticated;
GRANT ALL ON public.device_upload_tokens TO service_role;
ALTER TABLE public.device_upload_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own device keys or admin reads all" ON public.device_upload_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Create own device keys" ON public.device_upload_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Replace own device keys" ON public.device_upload_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Remove own device keys" ON public.device_upload_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());