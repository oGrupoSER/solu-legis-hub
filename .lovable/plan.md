

## Plano: Botão "Verificar Status" na Página de Processos

### Objetivo
Adicionar um botão dedicado na página `/processes` que executa apenas duas ações: envia processos pendentes para a Solucionare e atualiza o status de todos os processos cadastrados (bulk). Sem abrir o diálogo completo de sincronização.

### Alteração

**`src/pages/Processes.tsx`**

Adicionar um botão "Verificar Status" ao lado dos botões existentes, com ícone `RefreshCw` ou `CheckCircle`. Ao clicar:

1. Mostra estado de loading no botão
2. Chama `sync-process-management` com `action: "send-pending"` (envia pendentes)
3. Chama `sync-process-management` com `action: "sync"` (atualiza status via BuscaProcessos bulk)
4. Exibe toast com resultado (ex: "3 enviados, 312 atualizados")
5. Dispara `setRefreshTrigger` para atualizar a tabela

```typescript
<Button onClick={handleVerifyStatus} variant="outline" size="sm" disabled={isVerifying}>
  {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
  Verificar Status
</Button>
```

### Arquivo alterado
- `src/pages/Processes.tsx`

