
# Correcao da Autenticacao da API V3 de Distribuicoes

## Problema Identificado

A API `AutenticaAPI` retorna o token JWT como uma **string simples** (ex: `"eyJ..."`) e nao como um objeto JSON `{token: "eyJ..."}`.

No codigo atual, fazemos:
```text
const data = await response.json();  // data = "eyJ..." (string)
return data.token;                   // retorna undefined!
```

O `undefined` e passado no header `Authorization: Bearer undefined`, causando "Token invalido" em todas as chamadas subsequentes.

## Correcao

### Arquivo: `supabase/functions/manage-distribution-terms/index.ts`

Na funcao `authenticate()`, linha 33-34:
- Mudar de `return data.token` para `return typeof data === 'string' ? data.replace(/^"|"$/g, '') : data.token || data`
- Isso trata ambos os cenarios: string pura ou objeto com campo token

### Arquivo: `supabase/functions/sync-distributions/index.ts`

Na funcao `authenticateAPI()`, linha 41-42:
- Mesma correcao: `return typeof data === 'string' ? data.replace(/^"|"$/g, '') : data.token || data`

Alem disso, adicionar logs de debug na autenticacao para facilitar troubleshooting futuro:
- Log do status da resposta
- Log do tipo do dado retornado (sem expor o token completo)

### Deploy

Deploy das duas Edge Functions corrigidas:
- `manage-distribution-terms`
- `sync-distributions`

## Impacto

Correcao pontual em 2 linhas (uma em cada funcao). Nao altera nenhuma outra logica. Apos a correcao, o botao "Sincronizar" na tela de Nomes Monitorados devera funcionar corretamente.
