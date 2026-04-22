

## Plano: Corrigir `office_code` do Cadastro de Termos de Distribuição

### Causa raiz

O `partner_services.config.office_code` está com valor `4` (incorreto), mas `partners.office_code = 41` (correto). A função `getOfficeCodes` prioriza o `config` do serviço → envia `codEscritorio: 4` ao Solucionare.

```
[registerName] Request body: {"codEscritorio":4,"nome":"...", ...}
[registerName] Name "..." already exists at Solucionare, saving locally only
```

Resultado:
1. Solucionare rejeita/duplica → termo salvo como `pending` sem `solucionare_code`
2. No refresh, `listNames` consulta com escritório **41** (parceiro), não vê o termo local, e o orphan cleanup deleta

Conforme memória [Office Code Default 41](mem://services/distribution-office-code-standardization), o padrão obrigatório para Distribuições V3 é **41**.

### Correções em `supabase/functions/manage-distribution-terms/index.ts`

**1. Padronizar `codEscritorio = 41` para todas operações de Distribuições V3**

Alterar `getOfficeCodes` para forçar `41` em chamadas à API Solucionare V3 (ignorar `config.office_code` se diferente, ou usar sempre `partnerCode`):

```typescript
async function getOfficeCodes(supabase, serviceId) {
  // ... busca igual
  // Para V3 distribuições: SEMPRE usar partnerCode (41), nunca config customizado
  const serviceCode = partnerCode; // unificado
  return { serviceCode, partnerCode };
}
```

Isso garante que `CadastrarNome`, `BuscaNomesCadastrados`, `BuscaNovasDistribuicoes`, `Confirma...` usem todos o mesmo `codEscritorio = 41`, eliminando a discrepância que causa o orphan cleanup.

**2. Corrigir o registro corrompido no banco**

Migration para limpar `partner_services.config.office_code = 4`:
```sql
UPDATE partner_services 
SET config = config - 'office_code'
WHERE service_type = 'distributions' AND config->>'office_code' = '4';
```

**3. Limpar termos órfãos `pending` sem `solucionare_code`** (opcional — sync seguinte vai re-tentar via retry block já existente nas linhas 280-313):

Não é necessário — o bloco de retry no `listNames` (já implementado) vai re-enviar os termos `pending` ao Solucionare na próxima sincronização, agora com `codEscritorio = 41` correto.

### Atualização de memória

Atualizar `mem://services/distribution-office-code-standardization` para reforçar que `partner_services.config.office_code` NÃO deve sobrescrever o padrão 41 para distribuições.

### Arquivos alterados
- `supabase/functions/manage-distribution-terms/index.ts` — `getOfficeCodes` ignora config customizado, sempre usa partnerCode
- Nova migration SQL — limpa `config.office_code` inválido
- `mem://services/distribution-office-code-standardization` — reforço da regra

