-- Adicionar campos fiscais e de endereço na tabela partners
ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS cnpj character varying(18),
ADD COLUMN IF NOT EXISTS razao_social text,
ADD COLUMN IF NOT EXISTS inscricao_estadual character varying(20),
ADD COLUMN IF NOT EXISTS inscricao_municipal character varying(20),
ADD COLUMN IF NOT EXISTS cep character varying(9),
ADD COLUMN IF NOT EXISTS logradouro text,
ADD COLUMN IF NOT EXISTS numero character varying(20),
ADD COLUMN IF NOT EXISTS complemento text,
ADD COLUMN IF NOT EXISTS bairro text,
ADD COLUMN IF NOT EXISTS cidade text,
ADD COLUMN IF NOT EXISTS estado character varying(2),
ADD COLUMN IF NOT EXISTS telefone character varying(20),
ADD COLUMN IF NOT EXISTS email character varying(255);