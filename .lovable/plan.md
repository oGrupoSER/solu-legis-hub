

## Plano: Ocultar colunas Escritório e Tribunal

Remover as colunas "Escritório" e "Tribunal" da tabela de processos em `/processes/movements`.

### Alterações em `src/pages/ProcessMovements.tsx`

1. **Remover TableHead** das linhas 529 (`Escritório`) e 530 (`Tribunal`)
2. **Remover TableCell** das linhas 548 (`cod_escritorio`) e 549 (`tribunal`)
3. **Atualizar colSpan** de `9` para `7` nas linhas 541 e 543 (loading e empty states)

