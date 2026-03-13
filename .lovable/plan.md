

## Plano: Refatorar /distributions/terms — UI simplificada, novos campos de distribuição e sincronização completa

### 1. Migração: Adicionar colunas à tabela `distributions`

Adicionar ~20 colunas para armazenar todos os campos do retorno de `BuscaNovasDistribuicoes`:

| Coluna | Tipo |
|--------|------|
| cod_processo | integer |
| cod_escritorio | integer |
| instancia | integer |
| sigla_sistema | text |
| comarca | text |
| orgao_julgador | text |
| tipo_do_processo | text |
| data_audiencia | timestamptz |
| tipo_audiencia | text |
| valor_da_causa | text |
| assuntos | jsonb |
| magistrado | text |
| autor | jsonb |
| reu | jsonb |
| outros_envolvidos | jsonb |
| advogados | jsonb |
| movimentos | jsonb |
| documentos_iniciais | jsonb |
| lista_documentos | jsonb |
| cidade | text |
| uf | varchar(2) |
| cod_pre_cadastro_termo | integer |
| nome_pesquisado | text |
| processo_originario | text |

### 2. UI — `DistributionTerms.tsx`

**Dialog de cadastro:**
- Instâncias: mostrar apenas "Todas as Instâncias" (4), marcada e bloqueada (disabled)
- Clientes: pré-selecionar todos os clientes disponíveis ao abrir o dialog
- Abrangências: mostrar badge "Todos os diários selecionados" com lista fixa hardcoded, sem interação (checkbox global marcado e disabled)
- Default form: `listInstancias: [4]`, `qtdDiasCapturaRetroativa: "90"`
- No envio: sempre enviar `listInstancias: [4]` e a lista fixa completa de abrangências

**Tabela de ações:**
- Remover botão "Ativar/Desativar"
- Manter apenas Editar e Excluir
- Excluir deve chamar edge function `manage-distribution-terms` com action `deleteName` passando `codNome`

### 3. Sincronização — Botão "Sincronizar"

Ao clicar, executar em sequência:
1. Chamar `listNames` (já existente) — sincroniza termos da API para tabela local, remove locais que não existem na API
2. Chamar `sync-distributions` — busca novas distribuições e salva com todos os novos campos

A mutation `syncMutation` será atualizada para chamar ambas as edge functions.

### 4. Edge function `sync-distributions/index.ts`

Atualizar o upsert para mapear todos os novos campos:
```
cod_processo: dist.codProcesso
instancia: dist.instancia
sigla_sistema: dist.siglaSistema
comarca: dist.comarca
orgao_julgador: dist.orgaoJulgador
...
autor: dist.autor (jsonb)
reu: dist.reu (jsonb)
advogados: dist.advogados (jsonb)
movimentos: dist.movimentos (jsonb)
```

### 5. Limpar registros existentes

Antes de sincronizar termos, remover da tabela `search_terms` (type=distribution) os que não existem mais na API. O `listNames` já faz upsert; adicionarei lógica para deletar locais que não vieram da API.

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | ~20 colunas em `distributions` |
| `src/pages/DistributionTerms.tsx` | Simplificar dialog, remover ativar/desativar, sync completo |
| `supabase/functions/sync-distributions/index.ts` | Mapear todos os novos campos no upsert |
| `supabase/functions/manage-distribution-terms/index.ts` | Adicionar limpeza de termos órfãos no `listNames` |

