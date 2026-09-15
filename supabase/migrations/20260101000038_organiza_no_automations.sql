-- Sprint 20: Kyra Organiza não tem acesso a automações
-- automations.max = 0 → bloqueado (conforme regra: 0 = bloqueado, NULL = ilimitado)

update public.plan_entitlements
set int_value = 0
where feature_key = 'automations.max'
  and plan_id = (select id from public.plans where slug = 'organiza');
