CREATE INDEX IF NOT EXISTS call_logs_created_idx ON public.call_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS call_logs_user_created_idx ON public.call_logs (user_id, created_at DESC);