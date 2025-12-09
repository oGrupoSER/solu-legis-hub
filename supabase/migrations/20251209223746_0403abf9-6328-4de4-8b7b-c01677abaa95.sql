
-- Limpar duplicatas de advogados usando texto para comparação
DELETE FROM process_lawyers 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (process_id, cod_processo_polo, nome_advogado) id
    FROM process_lawyers
    ORDER BY process_id, cod_processo_polo, nome_advogado, created_at DESC
  ) sub
);

-- Criar índice único para evitar duplicatas futuras de advogados
CREATE UNIQUE INDEX IF NOT EXISTS idx_process_lawyers_unique 
ON process_lawyers (process_id, cod_processo_polo, nome_advogado);

-- Limpar duplicatas de partes
DELETE FROM process_parties 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (process_id, nome, tipo_polo) id
    FROM process_parties
    ORDER BY process_id, nome, tipo_polo, created_at DESC
  ) sub
);

-- Criar índice único para evitar duplicatas futuras de partes  
CREATE UNIQUE INDEX IF NOT EXISTS idx_process_parties_unique 
ON process_parties (process_id, nome, tipo_polo);

-- Criar índice único para documentos por cod_documento (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS idx_process_documents_cod_documento 
ON process_documents (cod_documento);

-- Criar índice único para movimentos por cod_andamento (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS idx_process_movements_cod_andamento 
ON process_movements (cod_andamento);
