DROP POLICY "Team or customer reads profile" ON public.support_customers;
CREATE POLICY "Team reads customer profiles" ON public.support_customers FOR SELECT TO authenticated USING(public.support_role(team_id) IS NOT NULL);
DROP POLICY "Team or linked customer reads case" ON public.support_tickets;
CREATE POLICY "Team reads support cases" ON public.support_tickets FOR SELECT TO authenticated USING(public.support_role(team_id) IS NOT NULL);
CREATE FUNCTION public.support_portal() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE tickets jsonb; messages jsonb; customers jsonb;
BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'team_id',c.team_id,'name',c.name,'consent',c.consent,'communication_preference',c.communication_preference)),'[]') INTO customers FROM public.support_customers c WHERE c.user_id=auth.uid();
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'team_id',t.team_id,'subject',t.subject,'status',t.status,'created_at',t.created_at) ORDER BY t.created_at DESC),'[]') INTO tickets FROM public.support_tickets t JOIN public.support_customers c ON c.id=t.customer_id WHERE c.user_id=auth.uid();
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'ticket_id',m.ticket_id,'body',m.body,'author_id',m.author_id,'created_at',m.created_at,'delivery_state',m.delivery_state) ORDER BY m.created_at),'[]') INTO messages FROM public.support_messages m JOIN public.support_tickets t ON t.id=m.ticket_id JOIN public.support_customers c ON c.id=t.customer_id WHERE c.user_id=auth.uid() AND m.visibility='customer';
 RETURN jsonb_build_object('customers',customers,'tickets',tickets,'messages',messages); END $$;
REVOKE ALL ON FUNCTION public.support_portal() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.support_portal() TO authenticated;
CREATE FUNCTION public.support_customer_case(_customer uuid,_subject text,_body text,_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.support_customers; ident uuid; hours integer;
BEGIN SELECT * INTO c FROM public.support_customers WHERE id=_customer AND user_id=auth.uid();
IF c.id IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Customer access denied'; END IF;
IF NOT c.consent OR c.communication_preference<>'in_app' THEN RAISE EXCEPTION 'Communication consent required'; END IF;
IF length(trim(_subject)) NOT BETWEEN 1 AND 200 OR length(trim(_body)) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Invalid inquiry'; END IF;
SELECT COALESCE((settings->'sla_hours'->>'normal')::integer,24) INTO hours FROM public.support_teams WHERE id=c.team_id;
INSERT INTO public.support_tickets(team_id,customer_id,subject,channel,request_key,sla_due_at,created_by) VALUES(c.team_id,c.id,_subject,'web_chat',_key,now()+make_interval(hours=>hours),auth.uid()) ON CONFLICT(team_id,request_key) DO NOTHING RETURNING id INTO ident;
IF ident IS NOT NULL THEN INSERT INTO public.support_messages(team_id,ticket_id,body,visibility,request_key) VALUES(c.team_id,ident,_body,'customer',_key); END IF;
RETURN COALESCE(ident,(SELECT id FROM public.support_tickets WHERE team_id=c.team_id AND request_key=_key AND customer_id=c.id)); END $$;
REVOKE ALL ON FUNCTION public.support_customer_case(uuid,text,text,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.support_customer_case(uuid,text,text,uuid) TO authenticated;
CREATE FUNCTION public.support_mark_read(_ticket uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.support_tickets; r text;
BEGIN SELECT * INTO t FROM public.support_tickets WHERE id=_ticket; r:=public.support_role(t.team_id);
IF auth.uid() IS NULL OR (r IS NULL AND NOT EXISTS(SELECT 1 FROM public.support_customers WHERE id=t.customer_id AND user_id=auth.uid())) THEN RAISE EXCEPTION 'Case access denied'; END IF;
UPDATE public.support_messages SET delivery_state='read' WHERE ticket_id=t.id AND visibility='customer' AND author_id<>auth.uid() AND delivery_state='stored'; END $$;
REVOKE ALL ON FUNCTION public.support_mark_read(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.support_mark_read(uuid) TO authenticated;
CREATE FUNCTION public.support_validate_attachment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE raw bytea;
BEGIN raw:=decode(NEW.content_base64,'base64'); IF octet_length(raw)<>NEW.size_bytes THEN RAISE EXCEPTION 'File size mismatch'; END IF;
IF NOT ((NEW.mime='application/pdf' AND substring(raw from 1 for 5)=decode('255044462d','hex')) OR (NEW.mime='image/jpeg' AND substring(raw from 1 for 3)=decode('ffd8ff','hex')) OR (NEW.mime='image/png' AND substring(raw from 1 for 8)=decode('89504e470d0a1a0a','hex'))) THEN RAISE EXCEPTION 'Invalid file signature'; END IF; RETURN NEW; END $$;
CREATE TRIGGER support_attachment_validation BEFORE INSERT ON public.support_attachments FOR EACH ROW EXECUTE FUNCTION public.support_validate_attachment();
CREATE FUNCTION public.support_validate_settings() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text; n integer;
BEGIN IF jsonb_typeof(NEW.settings->'categories') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.settings->'categories') NOT BETWEEN 1 AND 40 OR jsonb_typeof(NEW.settings->'ai_enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid team settings'; END IF;
FOREACH k IN ARRAY ARRAY['urgent','high','normal','low'] LOOP n:=(NEW.settings->'sla_hours'->>k)::integer; IF n IS NULL OR n NOT BETWEEN 1 AND 720 THEN RAISE EXCEPTION 'Invalid SLA hours'; END IF; END LOOP; RETURN NEW; END $$;
CREATE TRIGGER support_settings_validation BEFORE INSERT OR UPDATE ON public.support_teams FOR EACH ROW EXECUTE FUNCTION public.support_validate_settings();
CREATE FUNCTION public.support_validate_case() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.assignee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.support_members WHERE team_id=NEW.team_id AND user_id=NEW.assignee_id AND role IN ('admin','manager','agent')) THEN RAISE EXCEPTION 'Assignee must be a support operator'; END IF;
IF NEW.call_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.call_logs l JOIN public.support_members m ON m.user_id=l.user_id AND m.team_id=NEW.team_id WHERE l.id=NEW.call_id) THEN RAISE EXCEPTION 'Call outside support team'; END IF;
IF TG_OP='UPDATE' AND OLD.status='resolved' AND NEW.status NOT IN ('resolved','open') THEN RAISE EXCEPTION 'Reopen into Open first'; END IF; RETURN NEW; END $$;
CREATE TRIGGER support_case_validation BEFORE INSERT OR UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.support_validate_case();