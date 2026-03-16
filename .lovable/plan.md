

## Plano: Substituir campo de texto Service ID por dropdown

### O que muda

No rendering dos body params (linhas 800-812 de `ApiTesting.tsx`), quando o campo é `serviceId` ou `service_id`, renderizar um `Select` dropdown em vez de `Input`.

### Detalhes técnicos

**1. Query para buscar serviços**

Adicionar uma query com `useQuery` que busca `partner_services` (id, service_name, service_type, partner_id + partner name via join):

```typescript
const { data: partnerServices } = useQuery({
  queryKey: ["partner-services-playground"],
  queryFn: async () => {
    const { data } = await supabase
      .from("partner_services")
      .select("id, service_name, service_type, is_active, partners(name)")
      .eq("is_active", true);
    return data;
  },
});
```

**2. Filtro por tipo de serviço baseado na aba/endpoint**

- Aba **Publicações** (manage-search-terms): filtra por `service_type = 'terms'`
- Aba **Distribuições** (manage-distribution-terms): filtra por `service_type = 'distributions'`
- Aba **Processos** (sync-process-management): filtra por `service_type = 'processes'`

Determinar o filtro baseado no `selectedEndpoint.path`.

**3. Render condicional no body params**

Na iteração de `bodyParams` (linha 800), quando `p.key === "serviceId" || p.key === "service_id"`:
- Renderizar `<Select>` com os serviços filtrados
- Cada item mostra: `"{partner_name} - {service_name}"`
- O `value` do select é o UUID do serviço
- `onValueChange` atualiza `bodyValues[p.key]`

Campos que **não** são serviceId continuam como `Input` normalmente.

### Arquivos alterados
- `src/pages/ApiTesting.tsx`: ~25 linhas novas (query + render condicional)

