
# Plano: Testar Abrangencias de Publicacoes nas Distribuicoes

## Hipotese

A API REST V3 de Distribuicoes (`CadastrarNome`) pode esperar as mesmas siglas de diarios usadas nas Publicacoes (CISP, DJE-SP, DOU, etc.) ao inves dos codigos de sistema/tribunal (`BuscaStatusSistemas`).

Evidencias:
- `codSistema` (numeros) do `BuscaStatusSistemas` -> falhou com "abrangencia invalida"
- `siglaSistema` (strings como TRF1_PJE1) -> tambem falhou
- O campo se chama `listAbrangencias`, mesmo nome usado no SOAP (`abrangencia: String[]` com siglas de diarios)

## O Que Sera Feito

### 1. Alterar `manage-distribution-terms` para buscar abrangencias do SOAP

Na action `listAbrangencias`, alem de (ou ao inves de) chamar `BuscaStatusSistemas`, buscar as abrangencias do modulo SOAP `escritorios.php` usando `getAbrangencias` - que e a mesma fonte usada nas publicacoes.

Para isso:
- Buscar o servico de publicacoes (`terms` ou `publications`) do mesmo parceiro
- Usar o `SoapClient` para chamar `getAbrangencias(nomeRelacional, token)` no endpoint `escritorios.php`
- Retornar a lista de siglas de diarios (CISP, DJE-SP, etc.)
- Manter a lista de `BuscaStatusSistemas` como fallback

### 2. Alterar a action `registerName` para enviar siglas de diarios

- Mudar `listAbrangencias` para enviar as siglas de diarios selecionadas (strings como "DJE-SP") ao inves de codigos numericos
- Testar o cadastro com essas siglas

### 3. Atualizar o componente `AbrangenciasSelector` nas Distribuicoes

- Substituir o seletor atual (baseado em `BuscaStatusSistemas` com codSistema) por um seletor simples de siglas de diarios (mesmo formato das publicacoes)
- Os dados virao como lista plana de strings (sem agrupamento por tribunal)

### 4. Testar automaticamente

Apos deploy, chamar a edge function com uma sigla de diario real para validar se a API aceita.

---

## Detalhes Tecnicos

### Edge Function: `manage-distribution-terms/index.ts`

**Action `listAbrangencias` - nova abordagem:**
- Buscar `partner_services` do mesmo `partner_id` com `service_type = 'terms'` ou `'publications'`
- Importar e usar o `SoapClient` para chamar `getAbrangencias` no endpoint `escritorios.php`
- Retornar array de strings (siglas de diarios)
- Fallback: se nao encontrar servico SOAP, manter o `BuscaStatusSistemas` atual

**Action `registerName` - ajuste:**
- Campo `listAbrangencias` passa a receber `string[]` (siglas) ao inves de `number[]` (codSistema)
- Sem necessidade de fallback codSistema/siglaSistema

### Frontend: `src/pages/DistributionTerms.tsx`

**`AbrangenciasSelector` simplificado:**
- Trocar de seletor agrupado por tribunal para lista simples de checkboxes com siglas de diarios
- Campo de busca para filtrar
- Botoes "Selecionar Todos" / "Limpar"
- O tipo `selectedAbrangencias` muda de `number[]` para `string[]`

### Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/manage-distribution-terms/index.ts` | Alterar `listAbrangencias` para buscar do SOAP e `registerName` para enviar siglas |
| `src/pages/DistributionTerms.tsx` | Simplificar `AbrangenciasSelector` para usar siglas de diarios |

