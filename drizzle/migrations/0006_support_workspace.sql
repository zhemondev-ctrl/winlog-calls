CREATE TABLE public.support_teams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, created_by uuid NOT NULL REFERENCES public.profiles(id), settings jsonb NOT NULL DEFAULT '{"categories":["General","Sales","Billing","Technical"],"sla_hours":{"urgent":4,"high":12,"normal":24,"low":72},"ai_enabled":true}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.support_teams TO authenticated; GRANT ALL ON public.support_teams TO service_role;
ALTER TABLE public.support_teams ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.support_members (team_id uuid NOT NULL REFERENCES public.support_teams(id), user_id uuid NOT NULL REFERENCES public.profiles(id), role text NOT NULL CHECK(role IN ('admin','manager','agent','viewer')), display_name text NOT NULL, PRIMARY KEY(team_id,user_id));
GRANT SELECT ON public.support_members TO authenticated; GRANT ALL ON public.support_members TO service_role;
ALTER TABLE public.support_members ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.support_role(_team uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT role FROM public.support_members WHERE team_id=_team AND user_id=auth.uid() $$;
REVOKE ALL ON FUNCTION public.support_role(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.support_role(uuid) TO authenticated;
CREATE POLICY "Team members read workspace" ON public.support_teams FOR SELECT TO authenticated USING(public.support_role(id) IS NOT NULL);
CREATE POLICY "Team members read roster" ON public.support_members FOR SELECT TO authenticated USING(public.support_role(team_id) IS NOT NULL);
CREATE TABLE public.support_customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.support_teams(id), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), user_id uuid REFERENCES public.profiles(id), phone_last4 text NOT NULL DEFAULT '', communication_preference text NOT NULL DEFAULT 'in_app' CHECK(communication_preference IN ('in_app','none')), consent boolean NOT NULL DEFAULT false, notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(team_id,id), UNIQUE(team_id,user_id));
GRANT SELECT ON public.support_customers TO authenticated; GRANT ALL ON public.support_customers TO service_role;
ALTER TABLE public.support_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team or customer reads profile" ON public.support_customers FOR SELECT TO authenticated USING(public.support_role(team_id) IS NOT NULL OR user_id=auth.uid());
CREATE TABLE public.support_customer_contacts (customer_id uuid PRIMARY KEY REFERENCES public.support_customers(id), team_id uuid NOT NULL REFERENCES public.support_teams(id), phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', FOREIGN KEY(team_id,customer_id) REFERENCES public.support_customers(team_id,id));
CREATE UNIQUE INDEX support_contact_dedupe ON public.support_customer_contacts(team_id,phone) WHERE phone<>'';
GRANT SELECT ON public.support_customer_contacts TO authenticated; GRANT ALL ON public.support_customer_contacts TO service_role;
ALTER TABLE public.support_customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Non-viewer team reads contact" ON public.support_customer_contacts FOR SELECT TO authenticated USING(public.support_role(team_id) IN ('admin','manager','agent'));
CREATE TABLE public.support_tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.support_teams(id), customer_id uuid, call_id uuid REFERENCES public.call_logs(id), subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 200), description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','open','pending','escalated','resolved')), priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')), channel text NOT NULL DEFAULT 'manual' CHECK(channel IN ('manual','call','web_chat')), category text NOT NULL DEFAULT 'General', tags text[] NOT NULL DEFAULT '{}', assignee_id uuid, request_key uuid NOT NULL, sla_due_at timestamptz NOT NULL, first_response_at timestamptz, resolved_at timestamptz, reopen_count integer NOT NULL DEFAULT 0 CHECK(reopen_count>=0), merged_into uuid, created_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), revision integer NOT NULL DEFAULT 1, UNIQUE(team_id,id), UNIQUE(team_id,request_key), FOREIGN KEY(team_id,customer_id) REFERENCES public.support_customers(team_id,id), FOREIGN KEY(team_id,assignee_id) REFERENCES public.support_members(team_id,user_id), FOREIGN KEY(team_id,merged_into) REFERENCES public.support_tickets(team_id,id));
CREATE UNIQUE INDEX support_one_active_call_case ON public.support_tickets(team_id,call_id) WHERE call_id IS NOT NULL AND merged_into IS NULL AND status<>'resolved';
CREATE INDEX support_inbox_idx ON public.support_tickets(team_id,status,created_at DESC); CREATE INDEX support_assignee_idx ON public.support_tickets(team_id,assignee_id,sla_due_at); CREATE INDEX support_customer_idx ON public.support_tickets(team_id,customer_id);
GRANT SELECT ON public.support_tickets TO authenticated; GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team or linked customer reads case" ON public.support_tickets FOR SELECT TO authenticated USING(public.support_role(team_id) IS NOT NULL OR EXISTS(SELECT 1 FROM public.support_customers c WHERE c.id=customer_id AND c.user_id=auth.uid()));
CREATE TABLE public.support_ai_drafts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.support_teams(id), ticket_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('summary','reply','follow_up','next_action')), body text NOT NULL, citations jsonb NOT NULL DEFAULT '[]', mode text NOT NULL CHECK(mode IN ('live','mock')), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','used')), created_by uuid NOT NULL DEFAULT auth.uid(), approved_by uuid, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(team_id,id), FOREIGN KEY(team_id,ticket_id) REFERENCES public.support_tickets(team_id,id));
GRANT SELECT, INSERT ON public.support_ai_drafts TO authenticated; GRANT ALL ON public.support_ai_drafts TO service_role;
ALTER TABLE public.support_ai_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read AI drafts" ON public.support_ai_drafts FOR SELECT TO authenticated USING(public.support_role(team_id) IN ('admin','manager','agent'));
CREATE POLICY "Operators save only unapproved own drafts" ON public.support_ai_drafts FOR INSERT TO authenticated WITH CHECK(public.support_role(team_id) IN ('admin','manager','agent') AND created_by=auth.uid() AND status='draft' AND approved_by IS NULL AND approved_at IS NULL);
CREATE TABLE public.support_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.support_teams(id), ticket_id uuid NOT NULL, author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 10000), visibility text NOT NULL CHECK(visibility IN ('internal','customer')), delivery_state text NOT NULL DEFAULT 'stored' CHECK(delivery_state IN ('stored','read')), request_key uuid NOT NULL, ai_draft_id uuid, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(team_id,ticket_id) REFERENCES public.support_tickets(team_id,id), FOREIGN KEY(team_id,ai_draft_id) REFERENCES public.support_ai_drafts(team_id,id), UNIQUE(team_id,request_key));
GRANT SELECT ON public.support_messages TO authenticated; GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX support_message_idx ON public.support_messages(team_id,ticket_id,created_at);
CREATE POLICY "Team reads messages; customer reads public only" ON public.support_messages FOR SELECT TO authenticated USING(public.support_role(team_id) IS NOT NULL OR (visibility='customer' AND EXISTS(SELECT 1 FROM public.support_tickets t JOIN public.support_customers c ON c.id=t.customer_id WHERE t.id=ticket_id AND c.user_id=auth.uid())));
CREATE TABLE public.support_articles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.support_teams(id), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 30000), category text NOT NULL DEFAULT 'General', state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published')), source_url text NOT NULL DEFAULT '' CHECK(source_url='' OR source_url ~ '^https://'), version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL DEFAULT auth.uid(), UNIQUE(team_id,id));
GRANT SELECT ON public.support_articles TO authenticated; GRANT ALL ON public.support_articles TO service_role;
ALTER TABLE public.support_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team reads approved articles or operator drafts" ON public.support_articles FOR SELECT TO authenticated USING(public.support_role(team_id) IS NOT NULL AND (state='published' OR public.support_role(team_id) IN ('admin','manager','agent')));
CREATE TABLE public.support_article_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.support_teams(id), article_id uuid NOT NULL, version integer NOT NULL, title text NOT NULL, body text NOT NULL, state text NOT NULL, source_url text NOT NULL, author_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(team_id,article_id) REFERENCES public.support_articles(team_id,id), UNIQUE(article_id,version));
GRANT SELECT ON public.support_article_versions TO authenticated; GRANT ALL ON public.support_article_versions TO service_role;
ALTER TABLE public.support_article_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read article history" ON public.support_article_versions FOR SELECT TO authenticated USING(public.support_role(team_id) IN ('admin','manager','agent'));
CREATE TABLE public.support_attachments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.support_teams(id), ticket_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160), mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','application/pdf')), size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 2097152), content_base64 text NOT NULL CHECK(length(content_base64)<=2796204), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(team_id,ticket_id) REFERENCES public.support_tickets(team_id,id));
GRANT SELECT ON public.support_attachments TO authenticated; GRANT ALL ON public.support_attachments TO service_role;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read private attachments" ON public.support_attachments FOR SELECT TO authenticated USING(public.support_role(team_id) IN ('admin','manager','agent'));
CREATE TABLE public.support_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.support_teams(id), entity_type text NOT NULL, entity_id text NOT NULL, action text NOT NULL, actor_id uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.support_audit TO authenticated; GRANT ALL ON public.support_audit TO service_role;
ALTER TABLE public.support_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read audit" ON public.support_audit FOR SELECT TO authenticated USING(public.support_role(team_id) IN ('admin','manager'));
CREATE FUNCTION public.support_record_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.support_audit(team_id,entity_type,entity_id,action,actor_id) VALUES(NEW.team_id,TG_TABLE_NAME,COALESCE(to_jsonb(NEW)->>'id',to_jsonb(NEW)->>'user_id'),TG_OP,auth.uid()); RETURN NEW; END $$;
CREATE TRIGGER support_ticket_audit AFTER INSERT OR UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.support_record_change();
CREATE TRIGGER support_message_audit AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.support_record_change();
CREATE TRIGGER support_customer_audit AFTER INSERT OR UPDATE ON public.support_customers FOR EACH ROW EXECUTE FUNCTION public.support_record_change();
CREATE TRIGGER support_member_audit AFTER INSERT OR UPDATE ON public.support_members FOR EACH ROW EXECUTE FUNCTION public.support_record_change();
CREATE TRIGGER support_draft_audit AFTER INSERT OR UPDATE ON public.support_ai_drafts FOR EACH ROW EXECUTE FUNCTION public.support_record_change();
CREATE TRIGGER support_attachment_audit AFTER INSERT ON public.support_attachments FOR EACH ROW EXECUTE FUNCTION public.support_record_change();
CREATE FUNCTION public.support_article_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.support_article_versions(team_id,article_id,version,title,body,state,source_url,author_id) VALUES(NEW.team_id,NEW.id,NEW.version,NEW.title,NEW.body,NEW.state,NEW.source_url,auth.uid()); INSERT INTO public.support_audit(team_id,entity_type,entity_id,action,actor_id) VALUES(NEW.team_id,'support_articles',NEW.id::text,TG_OP,auth.uid()); RETURN NEW; END $$;
CREATE TRIGGER support_article_history AFTER INSERT OR UPDATE ON public.support_articles FOR EACH ROW EXECUTE FUNCTION public.support_article_snapshot();
INSERT INTO public.support_teams(name,created_by) SELECT 'Winstone Support',p.id FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id WHERE r.role='admin';
INSERT INTO public.support_members(team_id,user_id,role,display_name) SELECT t.id,t.created_by,'admin',p.display_name FROM public.support_teams t JOIN public.profiles p ON p.id=t.created_by;
CREATE FUNCTION public.support_mutate(_team uuid,_action text,_payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text; ident uuid; t public.support_tickets; d public.support_ai_drafts; cust public.support_customers; hours integer; target uuid; desired text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF; r:=public.support_role(_team);
 IF _action='customer_reply' THEN
  SELECT * INTO t FROM public.support_tickets WHERE id=(_payload->>'ticket_id')::uuid AND team_id=_team FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.support_customers WHERE id=t.customer_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Customer access denied'; END IF;
  INSERT INTO public.support_messages(team_id,ticket_id,body,visibility,request_key) VALUES(_team,t.id,_payload->>'body','customer',(_payload->>'request_key')::uuid) ON CONFLICT(team_id,request_key) DO NOTHING RETURNING id INTO ident;
  RETURN COALESCE(ident,(SELECT id FROM public.support_messages WHERE team_id=_team AND request_key=(_payload->>'request_key')::uuid));
 END IF;
 IF r IS NULL OR r='viewer' THEN RAISE EXCEPTION 'Operator access required'; END IF;
 IF _action IN ('member','settings','customer_link') AND r<>'admin' THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF _action IN ('article','merge') AND r NOT IN ('admin','manager') THEN RAISE EXCEPTION 'Manager access required'; END IF;
 CASE _action
 WHEN 'customer' THEN
  ident:=NULLIF(_payload->>'id','')::uuid;
  IF ident IS NULL THEN
   SELECT customer_id INTO ident FROM public.support_customer_contacts WHERE team_id=_team AND phone=COALESCE(_payload->>'phone','') AND phone<>''; IF ident IS NOT NULL THEN RETURN ident; END IF;
   INSERT INTO public.support_customers(team_id,name,phone_last4,consent,communication_preference,notes) VALUES(_team,_payload->>'name',right(COALESCE(_payload->>'phone',''),4),COALESCE((_payload->>'consent')::boolean,false),COALESCE(_payload->>'communication_preference','in_app'),COALESCE(_payload->>'notes','')) RETURNING id INTO ident;
   INSERT INTO public.support_customer_contacts(customer_id,team_id,phone,email) VALUES(ident,_team,COALESCE(_payload->>'phone',''),COALESCE(_payload->>'email',''));
  ELSE
   UPDATE public.support_customers SET name=_payload->>'name',consent=(_payload->>'consent')::boolean,communication_preference=_payload->>'communication_preference',notes=COALESCE(_payload->>'notes','') WHERE id=ident AND team_id=_team; IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  END IF;
 WHEN 'customer_link' THEN UPDATE public.support_customers SET user_id=(_payload->>'user_id')::uuid WHERE id=(_payload->>'id')::uuid AND team_id=_team RETURNING id INTO ident;
 WHEN 'ticket' THEN
  IF NULLIF(_payload->>'call_id','') IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.call_logs l JOIN public.support_members m ON m.user_id=l.user_id AND m.team_id=_team WHERE l.id=(_payload->>'call_id')::uuid) THEN RAISE EXCEPTION 'Call outside team'; END IF;
   SELECT id INTO ident FROM public.support_tickets WHERE team_id=_team AND call_id=(_payload->>'call_id')::uuid AND status<>'resolved' AND merged_into IS NULL; IF ident IS NOT NULL THEN RETURN ident; END IF;
  END IF;
  SELECT COALESCE((settings->'sla_hours'->>COALESCE(_payload->>'priority','normal'))::integer,24) INTO hours FROM public.support_teams WHERE id=_team;
  INSERT INTO public.support_tickets(team_id,subject,description,priority,channel,category,customer_id,call_id,assignee_id,request_key,sla_due_at,created_by) VALUES(_team,_payload->>'subject',COALESCE(_payload->>'description',''),COALESCE(_payload->>'priority','normal'),COALESCE(_payload->>'channel','manual'),COALESCE(_payload->>'category','General'),NULLIF(_payload->>'customer_id','')::uuid,NULLIF(_payload->>'call_id','')::uuid,NULLIF(_payload->>'assignee_id','')::uuid,(_payload->>'request_key')::uuid,now()+make_interval(hours=>hours),auth.uid()) ON CONFLICT(team_id,request_key) DO NOTHING RETURNING id INTO ident;
  ident:=COALESCE(ident,(SELECT id FROM public.support_tickets WHERE team_id=_team AND request_key=(_payload->>'request_key')::uuid));
 WHEN 'update_ticket' THEN
  SELECT * INTO t FROM public.support_tickets WHERE id=(_payload->>'id')::uuid AND team_id=_team FOR UPDATE;
  IF t.id IS NULL OR t.merged_into IS NOT NULL THEN RAISE EXCEPTION 'Case unavailable'; END IF; IF t.revision<>(_payload->>'revision')::integer THEN RAISE EXCEPTION 'Case changed; refresh before saving'; END IF;
  desired:=COALESCE(_payload->>'status',t.status); IF t.status='resolved' AND desired NOT IN ('resolved','open') THEN RAISE EXCEPTION 'Reopen to Open first'; END IF;
  UPDATE public.support_tickets SET status=desired,priority=COALESCE(_payload->>'priority',t.priority),category=COALESCE(_payload->>'category',t.category),assignee_id=NULLIF(_payload->>'assignee_id','')::uuid,tags=ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'tags','[]'))),resolved_at=CASE WHEN desired='resolved' THEN COALESCE(t.resolved_at,now()) ELSE NULL END,reopen_count=t.reopen_count+CASE WHEN t.status='resolved' AND desired='open' THEN 1 ELSE 0 END,revision=t.revision+1,updated_at=now() WHERE id=t.id RETURNING id INTO ident;
 WHEN 'merge' THEN
  ident:=(_payload->>'id')::uuid; target:=(_payload->>'target')::uuid; PERFORM id FROM public.support_tickets WHERE id IN (ident,target) AND team_id=_team ORDER BY id FOR UPDATE; SELECT * INTO t FROM public.support_tickets WHERE id=ident AND team_id=_team;
  IF ident=target OR t.merged_into IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.support_tickets WHERE id=target AND team_id=_team AND merged_into IS NULL AND status<>'resolved') THEN RAISE EXCEPTION 'Invalid merge target'; END IF; IF t.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  UPDATE public.support_tickets SET merged_into=target,status='resolved',resolved_at=now(),updated_at=now(),revision=revision+1 WHERE id=ident;
 WHEN 'message' THEN
  SELECT * INTO t FROM public.support_tickets WHERE id=(_payload->>'ticket_id')::uuid AND team_id=_team FOR UPDATE;
  IF t.id IS NULL OR t.merged_into IS NOT NULL OR t.status='resolved' THEN RAISE EXCEPTION 'Reopen case before replying'; END IF;
  SELECT id INTO ident FROM public.support_messages WHERE team_id=_team AND request_key=(_payload->>'request_key')::uuid; IF ident IS NOT NULL THEN RETURN ident; END IF;
  IF _payload->>'visibility'='customer' THEN SELECT * INTO cust FROM public.support_customers WHERE id=t.customer_id AND team_id=_team; IF cust.user_id IS NULL OR NOT cust.consent OR cust.communication_preference<>'in_app' THEN RAISE EXCEPTION 'Customer in-app account and consent required'; END IF; END IF;
  IF NULLIF(_payload->>'ai_draft_id','') IS NOT NULL THEN
   SELECT * INTO d FROM public.support_ai_drafts WHERE id=(_payload->>'ai_draft_id')::uuid AND team_id=_team AND ticket_id=t.id FOR UPDATE;
   IF d.status IS DISTINCT FROM 'approved' OR d.kind NOT IN ('reply','follow_up') OR d.body IS DISTINCT FROM (_payload->>'body') THEN RAISE EXCEPTION 'AI draft requires human approval of the exact reply'; END IF; UPDATE public.support_ai_drafts SET status='used' WHERE id=d.id;
  END IF;
  INSERT INTO public.support_messages(team_id,ticket_id,body,visibility,request_key,ai_draft_id) VALUES(_team,t.id,_payload->>'body',_payload->>'visibility',(_payload->>'request_key')::uuid,NULLIF(_payload->>'ai_draft_id','')::uuid) RETURNING id INTO ident;
  IF _payload->>'visibility'='customer' THEN UPDATE public.support_tickets SET first_response_at=COALESCE(first_response_at,now()),updated_at=now(),revision=revision+1 WHERE id=t.id; END IF;
 WHEN 'approve_draft' THEN UPDATE public.support_ai_drafts SET body=_payload->>'body',status='approved',approved_by=auth.uid(),approved_at=now() WHERE id=(_payload->>'id')::uuid AND team_id=_team AND status<>'used' RETURNING id INTO ident;
 WHEN 'article' THEN
  ident:=NULLIF(_payload->>'id','')::uuid;
  IF ident IS NULL THEN INSERT INTO public.support_articles(team_id,title,body,category,state,source_url) VALUES(_team,_payload->>'title',_payload->>'body',_payload->>'category',_payload->>'state',COALESCE(_payload->>'source_url','')) RETURNING id INTO ident;
  ELSE UPDATE public.support_articles SET title=_payload->>'title',body=_payload->>'body',category=_payload->>'category',state=_payload->>'state',source_url=COALESCE(_payload->>'source_url',''),version=version+1,updated_at=now(),updated_by=auth.uid() WHERE id=ident AND team_id=_team AND version=(_payload->>'version')::integer; IF NOT FOUND THEN RAISE EXCEPTION 'Article changed or unavailable'; END IF; END IF;
 WHEN 'member' THEN
  IF (_payload->>'user_id')::uuid=auth.uid() AND _payload->>'role'<>'admin' THEN RAISE EXCEPTION 'Cannot demote yourself'; END IF;
  INSERT INTO public.support_members(team_id,user_id,role,display_name) SELECT _team,p.id,_payload->>'role',p.display_name FROM public.profiles p WHERE p.id=(_payload->>'user_id')::uuid ON CONFLICT(team_id,user_id) DO UPDATE SET role=EXCLUDED.role,display_name=EXCLUDED.display_name RETURNING user_id INTO ident;
 WHEN 'settings' THEN UPDATE public.support_teams SET settings=_payload->'settings' WHERE id=_team RETURNING id INTO ident; INSERT INTO public.support_audit(team_id,entity_type,entity_id,action) VALUES(_team,'support_teams',_team::text,'UPDATE_SETTINGS');
 WHEN 'attachment' THEN
  IF NOT EXISTS(SELECT 1 FROM public.support_tickets WHERE id=(_payload->>'ticket_id')::uuid AND team_id=_team) THEN RAISE EXCEPTION 'Case not found'; END IF;
  INSERT INTO public.support_attachments(team_id,ticket_id,name,mime,size_bytes,content_base64) VALUES(_team,(_payload->>'ticket_id')::uuid,_payload->>'name',_payload->>'mime',(_payload->>'size_bytes')::integer,_payload->>'content_base64') RETURNING id INTO ident;
 ELSE RAISE EXCEPTION 'Unknown operation'; END CASE;
 IF ident IS NULL THEN RAISE EXCEPTION 'Record unavailable'; END IF; RETURN ident;
END $$;
REVOKE ALL ON FUNCTION public.support_mutate(uuid,text,jsonb) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.support_mutate(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.support_available_people(_team uuid) RETURNS TABLE(id uuid,display_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN IF public.support_role(_team) <> 'admin' OR public.support_role(_team) IS NULL THEN RAISE EXCEPTION 'Admin required'; END IF; RETURN QUERY SELECT p.id,p.display_name FROM public.profiles p ORDER BY p.display_name; END $$;
REVOKE ALL ON FUNCTION public.support_available_people(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.support_available_people(uuid) TO authenticated;