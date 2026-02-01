select c.business_name, g.client_id, g.connection_status, length(g.google_access_token) as access_len, length(g.google_refresh_token) as refresh_len, g.calendar_id, g.updated_at, g.last_synced_at
from public.client_google_calendar g
join public.clients c on c.id = g.client_id
where c.business_name in ('GET LYFE','GAPBRIDGE')
order by c.business_name;