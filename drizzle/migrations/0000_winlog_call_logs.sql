CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Read own profile or admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Read own roles or admin reads all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  device_id text NOT NULL,
  device_name text,
  source text NOT NULL CHECK (source IN ('sim', 'whatsapp')),
  external_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing', 'missed', 'rejected', 'blocked', 'unknown')),
  phone_number text,
  contact_name text,
  started_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  is_video boolean NOT NULL DEFAULT false,
  sim_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id, source, external_id)
);
CREATE INDEX call_logs_user_started_idx ON public.call_logs (user_id, started_at DESC);
CREATE INDEX call_logs_started_idx ON public.call_logs (started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_logs TO authenticated;
GRANT ALL ON public.call_logs TO service_role;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own calls or admin reads all" ON public.call_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own calls" ON public.call_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own calls" ON public.call_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins delete calls" ON public.call_logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- New sign-ups get a profile; the very first account becomes the company admin (manager).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1)));

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();