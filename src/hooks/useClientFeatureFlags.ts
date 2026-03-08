import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ClientFeatureFlags {
  website_editor: boolean;
  leads_visible: boolean;
  billing_visible: boolean;
  integrations: boolean;
  appointments: boolean;
  proposals: boolean;
  new_request: boolean;
  jetsuite: boolean;
}

const DEFAULT_FLAGS: ClientFeatureFlags = {
  website_editor: true,
  leads_visible: true,
  billing_visible: true,
  integrations: false,
  appointments: false,
  proposals: true,
  new_request: true,
  jetsuite: false,
};

export function useClientFeatureFlags(clientId?: string) {
  const { profile } = useAuth();
  const [flags, setFlags] = useState<ClientFeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId && !profile?.id) { setLoading(false); return; }

    const load = async () => {
      let query = supabase.from('client_feature_flags').select('*');

      if (clientId) {
        // Admin viewing a specific client
        query = query.eq('client_id', clientId);
      } else {
        // Client viewing their own flags — look up client_id first
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('owner_profile_id', profile!.id)
          .single();
        if (!clientData) { setLoading(false); return; }
        query = query.eq('client_id', clientData.id);
      }

      const { data } = await query.single();
      if (data) setFlags(data as ClientFeatureFlags);
      setLoading(false);
    };

    load();
  }, [clientId, profile?.id]);

  return { flags, loading };
}
