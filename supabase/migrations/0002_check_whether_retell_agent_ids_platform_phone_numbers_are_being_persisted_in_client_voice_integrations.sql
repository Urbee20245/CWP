select c.id, c.business_name, v.retell_agent_id, v.phone_number, v.number_source, v.voice_status, v.updated_at
from public.clients c
left join public.client_voice_integrations v on v.client_id = c.id
order by v.updated_at desc nulls last, c.created_at desc
limit 20;